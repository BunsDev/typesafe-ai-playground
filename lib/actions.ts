import type {
  ActionCandidate,
  ElementRecord,
  Operation,
  PageSnapshot,
  TargetOperation,
} from "../types/browserAgent";
import { isInput, isTextArea, nodeCache, visible } from "./getElementTable";
/**
 * The dynamic action space: the fixed operation set from jev-ultrafast, with
 * one target head per operation that has compatible observed elements.
 */
export interface ActionSpace {
  elements: ElementRecord[];
  targets: Partial<Record<TargetOperation, Record<string, ActionCandidate>>>;
  controls: Partial<Record<Operation, ActionCandidate>>;
}
const kindToOperation: Record<string, TargetOperation> = {
  click: "CLICK",
  fill: "TYPE_TEXT",
  select: "SELECT",
};
const controlOperation: Record<string, Operation> = {
  scroll_down: "SCROLL_DOWN",
  scroll_up: "SCROLL_UP",
  wait: "WAIT",
};
export function buildActionSpace(page: PageSnapshot): ActionSpace {
  const targets: ActionSpace["targets"] = {};
  const controls: ActionSpace["controls"] = {};
  for (const action of page.actions) {
    const control = controlOperation[action.id];
    if (control) {
      controls[control] = action;
      continue;
    }
    const operation = kindToOperation[action.kind];
    if (!operation || !action.index) continue;
    (targets[operation] ??= {})[action.index] = action;
  }
  return { elements: page.elements, targets, controls };
}
export const operationDescriptions: Record<Operation, string> = {
  CLICK:
    "Click an element, button, menu option, autocomplete suggestion, or calendar day.",
  TYPE_TEXT:
    "Enter or replace text in an editable field. A small LLM will supply the value from the goal.",
  SELECT: "Select an observed dropdown value.",
  SCROLL_DOWN: "Scroll down to reveal more of the page.",
  SCROLL_UP: "Scroll up.",
  WAIT: "Wait for the page to update.",
  DONE: "Every requirement is visibly satisfied.",
  BLOCKED: "No supported operation can progress.",
};
const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(finish, ms);
    function finish() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", finish);
      resolve();
    }
    signal?.addEventListener("abort", finish, { once: true });
  });
function setNativeValue(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
) {
  const realm = element.ownerDocument.defaultView ?? window;
  const prototype = isTextArea(element)
    ? realm.HTMLTextAreaElement.prototype
    : realm.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (setter) setter.call(element, value);
  else element.value = value;
}
export interface ExecutionPoint {
  x: number;
  y: number;
  element: Element;
}
/**
 * Executes one validated action against a resolved observed node. Model
 * output never becomes a selector, a coordinate, or executable code: the
 * executor only ever touches the element the snapshot recorded.
 */
export async function executeAction(
  win: Window,
  action: ActionCandidate,
  point: ExecutionPoint | null,
  text: string | null,
  signal?: AbortSignal,
): Promise<string> {
  if (action.kind === "wait") {
    await sleep(100, signal);
    return "waited 100 ms";
  }
  if (action.kind === "scroll") {
    win.scrollBy({ top: action.delta ?? 0, left: 0, behavior: "instant" });
    return `scrolled ${action.delta ?? 0}px`;
  }
  if (!point) throw Error("Target was not resolved; nothing executed.");
  const element = point.element as HTMLElement;
  const init = {
    bubbles: true,
    cancelable: true,
    clientX: point.x,
    clientY: point.y,
    view: win,
  };
  if (action.kind === "select") {
    const select = element as HTMLSelectElement;
    select.value = action.value ?? "";
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
    return `selected “${action.label}”`;
  }
  element.dispatchEvent(new MouseEvent("mousedown", init));
  element.focus?.();
  element.dispatchEvent(new MouseEvent("mouseup", init));
  if (action.kind === "click") {
    element.click();
    return `clicked [${action.index}] ${action.label}`;
  }
  if (text === null) throw Error("No text to type; nothing executed.");
  if (isInput(element) || isTextArea(element)) {
    // Replace, not append: this mirrors select-all followed by text insertion.
    setNativeValue(element, text);
    element.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        data: text,
        inputType: "insertText",
      }),
    );
    element.dispatchEvent(new Event("change", { bubbles: true }));
  } else {
    element.textContent = text;
    element.dispatchEvent(
      new InputEvent("input", { bubbles: true, data: text }),
    );
  }
  return `typed “${text}” into [${action.index}] ${action.label}`;
}
const optionVisible = (win: Window, e: Element) => {
  const r = e.getBoundingClientRect();
  return (
    r.width > 0 &&
    r.height > 0 &&
    r.bottom > 0 &&
    r.top < win.innerHeight &&
    visible(e)
  );
};
/**
 * Wait strategy: typing into a combobox waits for visible suggestions, capped
 * at 200 ms; every other interaction gets at most two animation frames or
 * 50 ms. This runs after execution is logged, never before.
 */
export function settleAfter(
  doc: Document,
  win: Window,
  action: ActionCandidate,
  signal?: AbortSignal,
): Promise<number> {
  const started = performance.now();
  if (action.kind === "wait") return Promise.resolve(0);
  const field =
    action.node === undefined
      ? undefined
      : nodeCache(doc).nodes.get(action.node);
  const autocomplete =
    action.kind === "fill" && field?.getAttribute("role") === "combobox";
  return new Promise((resolve) => {
    let frames = 0;
    let stopped = false;
    const finish = () => {
      if (stopped) return;
      stopped = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", finish);
      resolve(performance.now() - started);
    };
    const timer = setTimeout(finish, autocomplete ? 200 : 50);
    signal?.addEventListener("abort", finish, { once: true });
    const ready = () => {
      if (stopped) return;
      const ids = (
        field?.getAttribute("aria-controls") ||
        field?.getAttribute("aria-owns") ||
        ""
      )
        .split(/\s+/)
        .filter(Boolean);
      const roots: ParentNode[] = ids.length
        ? ids
            .map((id) => doc.getElementById(id))
            .filter((e): e is HTMLElement => !!e)
        : [doc];
      const options = roots.flatMap((root) =>
        Array.from(root.querySelectorAll('[role="option"]')),
      );
      if (
        ++frames >= 2 &&
        (!autocomplete || options.some((e) => optionVisible(win, e)))
      )
        finish();
      else win.requestAnimationFrame(ready);
    };
    win.requestAnimationFrame(ready);
  });
}
export { sleep };
