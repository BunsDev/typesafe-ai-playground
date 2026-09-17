import { test } from "node:test";
import assert from "node:assert/strict";
import { runNativeBrowser } from "../lib/nativeBrowser/loop";
import { JevProviderError } from "../lib/serverJev";
import type { NativeSnapshot } from "../lib/nativeBrowser/types";
const initial = (): NativeSnapshot => ({
  documentId: "d",
  revision: 0,
  url: "https://example.test",
  title: "Form",
  text: ["Form"],
  scroll: { y: 0, height: 500, viewport: 500 },
  challenge: null,
  nodes: [
    {
      id: "n1",
      role: "textbox",
      label: "Name",
      value: "",
      kind: "fill",
      guard: "g1",
      group: "form",
    },
    {
      id: "n2",
      role: "textbox",
      label: "Email",
      value: "",
      kind: "fill",
      guard: "g2",
      group: "form",
    },
  ],
});
test("native loop batches fields, forgets fulfilled candidates, and checks completion independently", async () => {
  let page = initial();
  let executions = 0;
  const requests: any[] = [];
  const result = await runNativeBrowser(
    {
      observe: async () => page,
      execute: async (actions) => {
        executions++;
        for (const a of actions)
          page.nodes.find((n) => n.id === a.target)!.value = a.text!;
        return actions.map((action) => ({
          action,
          status: "executed",
          detail: "filled",
          elapsedMs: 1,
        }));
      },
      verify: async () => ({
        passed: page.nodes.every((n) => n.value),
        summary: "Both fields match.",
      }),
    },
    {
      goal: 'Set Name to "Ada" and Email to "ada@example.test"',
      values: { Name: "Ada", Email: "ada@example.test" },
      model: "jev-latest",
      signal: new AbortController().signal,
      transport: async (payload) => {
        requests.push(payload);
        return {
          answers: Object.fromEntries(
            Object.entries(payload.questions).map(([head, q]) => [
              head,
              { type: "choice", choice: requests.length === 1 ? "T1" : "DONE" },
            ]),
          ),
          usage: { input_tokens: 100, output_tokens: 20 },
        };
      },
    },
  );
  assert.equal(result.status, "done");
  assert.equal(executions, 1);
  assert.equal(result.traces[0].executed, 2);
  assert.equal(requests[1].state.update.kind, "delta");
  assert.equal(Object.keys(requests[1].questions).length, 1);
  assert.ok(!("history" in requests[1].state));
  assert.deepEqual(requests[1].state.update.removed, []);
  assert.equal(requests[1].state.update.changed.length, 2);
  assert.ok(result.traces.every((t) => t.settled));
  assert.ok(
    result.traces[1].baselineRequestCharacters! >
      result.traces[1].requestCharacters,
  );
});
test("a browser challenge pauses before any model call or action", async () => {
  let calls = 0;
  const result = await runNativeBrowser(
    {
      observe: async () => ({
        ...initial(),
        challenge: "Verify you are human",
      }),
      execute: async () => {
        throw Error("must not execute");
      },
      verify: async () => ({ passed: false, summary: "Missing" }),
    },
    {
      goal: "Fill form",
      model: "jev-latest",
      signal: new AbortController().signal,
      transport: async () => {
        calls++;
        return {};
      },
    },
  );
  assert.equal(result.status, "blocked");
  assert.equal(calls, 0);
});
test("provider failure is retained and never becomes local policy success", async () => {
  const result = await runNativeBrowser(
    {
      observe: async () => initial(),
      execute: async () => [],
      verify: async () => ({ passed: false, summary: "Missing" }),
    },
    {
      goal: "Fill form",
      model: "jev-latest",
      signal: new AbortController().signal,
      transport: async () => {
        throw new JevProviderError("HTTP 402", 402, {
          inputTokens: null,
          outputTokens: null,
          status: 402,
          attempted: true,
          retryAt: null,
        });
      },
    },
  );
  assert.equal(result.status, "failed");
  assert.deepEqual(result.traces[0].usage, {
    inputTokens: null,
    outputTokens: null,
  });
  assert.equal(result.traces[0].providerUsage?.status, 402);
  assert.equal(result.traces[0].executed, 0);
  assert.match(result.reason, /402/);
});

test("unverified DONE receives one fresh observation and never becomes success", async () => {
  let observations = 0,
    checks = 0;
  const result = await runNativeBrowser(
    {
      observe: async () => {
        observations++;
        return { ...initial(), nodes: [] };
      },
      execute: async () => {
        throw Error("No actions authorized");
      },
      verify: async () => {
        checks++;
        return { passed: false, summary: "Missing confirmation" };
      },
    },
    {
      goal: "Fill form",
      model: "jev-latest",
      signal: new AbortController().signal,
      transport: async () => ({
        answers: { action_1: { type: "choice", choice: "DONE" } },
      }),
    },
  );
  assert.equal(result.status, "blocked");
  assert.equal(observations, 2);
  assert.equal(checks, 2);
  assert.equal(result.verification.passed, false);
});

test("cancellation after a decision cannot execute its chosen action", async () => {
  const controller = new AbortController();
  let actions = 0;
  const result = await runNativeBrowser(
    {
      observe: async () => initial(),
      execute: async () => {
        actions++;
        return [];
      },
      verify: async () => ({ passed: false, summary: "Missing" }),
    },
    {
      goal: 'Name "Ada"',
      model: "jev-latest",
      signal: controller.signal,
      transport: async () => {
        controller.abort();
        return {
          answers: {
            action_1: { type: "choice", choice: "T1" },
            action_2: { type: "choice", choice: "SKIP" },
          },
        };
      },
    },
  );
  assert.equal(result.status, "stopped");
  assert.equal(actions, 0);
});

test("skipped candidate windows can reach a required field beyond the first sixteen controls", async () => {
  let filled = false;
  const page = {
    ...initial(),
    nodes: Array.from({ length: 29 }, (_, i) => ({
      ...initial().nodes[0],
      id: `f${i}`,
      label: i === 28 ? "Last" : `Field ${i}`,
    })),
  };
  const result = await runNativeBrowser(
    {
      observe: async () => page,
      execute: async (actions) => {
        assert.equal(actions.length, 1);
        assert.equal(actions[0].target, "f28");
        page.nodes[28].value = "Ada";
        filled = true;
        return actions.map((action) => ({
          action,
          status: "executed",
          detail: "Filled",
          elapsedMs: 1,
        }));
      },
      verify: async () => ({
        passed: filled,
        summary: "Required field checked",
      }),
    },
    {
      goal: "Complete the form",
      values: { Last: "Ada" },
      model: "jev-latest",
      signal: new AbortController().signal,
      maxCalls: 12,
      transport: async (payload) => ({
        answers: Object.fromEntries(
          Object.entries(payload.questions).map(([head, question]) => [
            head,
            {
              type: "choice",
              choice:
                filled && head === "action_1"
                  ? "DONE"
                  : (Object.entries(question.criteria ?? {}).find(
                      ([, text]) => text === 'TYPE_TEXT Last: "Ada"',
                    )?.[0] ?? "SKIP"),
            },
          ]),
        ),
      }),
    },
  );
  assert.equal(result.status, "done");
  assert.equal(result.traces.length, 9);
});

test("lost batch acknowledgements preserve planned commands and report an unknown outcome", async () => {
  const result = await runNativeBrowser(
    {
      observe: async () => initial(),
      execute: async () => {
        throw Error("Browser disconnected after dispatch");
      },
      verify: async () => ({ passed: false, summary: "Not checked" }),
    },
    {
      goal: 'Name "Ada"',
      model: "jev-latest",
      signal: new AbortController().signal,
      transport: async () => ({
        answers: {
          action_1: { type: "choice", choice: "T1" },
          action_2: { type: "choice", choice: "SKIP" },
        },
        usage: { input_tokens: 10, output_tokens: 10 },
      }),
    },
  );
  assert.equal(result.status, "failed");
  assert.match(result.reason, /outcome unknown/);
  assert.equal(result.traces[0].plannedActions?.length, 1);
  assert.match(result.traces[0].executionError!, /disconnected/);
  assert.equal(result.traces[0].executed, 0);
});
