import { test, expect } from "@playwright/test";
import { nativeBrowserDom } from "../../lib/nativeBrowser/dom";
import {
  nativeBenchmarks,
  nativeBenchmarkHtml,
  benchmarkValues,
  benchmarkVerification,
} from "../../lib/nativeBrowser/benchmarks";
import { runNativeBrowser } from "../../lib/nativeBrowser/loop";
import type {
  NativeSnapshot,
  NativeExecution,
  NativeReport,
} from "../../lib/nativeBrowser/types";

for (const task of Object.values(nativeBenchmarks)) {
  test(`${task.id} staged benchmark completes through native batches and verifies its saved review`, async ({
    page,
  }) => {
    // Match the local browser's benchmark viewport independently of the app UI.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.route("https://native.example.test/**", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: nativeBenchmarkHtml(task),
      }),
    );
    await page.goto("https://native.example.test/browser-agent-benchmark");
    const report = await runNativeBrowser(
      {
        observe: async () =>
          (await page.evaluate(nativeBrowserDom, {
            type: "observe",
          })) as NativeSnapshot,
        execute: async (actions) =>
          (await page.evaluate(nativeBrowserDom, {
            type: "execute",
            actions,
          })) as NativeExecution[],
        verify: async () =>
          (await page.evaluate(nativeBrowserDom, {
            type: "verify",
            expected: benchmarkVerification(task),
          })) as NativeReport["verification"],
      },
      {
        goal: task.goal,
        model: "scripted-test-policy",
        values: benchmarkValues(task),
        signal: new AbortController().signal,
        transport: async (payload) => {
          const update = (
            payload.state as { update: { text: { added: string[] } } }
          ).update;
          return {
            answers: Object.fromEntries(
              Object.entries(payload.questions).map(([head, question]) => {
                const criteria = Object.entries(
                  question.criteria as Record<string, string>,
                );
                const field = criteria.find(([, command]) =>
                  task.fields.some(
                    (f) =>
                      command ===
                        `TYPE_TEXT ${f.label}: ${JSON.stringify(f.value)}` ||
                      command === `SELECT ${f.label}: ${f.value}`,
                  ),
                )?.[0];
                const choice =
                  head === "action_1" &&
                  update.text.added.includes(task.confirmation)
                    ? "DONE"
                    : (field ??
                      (head === "action_1"
                        ? criteria.find(([, command]) =>
                            [
                              "CLICK button Continue",
                              "CLICK button Save draft",
                            ].includes(command),
                          )?.[0]
                        : undefined) ??
                      "SKIP");
                return [head, { type: "choice", choice }];
              }),
            ),
          };
        },
      },
    );
    expect(report.status, report.reason).toBe("done");
    expect(report.traces.reduce((sum, trace) => sum + trace.executed, 0)).toBe(
      task.requiredActions,
    );
    expect(report.traces).toHaveLength(7);
    expect(
      report.traces
        .slice(1)
        .every((trace) => (trace.request.state as any).update.kind === "delta"),
    ).toBe(true);
    expect(
      (report.traces[2].request.state as any).update.removed.length,
    ).toBeGreaterThan(0);
    await expect(
      page.getByRole("region", { name: "Saved draft" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Edit draft" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Edit draft" }).click();
    await expect(
      page.getByText("Section 1 of 3", { exact: true }),
    ).toBeVisible();
    const verification = (await page.evaluate(nativeBrowserDom, {
      type: "verify",
      expected: benchmarkVerification(task),
    })) as NativeReport["verification"];
    expect(verification.passed).toBe(false); // Editing clears the saved confirmation.
  });
}
