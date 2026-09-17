import { nativeBrowserDom as runtime } from "./dom-runtime.js";
import type {
  NativeAction,
  NativeExecution,
  NativeSnapshot,
  NativeVerification,
} from "./types";
export type NativeDomCommand =
  | { type: "observe" }
  | { type: "execute"; actions: NativeAction[] }
  | { type: "verify"; expected: NativeVerification };
export type NativeDomReply =
  NativeSnapshot | NativeExecution[] | { passed: boolean; summary: string };
/** Typed facade; the self-contained runtime is also injected verbatim by browser-use. */
export const nativeBrowserDom = runtime as (
  command: NativeDomCommand,
) => Promise<NativeDomReply>;
