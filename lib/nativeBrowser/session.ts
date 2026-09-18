import {
  createLocalBrowser,
  getLocalBrowser,
  closeLocalBrowser,
} from "../localBrowser";
import { serverJevTransport } from "../serverJev";
import {
  nativeBenchmarks,
  benchmarkVerification,
  benchmarkValues,
} from "./benchmarks";
import { runNativeBrowser } from "./loop";
import type {
  NativeReport,
  NativeSnapshot,
  NativeExecution,
  NativeVerification,
} from "./types";
export interface NativeSession {
  id: string;
  task: "pc" | "profile" | "newegg";
  goal: string;
  url: string;
  model: string;
  expected: NativeVerification;
  values: Record<string, string>;
  report: NativeReport | null;
  busy: boolean;
  used: boolean;
  error: string | null;
  controller: AbortController | null;
}
const store = globalThis as typeof globalThis & {
  nativeBrowserRuns?: Map<string, NativeSession>;
};
const runs = (store.nativeBrowserRuns ??= new Map());
function fields(value: unknown): Record<string, string> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length > 24
  )
    throw Error("Expected fields must be a small object.");
  const pairs = Object.entries(value);
  if (
    pairs.some(
      ([k, v]) =>
        !k.trim() ||
        k.length > 160 ||
        typeof v !== "string" ||
        !v ||
        v.length > 200,
    )
  )
    throw Error("Field labels and exact values must be short strings.");
  return Object.fromEntries(pairs) as Record<string, string>;
}
export function createNativeSession(input: unknown, appOrigin: string) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw Error("Invalid native task.");
  const data = input as Record<string, unknown>,
    task = data.task;
  if (task !== "pc" && task !== "profile" && task !== "newegg")
    throw Error("Choose a supported native task.");
  let goal: string,
    url: string,
    expected: NativeVerification,
    values: Record<string, string>;
  if (task === "newegg") {
    if (
      typeof data.goal !== "string" ||
      !data.goal.trim() ||
      data.goal.length > 2500
    )
      throw Error("Provide a native browser goal.");
    goal = data.goal.trim();
    const target = new URL(
      typeof data.url === "string" ? data.url : "https://www.newegg.com/",
    );
    if (
      target.origin !== "https://www.newegg.com" ||
      target.username ||
      target.password
    )
      throw Error("This local native task is limited to Newegg.");
    url = target.href;
    const contract = data.expected as
      { fields?: unknown; text?: unknown } | undefined;
    expected = { fields: fields(contract?.fields ?? {}), text: [] };
    if (
      !Array.isArray(contract?.text) ||
      contract.text.length > 10 ||
      contract.text.some((v) => typeof v !== "string" || !v || v.length > 200)
    )
      throw Error("Provide short confirmation text checks.");
    expected.text = contract.text;
    if (!Object.keys(expected.fields).length && !expected.text.length)
      throw Error("Provide an explicit completion check for this goal.");
    values = fields(data.values ?? {});
  } else {
    const spec = nativeBenchmarks[task];
    goal = spec.goal;
    url = `${appOrigin}/browser-agent-benchmark?task=${task}`;
    expected = benchmarkVerification(spec);
    values = benchmarkValues(spec);
  }
  const size = (v: unknown, fallback: number, min: number, max: number) =>
    typeof v === "number" && Number.isFinite(v)
      ? Math.max(min, Math.min(max, Math.round(v)))
      : fallback;
  const id = createLocalBrowser(
    {
      width: size(data.width, 1440, 360, 2560),
      height: size(data.height, 900, 240, 1600),
    },
    new URL(url).origin,
  );
  const session: NativeSession = {
    id,
    task,
    goal,
    url,
    expected,
    values,
    model:
      typeof data.model === "string" && data.model.length <= 100
        ? data.model
        : "jev-latest",
    report: null,
    busy: false,
    used: false,
    error: null,
    controller: null,
  };
  runs.set(id, session);
  const expiry = setTimeout(() => closeNativeSession(id), 10 * 60_000);
  expiry.unref();
  return session;
}
export function getNativeSession(id: string) {
  const session = runs.get(id);
  if (!session) throw Error("Native session not found. Start a new task.");
  return session;
}
export function closeNativeSession(id: string) {
  runs.get(id)?.controller?.abort();
  closeLocalBrowser(id);
  runs.delete(id);
}
export async function executeNativeSession(
  id: string,
  signal: AbortSignal,
  key: string | null,
) {
  const session = getNativeSession(id);
  if (session.busy || session.used)
    throw Error("Each native session runs once. Start a new task.");
  session.busy = true;
  session.used = true;
  session.controller = new AbortController();
  const bound = AbortSignal.any([
      signal,
      session.controller.signal,
      AbortSignal.timeout(240_000),
    ]),
    browser = getLocalBrowser(id);
  browser.busy = true;
  try {
    browser.phase = "Opening native task";
    await browser.navigateNative(session.url, bound);
    session.report = await runNativeBrowser(
      {
        observe: async (signal) =>
          (await browser.native({ type: "observe" }, signal)) as NativeSnapshot,
        execute: async (actions, signal) =>
          (await browser.native(
            { type: "execute", actions },
            signal,
          )) as NativeExecution[],
        verify: async (signal) =>
          (await browser.native(
            { type: "verify", expected: session.expected },
            signal,
          )) as NativeReport["verification"],
      },
      {
        goal: session.goal,
        model: session.model,
        values: session.values,
        signal: bound,
        transport: (payload, signal) =>
          serverJevTransport(payload, signal, key),
        onUpdate: (report) => {
          session.report = report;
          browser.phase =
            report.status === "running"
              ? `Native cycle ${report.traces.length}`
              : report.reason;
        },
      },
    );
    return session.report;
  } catch (error) {
    session.error =
      error instanceof Error ? error.message : "Native task failed.";
    throw error;
  } finally {
    session.busy = false;
    browser.busy = false;
  }
}
