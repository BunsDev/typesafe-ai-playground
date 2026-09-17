import type { ActionCandidate, PageSnapshot } from "../types/browserAgent";
import {
  accessibleName,
  getElementTable,
  isInput,
  isSelect,
  isTextArea,
  nodeCache,
  pageKey,
  targetGuard,
  visible,
} from "./getElementTable";
import type { ExecutionPoint } from "./actions";
/**
 * Target validation: a decision refers to an observed page. Before anything
 * executes, recheck that the document still matches, resolve the target's
 * current geometry, and reject stale, hidden, disabled or covered targets.
 */
export type RejectionReason =
  | "stale"
  | "detached"
  | "hidden"
  | "disabled"
  | "readonly"
  | "offscreen"
  | "covered"
  | "invalid_option";
export interface Rejection {
  ok: false;
  reason: RejectionReason;
  detail: string;
}
export type Resolution = ({ ok: true } & ExecutionPoint) | Rejection;
/**
 * Clicks and selects compare the form/viewport key plus the target's own
 * guard, so unrelated visible content may change. Everything else, including
 * text generation and DONE, needs the full semantic marker to match.
 */
export function isFresh(
  doc: Document,
  win: Window,
  page: PageSnapshot,
  action?: ActionCandidate | null,
): boolean {
  if (action && (action.kind === "click" || action.kind === "select")) {
    if (typeof action.node !== "number") return false;
    return (
      pageKey(doc, win) === page.pageKey &&
      targetGuard(doc, action.node) === (page.guards[action.node] ?? null)
    );
  }
  return getElementTable(doc, win).marker === page.marker;
}
const describe = (e: Element) => {
  const dialog = e.closest('dialog,[role="dialog"],[role="alertdialog"]');
  if (dialog) return `dialog “${accessibleName(dialog) || "untitled"}”`;
  const control = e.closest("button,a,[role],input,select,textarea,label");
  const named = control ?? e;
  const name = accessibleName(named);
  return `${named.tagName.toLowerCase()}${name ? ` “${name}”` : ""}`;
};
/** Resolves current geometry and hit-tests the centre point right before input. */
export function resolveTarget(
  doc: Document,
  win: Window,
  action: ActionCandidate,
): Resolution {
  if (typeof action.node !== "number")
    return { ok: false, reason: "detached", detail: "No observed node." };
  const element = nodeCache(doc).nodes.get(action.node);
  if (!element?.isConnected)
    return {
      ok: false,
      reason: "detached",
      detail: "The observed element left the document.",
    };
  if (!visible(element))
    return {
      ok: false,
      reason: "hidden",
      detail: "The element is no longer visible.",
    };
  if (
    element.matches(":disabled") ||
    element.closest('[aria-disabled="true"],[inert]')
  )
    return {
      ok: false,
      reason: "disabled",
      detail: "The element is disabled or inert.",
    };
  if (
    action.kind === "fill" &&
    (((isInput(element) || isTextArea(element)) && element.readOnly) ||
      element.getAttribute("aria-readonly") === "true")
  )
    return { ok: false, reason: "readonly", detail: "The field is read-only." };
  const r = element.getBoundingClientRect();
  const x = r.x + r.width / 2;
  const y = r.y + r.height / 2;
  if (
    !r.width ||
    !r.height ||
    x < 0 ||
    y < 0 ||
    x >= win.innerWidth ||
    y >= win.innerHeight
  )
    return {
      ok: false,
      reason: "offscreen",
      detail: "The element's centre is outside the viewport.",
    };
  if (action.kind === "select") {
    if (
      !isSelect(element) ||
      !Array.from(element.options).some(
        (o) =>
          o.value === action.value &&
          !o.disabled &&
          !o.closest("optgroup[disabled]"),
      )
    )
      return {
        ok: false,
        reason: "invalid_option",
        detail: "The observed option is no longer offered.",
      };
    return { ok: true, x, y, element };
  }
  const hit = doc.elementFromPoint(x, y);
  if (!hit || !element.contains(hit))
    return {
      ok: false,
      reason: "covered",
      detail: hit
        ? `Covered by ${describe(hit)}.`
        : "Nothing is rendered at the element's centre.",
    };
  return { ok: true, x, y, element };
}
