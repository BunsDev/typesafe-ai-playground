import type { RunPayload } from "../api";
import { JevProviderError } from "../serverJev";
import type { ProviderUsage } from "../../types/usage";
import {
  DeltaStream,
  buildNativeRequest,
  resolveNativeBatch,
} from "./protocol";
import type {
  NativeAction,
  NativeExecution,
  NativeSnapshot,
  NativeReport,
  NativeUsage,
} from "./types";
export interface NativePort {
  observe(signal: AbortSignal): Promise<NativeSnapshot>;
  execute(
    actions: NativeAction[],
    signal: AbortSignal,
  ): Promise<NativeExecution[]>;
  verify(signal: AbortSignal): Promise<NativeReport["verification"]>;
}
export interface NativeOptions {
  goal: string;
  model: string;
  values?: Record<string, string>;
  signal: AbortSignal;
  transport: (payload: RunPayload, signal: AbortSignal) => Promise<unknown>;
  onUpdate?: (report: NativeReport) => void;
  maxCalls?: number;
  maxActions?: number;
}
const token = (v: unknown) =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : null;
export function nativeUsage(value: unknown): NativeUsage | null {
  if (!value || typeof value !== "object") return null;
  const data = value as {
    _playgroundUsage?: { inputTokens?: unknown; outputTokens?: unknown };
    usage?: { input_tokens?: unknown; output_tokens?: unknown };
  };
  const usage = data._playgroundUsage ?? data.usage;
  if (!usage) return null;
  return {
    inputTokens: token(
      data._playgroundUsage?.inputTokens ?? data.usage?.input_tokens,
    ),
    outputTokens: token(
      data._playgroundUsage?.outputTokens ?? data.usage?.output_tokens,
    ),
  };
}
/** The port owns observation/execution; only Jev chooses native actions. */
export async function runNativeBrowser(
  port: NativePort,
  options: NativeOptions,
): Promise<NativeReport> {
  const runStarted = performance.now();
  const report: NativeReport = {
    goal: options.goal,
    status: "running",
    reason: "",
    traces: [],
    verification: { passed: false, summary: "Not checked." },
    snapshot: null,
  };
  const stream = new DeltaStream(),
    completed = new Map<string, string>();
  let previousResults: NativeExecution[] = [],
    offset = 0,
    blocked = 0,
    idle = 0,
    waits = 0,
    actions = 0;
  const maxCalls = Math.min(60, Math.max(1, options.maxCalls ?? 40)),
    maxActions = Math.min(80, Math.max(1, options.maxActions ?? 48));
  const emit = () => {
    report.wallclockMs = Math.round(performance.now() - runStarted);
    options.onUpdate?.({ ...report, traces: [...report.traces] });
  };
  try {
    while (report.traces.length < maxCalls) {
      options.signal.throwIfAborted();
      const observed = await port.observe(options.signal);
      report.snapshot = observed;
      if (observed.challenge) {
        report.status = "blocked";
        report.reason = `Browser challenge: ${observed.challenge}`;
        break;
      }
      // Forget fulfilled field candidates locally; never replay old calls to Jev.
      const page = {
        ...observed,
        nodes: observed.nodes.filter(
          (n) =>
            n.kind === "click" ||
            completed.get(`${observed.documentId}:${n.id}`) !== n.value,
        ),
      };
      const delta = stream.next(observed, options.goal, offset);
      const request = buildNativeRequest(
        page,
        delta,
        options.goal,
        options.model,
        options.values,
        offset,
        previousResults.map((r) => ({
          operation: r.action.operation,
          target: r.action.target,
          status: r.status,
          detail: r.detail,
        })),
      );
      const trace = {
        cycle: report.traces.length + 1,
        request: request.payload,
        response: null as unknown,
        usage: null as NativeUsage | null,
        executed: 0,
        requestCharacters: JSON.stringify(request.payload).length,
        fullStateCharacters: JSON.stringify(observed).length,
        // Same goal, questions and result summary; only the update differs.
        baselineRequestCharacters: JSON.stringify({
          ...request.payload,
          state: {
            ...(request.payload.state as object),
            update: new DeltaStream().next(observed, options.goal, offset),
          },
        }).length,
        providerUsage: undefined as ProviderUsage | undefined,
        settled: false,
        latencyMs: 0,
        results: [] as NativeExecution[],
        error: undefined as string | undefined,
        executionError: undefined as string | undefined,
        plannedActions: [] as NativeAction[],
      };
      report.traces.push(trace);
      emit();
      const started = performance.now();
      let chosen: NativeAction[];
      try {
        trace.response = await options.transport(
          request.payload,
          options.signal,
        );
        trace.usage = nativeUsage(trace.response);
        trace.providerUsage = (
          trace.response as { _playgroundUsage?: ProviderUsage }
        )?._playgroundUsage;
        chosen = resolveNativeBatch(trace.response, request);
      } catch (error) {
        if (error instanceof JevProviderError) {
          trace.providerUsage = error.usage;
          trace.usage = error.usage
            ? nativeUsage({ _playgroundUsage: error.usage })
            : null;
        }
        trace.error =
          error instanceof Error ? error.message : "Jev request failed.";
        report.status = options.signal.aborted ? "stopped" : "failed";
        report.reason = trace.error;
        break;
      } finally {
        trace.latencyMs = performance.now() - started;
        trace.settled = true;
      }
      options.signal.throwIfAborted();
      const control = chosen[0]?.operation;
      if (control === "DONE" || control === "BLOCKED") {
        report.verification = await port.verify(options.signal);
        if (report.verification.passed) {
          report.status = "done";
          report.reason = report.verification.summary;
          break;
        }
        if (++blocked >= 2) {
          report.status = "blocked";
          report.reason = `Completion not verified: ${report.verification.summary}`;
          break;
        }
        // A command being applied is not proof that it satisfied the goal.
        // Reopen previously filled fields so Jev can repair a rejected result.
        completed.clear();
        offset = 0;
        previousResults = [
          {
            action: chosen[0],
            status: "rejected",
            detail: report.verification.summary,
            elapsedMs: 0,
          },
        ];
        emit();
        continue;
      }
      blocked = 0;
      if (!chosen.length) {
        if (++idle >= Math.max(4, Math.ceil(page.nodes.length / 4))) {
          report.status = "blocked";
          report.reason =
            "No native command chosen after inspecting the bounded candidate windows.";
          break;
        }
        offset += 4;
        previousResults = [];
        emit();
        continue;
      }
      if (actions + chosen.length > maxActions) {
        report.status = "blocked";
        report.reason = "Native action budget reached.";
        break;
      }
      if (control === "WAIT") {
        if (++waits > 6) {
          report.status = "blocked";
          report.reason = "Loading did not resolve after six bounded waits.";
          break;
        }
      } else waits = 0;
      trace.plannedActions = chosen;
      emit();
      try {
        trace.results = await port.execute(chosen, options.signal);
      } catch (error) {
        trace.executionError =
          error instanceof Error ? error.message : "Browser execution failed.";
        throw Error(`Batch outcome unknown: ${trace.executionError}`);
      }
      previousResults = trace.results;
      // Count only executed actions, never proposed or discarded batch members.
      trace.executed = trace.results.filter(
        (r) => r.status === "executed",
      ).length;
      actions += trace.executed;
      for (const result of trace.results)
        if (
          result.status === "executed" &&
          result.action.target &&
          ["TYPE_TEXT", "SELECT"].includes(result.action.operation)
        )
          completed.set(
            `${result.action.documentId}:${result.action.target}`,
            (result.action.text ?? result.action.value)!,
          );
      idle = trace.executed ? 0 : idle + 1;
      if (idle >= 4) {
        report.status = "blocked";
        report.reason =
          "Four batches could not execute; inspect freshness and target evidence.";
        break;
      }
      offset = 0;
      emit();
    }
    if (report.status === "running") {
      report.status = "blocked";
      report.reason = "Native decision budget reached.";
    }
  } catch (error) {
    report.status = options.signal.aborted ? "stopped" : "failed";
    report.reason =
      error instanceof Error ? error.message : "Native browser run failed.";
  }
  emit();
  return report;
}
