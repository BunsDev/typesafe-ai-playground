import type {
  ActionCandidate,
  ElementRecord,
  ElementRole,
  PageSnapshot,
  SelectOption,
  TargetOperation,
} from "../types/browserAgent";
/**
 * Perception: one atomic read of a document produces an indexed element
 * table. Every observed node gets a code-owned numeric identity kept in a
 * per-document cache, so an executed target is always resolved from an
 * actually observed element and never from model-generated selectors.
 */
interface NodeCache {
  ids: WeakMap<Element, number>;
  nodes: Map<number, Element>;
  next: number;
}
const caches = new WeakMap<Document, NodeCache>();
export function nodeCache(doc: Document): NodeCache {
  let cache = caches.get(doc);
  if (!cache) {
    cache = { ids: new WeakMap(), nodes: new Map(), next: 1 };
    caches.set(doc, cache);
  }
  return cache;
}
const identify = (cache: NodeCache, element: Element) => {
  let id = cache.ids.get(element);
  if (!id) {
    id = cache.next++;
    cache.ids.set(element, id);
  }
  cache.nodes.set(id, element);
  return id;
};
const roles: ElementRole[] = [
  "button",
  "link",
  "checkbox",
  "radio",
  "switch",
  "tab",
  "menuitem",
  "menuitemradio",
  "option",
  "gridcell",
  "combobox",
  "textbox",
  "searchbox",
  "spinbutton",
];
const selector =
  'a[href],button,input,textarea,select,summary,[contenteditable="true"],' +
  roles.map((role) => `[role="${role}"]`).join(",");
/**
 * Tag checks instead of `instanceof`: the sandbox lives in an iframe, and an
 * element from another realm is never an instance of this window's classes.
 */
export const isInput = (e: Element): e is HTMLInputElement =>
  e.tagName === "INPUT";
export const isTextArea = (e: Element): e is HTMLTextAreaElement =>
  e.tagName === "TEXTAREA";
export const isSelect = (e: Element): e is HTMLSelectElement =>
  e.tagName === "SELECT";
const inputType = (e: Element) => (isInput(e) ? e.type : "");
/** Password, file and hidden inputs are never observed or typed into. */
export const safe = (e: Element) =>
  !["password", "file", "hidden"].includes(inputType(e));
export function visible(e: Element): boolean {
  if (e.closest('[aria-hidden="true"],[inert]')) return false;
  if (typeof e.checkVisibility === "function")
    return e.checkVisibility({
      checkOpacity: true,
      checkVisibilityCSS: true,
    });
  const style = e.ownerDocument.defaultView?.getComputedStyle(e);
  return !!style && style.display !== "none" && style.visibility !== "hidden";
}
/** A practical accessible name: ARIA references, labels, text, then hints. */
export function accessibleName(
  e: Element | null,
  seen = new Set<Element>(),
): string {
  if (!e || seen.has(e)) return "";
  seen.add(e);
  const doc = e.ownerDocument;
  const referenced = (e.getAttribute("aria-labelledby") || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => accessibleName(doc.getElementById(id), seen))
    .filter(Boolean)
    .join(" ");
  if (referenced) return referenced;
  const label = e.getAttribute("aria-label");
  if (label) return label;
  const labels =
    isInput(e) || isTextArea(e) || isSelect(e)
      ? Array.from(e.labels ?? [])
          .map((l) => accessibleName(l, seen))
          .filter(Boolean)
          .join(" ")
      : "";
  if (labels) return labels;
  if (isInput(e) && ["button", "submit", "reset"].includes(e.type) && e.value)
    return e.value;
  const alt = e.getAttribute("alt");
  if (alt) return alt;
  if (e.tagName !== "INPUT") {
    const text = Array.from(e.childNodes)
      .map((n) =>
        n.nodeType === Node.TEXT_NODE
          ? n.textContent
          : n.nodeType === Node.ELEMENT_NODE &&
              (n as Element).getAttribute("aria-hidden") !== "true"
            ? accessibleName(n as Element, seen)
            : "",
      )
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (text) return text;
  }
  return e.getAttribute("title") || e.getAttribute("placeholder") || "";
}
export function roleOf(e: Element): ElementRole | null {
  const explicit = e.getAttribute("role");
  if (explicit && (roles as string[]).includes(explicit))
    return explicit as ElementRole;
  if (e.tagName === "BUTTON" || e.tagName === "SUMMARY") return "button";
  if (e.tagName === "A") return "link";
  if (e.tagName === "SELECT") return "combobox";
  if (e.tagName === "TEXTAREA" || (e as HTMLElement).isContentEditable)
    return "textbox";
  if (isInput(e)) {
    if (e.type === "checkbox" || e.type === "radio") return e.type;
    if (["button", "submit", "reset", "image"].includes(e.type))
      return "button";
    if (e.type === "search") return "searchbox";
    if (e.type === "number") return "spinbutton";
    if (["text", "email", "url", "tel"].includes(e.type)) return "textbox";
  }
  return null;
}
const disabled = (e: Element) =>
  e.matches(":disabled") || !!e.closest('[aria-disabled="true"]');
const formValue = (e: Element) =>
  isInput(e) || isTextArea(e) || isSelect(e) ? e.value : null;
/** Form values, viewport and location: anything a click could depend on. */
export function pageKey(doc: Document, win: Window): string {
  const cache = nodeCache(doc);
  return JSON.stringify([
    doc.location.href,
    win.scrollX,
    win.scrollY,
    win.innerWidth,
    win.innerHeight,
    Array.from(doc.querySelectorAll("input,textarea,select"))
      .filter(safe)
      .map((e) => [
        identify(cache, e),
        formValue(e),
        isInput(e) ? e.checked : null,
        isSelect(e) ? e.selectedIndex : null,
        disabled(e),
        isInput(e) || isTextArea(e) ? e.readOnly : null,
      ]),
  ]);
}
/** The selected target and its nearby context, compared right before a click. */
export function targetGuard(
  doc: Document,
  node: number | undefined,
): string | null {
  const e = node === undefined ? undefined : nodeCache(doc).nodes.get(node);
  if (!e?.isConnected || !visible(e)) return null;
  const scope =
    e.closest('form,dialog,[role="dialog"],article,li,tr,[role="row"]') ||
    e.parentElement;
  return JSON.stringify([
    node,
    roleOf(e),
    accessibleName(e),
    formValue(e),
    isInput(e) ? e.checked : null,
    isSelect(e) ? e.selectedIndex : null,
    isInput(e) || isTextArea(e) ? e.readOnly : null,
    disabled(e),
    e.getAttribute("aria-expanded"),
    e.getAttribute("aria-checked"),
    e.getAttribute("aria-selected"),
    e.getAttribute("href"),
    (scope as HTMLElement | null)?.innerText?.slice(0, 6000) || "",
  ]);
}
const MAX_ACTIONS = 250;
const SCROLL_DELTA = 480;
/** Visible text only: offscreen bodies and footers do not fill the context. */
export function visibleText(doc: Document, win: Window, limit = 6000) {
  const words: string[] = [];
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const range = doc.createRange();
  let node: Node | null;
  let length = 0;
  while ((node = walker.nextNode()) && length < limit) {
    const value = node.textContent?.trim() ?? "";
    const parent = node.parentElement;
    if (
      !value ||
      !parent ||
      parent.closest("script,style,noscript,template") ||
      !visible(parent)
    )
      continue;
    range.selectNodeContents(node);
    const r = range.getBoundingClientRect();
    if (
      r.width > 0 &&
      r.height > 0 &&
      r.bottom > 0 &&
      r.top < win.innerHeight &&
      r.right > 0 &&
      r.left < win.innerWidth
    ) {
      words.push(value);
      length += value.length;
    }
  }
  return words.join("\n").slice(0, limit);
}
/**
 * One atomic snapshot: visible controls, their names and current values, the
 * visible text, and freshness guards. Screenshots are never part of it.
 */
export function getElementTable(doc: Document, win: Window): PageSnapshot {
  const cache = nodeCache(doc);
  for (const [id, e] of cache.nodes) if (!e.isConnected) cache.nodes.delete(id);
  const actions: ActionCandidate[] = [];
  const elements: ElementRecord[] = [];
  const indexByNode = new Map<number, string>();
  for (const e of Array.from(doc.querySelectorAll(selector))) {
    if (!safe(e) || !visible(e) || disabled(e)) continue;
    const r = e.getBoundingClientRect();
    const x = r.x + r.width / 2;
    const y = r.y + r.height / 2;
    const role = roleOf(e);
    if (
      !role ||
      r.width <= 0 ||
      r.height <= 0 ||
      x < 0 ||
      y < 0 ||
      x >= win.innerWidth ||
      y >= win.innerHeight
    )
      continue;
    if (role === "gridcell" && e.querySelector('button,[role="button"]'))
      continue;
    if (actions.length >= MAX_ACTIONS) break;
    const node = identify(cache, e);
    const label = accessibleName(e) || role;
    const state: Pick<ActionCandidate, "checked" | "selected" | "expanded"> =
      {};
    for (const key of ["checked", "selected", "expanded"] as const) {
      const value = e.getAttribute(`aria-${key}`);
      if (value !== null) state[key] = value;
    }
    if (isInput(e) && ["checkbox", "radio"].includes(e.type))
      state.checked = String(e.checked);
    let record = elements.find((el) => el.index === indexByNode.get(node));
    if (!record) {
      record = {
        index: String(elements.length + 1),
        role,
        label,
        value: "",
        operations: [],
        ...state,
      };
      elements.push(record);
      indexByNode.set(node, record.index);
    }
    const base = { node, role, label, ...state };
    if (isSelect(e)) {
      const current = Array.from(e.selectedOptions)
        .map((o) => o.label)
        .join(", ");
      record.value = current;
      record.options = [];
      record.operations.push("SELECT");
      for (const o of Array.from(e.options)) {
        if (o.selected || o.disabled || o.closest("optgroup[disabled]"))
          continue;
        const option: SelectOption = {
          index: `${record.index}:${record.options.length + 1}`,
          label: o.label,
          value: o.value,
        };
        record.options.push(option);
        actions.push({
          ...base,
          id: `e${actions.length + 1}`,
          index: option.index,
          kind: "select",
          value: o.value,
          currentValue: current,
          label: `${label} → ${o.label}`,
        });
      }
      continue;
    }
    const readOnly =
      (isInput(e) || isTextArea(e) ? e.readOnly : false) ||
      e.getAttribute("aria-readonly") === "true";
    const editable =
      !readOnly &&
      (["textbox", "searchbox", "spinbutton"].includes(role) ||
        (role === "combobox" && ["INPUT", "TEXTAREA"].includes(e.tagName)));
    const value =
      formValue(e) ??
      ((e as HTMLElement).isContentEditable || role === "combobox"
        ? ((e as HTMLElement).innerText ?? "").trim()
        : "");
    record.value = value;
    actions.push({
      ...base,
      id: `e${actions.length + 1}`,
      index: record.index,
      kind: editable ? "fill" : "click",
      value,
    });
    const ops: TargetOperation[] = editable
      ? ["TYPE_TEXT", "CLICK"]
      : ["CLICK"];
    for (const op of ops)
      if (!record.operations.includes(op)) record.operations.push(op);
    if (editable)
      actions.push({
        ...base,
        id: `e${actions.length + 1}`,
        index: record.index,
        kind: "click",
        value,
        label: `Open ${label}`,
      });
  }
  const text = visibleText(doc, win);
  const height = doc.documentElement.scrollHeight;
  const key = pageKey(doc, win);
  const guards: Record<string, string> = {};
  for (const a of actions)
    if (a.node !== undefined && !(a.node in guards)) {
      const guard = targetGuard(doc, a.node);
      if (guard) guards[a.node] = guard;
    }
  const marker = JSON.stringify([
    doc.location.href,
    win.scrollX,
    win.scrollY,
    win.innerWidth,
    win.innerHeight,
    doc.title,
    text,
    actions,
    key,
  ]);
  const scrollable = win.scrollY + win.innerHeight < height - 2;
  if (scrollable)
    actions.push({
      id: "scroll_down",
      kind: "scroll",
      label: "Scroll down",
      delta: SCROLL_DELTA,
    });
  if (win.scrollY > 0)
    actions.push({
      id: "scroll_up",
      kind: "scroll",
      label: "Scroll up",
      delta: -SCROLL_DELTA,
    });
  actions.push({
    id: "wait",
    kind: "wait",
    label: "Wait for the page to update",
  });
  return {
    url: doc.location.href,
    title: doc.title,
    text,
    width: win.innerWidth,
    height: win.innerHeight,
    scroll: { y: win.scrollY, height },
    elements,
    actions,
    marker,
    pageKey: key,
    guards,
    omitted: Math.max(0, doc.querySelectorAll(selector).length - MAX_ACTIONS),
    observedAt: Date.now(),
  };
}
/** The table exactly as it is rendered for Jev and for the inspector. */
export function formatElementRow(el: ElementRecord): string {
  const value = el.value ? el.value : "empty";
  const flags = [
    el.checked !== undefined ? `checked=${el.checked}` : "",
    el.expanded !== undefined ? `expanded=${el.expanded}` : "",
    el.selected !== undefined ? `selected=${el.selected}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return `[${el.index}] ${el.role.padEnd(9)} ${el.label} · ${value}${flags ? ` · ${flags}` : ""}`;
}
export const formatElementTable = (elements: ElementRecord[]) =>
  elements.map(formatElementRow);
