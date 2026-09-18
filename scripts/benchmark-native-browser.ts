/** Reproducible real-browser tasks; --scripted proves mechanics, --live measures Jev. */
import { createServer } from "node:http";
import { writeFile } from "node:fs/promises";
import {
  createLocalBrowser,
  getLocalBrowser,
  closeLocalBrowser,
} from "../lib/localBrowser";
import {
  nativeBenchmarks,
  nativeBenchmarkHtml,
  benchmarkValues,
  benchmarkVerification,
} from "../lib/nativeBrowser/benchmarks";
import { runNativeBrowser } from "../lib/nativeBrowser/loop";
import { nativeMetrics } from "../lib/nativeBrowser/protocol";
import { serverJevTransport } from "../lib/serverJev";
import type {
  NativeSnapshot,
  NativeExecution,
  NativeReport,
} from "../lib/nativeBrowser/types";
import type { RunPayload } from "../lib/api";
async function main() {
  const args = process.argv.slice(2),
    live = args.includes("--live"),
    scripted = args.includes("--scripted");
  if (live === scripted)
    throw Error(
      "Choose exactly one of --live or --scripted. Scripted runs do not measure model tokens.",
    );
  const taskArg = args.find((a) => a.startsWith("--task="))?.slice(7) ?? "all";
  if (!["pc", "profile", "all"].includes(taskArg))
    throw Error("Task must be pc, profile, or all.");
  const output =
    args.find((a) => a.startsWith("--output="))?.slice(9) ??
    `/tmp/jev-native-${live ? "live" : "scripted"}-${Date.now()}.json`;
  const model =
    args.find((a) => a.startsWith("--model="))?.slice(8) ?? "jev-latest";
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const task = url.searchParams.get("task");
    if (
      url.pathname !== "/browser-agent-benchmark" ||
      (task !== "pc" && task !== "profile")
    ) {
      response.writeHead(404);
      response.end();
      return;
    }
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end(nativeBenchmarkHtml(nativeBenchmarks[task]));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw Error("No benchmark listener.");
  const origin = `http://127.0.0.1:${address.port}`;
  const runs: object[] = [];
  try {
    for (const key of (taskArg === "all" ? ["pc", "profile"] : [taskArg]) as (
      "pc" | "profile"
    )[]) {
      const spec = nativeBenchmarks[key],
        id = createLocalBrowser({ width: 1440, height: 900 }, origin),
        browser = getLocalBrowser(id),
        signal = AbortSignal.timeout(240_000);
      const started = performance.now();
      try {
        await browser.navigateNative(
          `${origin}/browser-agent-benchmark?task=${key}`,
          signal,
        );
        const choose = async (payload: RunPayload) => {
          const update = (payload.state as any).update,
            done = update.text.added.includes(spec.confirmation);
          const answers = Object.fromEntries(
            Object.entries(payload.questions).map(([head, q]) => {
              const criteria = q.criteria as Record<string, string>;
              let choice =
                done && head === "action_1"
                  ? "DONE"
                  : Object.entries(criteria).find(([, text]) =>
                      spec.fields.some(
                        (f) =>
                          text ===
                            `TYPE_TEXT ${f.label}: ${JSON.stringify(f.value)}` ||
                          text === `SELECT ${f.label}: ${f.value}`,
                      ),
                    )?.[0];
              if (!choice)
                choice =
                  head === "action_1"
                    ? (Object.entries(criteria).find(([, text]) =>
                        [
                          "CLICK button Continue",
                          "CLICK button Save draft",
                        ].includes(text),
                      )?.[0] ?? "SKIP")
                    : "SKIP";
              return [
                head,
                {
                  type: "choice",
                  choice,
                  confidence: 1,
                  probabilities: { [choice]: 1 },
                },
              ];
            }),
          );
          return { model: "scripted-test-policy", answers };
        };
        const report = await runNativeBrowser(
          {
            observe: async (signal) =>
              (await browser.native(
                { type: "observe" },
                signal,
              )) as NativeSnapshot,
            execute: async (actions, signal) =>
              (await browser.native(
                { type: "execute", actions },
                signal,
              )) as NativeExecution[],
            verify: async (signal) =>
              (await browser.native(
                { type: "verify", expected: benchmarkVerification(spec) },
                signal,
              )) as NativeReport["verification"],
          },
          {
            goal: spec.goal,
            values: benchmarkValues(spec),
            model,
            signal,
            transport: live
              ? (payload, signal) => serverJevTransport(payload, signal)
              : choose,
          },
        );
        const metrics = nativeMetrics(
            report.traces,
            live ? "live-jev" : "scripted",
          ),
          measured =
            live && report.status === "done" && metrics.outputTokens !== null;
        const run = {
          task: key,
          benchmarkVersion: spec.version,
          policySource: live ? "live-jev" : "scripted",
          synthetic: true,
          expectedActions: spec.requiredActions,
          reportedComparisonTarget: spec.targetOutputTokens,
          comparisonSource:
            "User-reported BetterWrite figures; different tasks and environment.",
          comparison: measured
            ? metrics.outputTokens! <= spec.targetOutputTokens
              ? "within-target"
              : "above-target"
            : "not-measured",
          wallclockMs: Math.round(performance.now() - started),
          metrics,
          report,
        };
        runs.push(run);
        console.log(
          JSON.stringify({
            task: key,
            status: report.status,
            reason: report.reason,
            policySource: run.policySource,
            comparison: run.comparison,
            metrics,
          }),
        );
        if (report.status !== "done") {
          process.exitCode = 1;
          if (live) break;
        }
      } finally {
        closeLocalBrowser(id);
      }
    }
  } finally {
    server.close();
    await writeFile(
      output,
      JSON.stringify(
        { schemaVersion: 1, generatedAt: new Date().toISOString(), runs },
        null,
        2,
      ),
    );
    console.log(`Report: ${output}`);
  }
}
void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Benchmark failed.");
  process.exitCode = 1;
});
