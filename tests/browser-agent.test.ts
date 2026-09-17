import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePayload } from "../lib/api";
import { buildDecisionPayload, decideWithJev, resolveDecision } from "../lib/callJev";
import { buildActionSpace } from "../lib/actions";
import {
  buildSpanPayload,
  parseTextHelperOutput,
  spanCandidates,
} from "../lib/textHelper";
import {
  describeCycle,
  finishCycle,
  recordDecision,
  startCycle,
} from "../lib/logStep";
import type { PageSnapshot } from "../types/browserAgent";
import { createAgentState } from "../lib/agentLoop";
import { analyzeRun, formatDebugReport } from "../lib/browserAgentDiagnostics";
/** A hand-built observation of a small search form, no DOM needed. */
const page = (): PageSnapshot => ({
  url: "about:srcdoc",
  title: "Skyline · Search flights",
  text: "Where next?\nTrip type\nWhere from?\nSearch flights",
  width: 1000,
  height: 700,
  scroll: { y: 0, height: 700 },
  elements: [
    {
      index: "1",
      role: "combobox",
      label: "Trip type",
      value: "Round trip",
      operations: ["SELECT"],
      options: [{ index: "1:1", label: "One way", value: "one-way" }],
    },
    {
      index: "2",
      role: "combobox",
      label: "Where from?",
      value: "",
      operations: ["TYPE_TEXT", "CLICK"],
      expanded: "false",
    },
    {
      index: "3",
      role: "combobox",
      label: "Where to?",
      value: "",
      operations: ["TYPE_TEXT", "CLICK"],
      expanded: "false",
    },
    {
      index: "4",
      role: "button",
      label: "Search flights",
      value: "",
      operations: ["CLICK"],
    },
  ],
  actions: [
    {
      id: "e1",
      index: "1:1",
      node: 1,
      kind: "select",
      role: "combobox",
      label: "Trip type → One way",
      value: "one-way",
      currentValue: "Round trip",
    },
    {
      id: "e2",
      index: "2",
      node: 2,
      kind: "fill",
      role: "combobox",
      label: "Where from?",
      value: "",
      expanded: "false",
    },
    {
      id: "e3",
      index: "2",
      node: 2,
      kind: "click",
      role: "combobox",
      label: "Open Where from?",
      value: "",
      expanded: "false",
    },
    {
      id: "e4",
      index: "3",
      node: 3,
      kind: "fill",
      role: "combobox",
      label: "Where to?",
      value: "",
      expanded: "false",
    },
    {
      id: "e5",
      index: "3",
      node: 3,
      kind: "click",
      role: "combobox",
      label: "Open Where to?",
      value: "",
      expanded: "false",
    },
    {
      id: "e6",
      index: "4",
      node: 4,
      kind: "click",
      role: "button",
      label: "Search flights",
      value: "",
    },
    { id: "wait", kind: "wait", label: "Wait for the page to update" },
  ],
  marker: "m1",
  pageKey: "k1",
  guards: {},
  omitted: 0,
  observedAt: 0,
});
const goal =
  "Find one-way flights from Zurich to London on September 20, 2026.";
test("the action space offers only compatible targets per operation", () => {
  const space = buildActionSpace(page());
  assert.deepEqual(Object.keys(space.targets.CLICK!), ["2", "3", "4"]);
  assert.deepEqual(Object.keys(space.targets.TYPE_TEXT!), ["2", "3"]);
  assert.deepEqual(Object.keys(space.targets.SELECT!), ["1:1"]);
  assert.equal(space.controls.WAIT?.id, "wait");
  assert.equal(space.controls.SCROLL_DOWN, undefined);
});
test("one request carries the operation and every speculative target head", () => {
  const request = buildDecisionPayload(page(), goal, [], "jev-latest");
  const payload = validatePayload(request.payload);
  assert.deepEqual(Object.keys(payload.questions), [
    "operation",
    "click_target",
    "type_text_target",
  ]);
  assert.deepEqual(Object.keys(payload.questions.operation.criteria!), [
    "CLICK",
    "TYPE_TEXT",
    "SELECT",
    "WAIT",
    "DONE",
    "BLOCKED",
  ]);
  // A head with a single candidate is resolved locally: the API needs two.
  assert.deepEqual(request.singletons, { SELECT: "1:1" });
  const state = payload.state as { element_table: string[] };
  assert.equal(
    state.element_table[1],
    "[2] combobox  Where from? · empty · expanded=false",
  );
  assert.match(
    payload.questions.type_text_target.instructions,
    /assumes the next operation is TYPE_TEXT/,
  );
});
test("only the head matching the chosen operation executes", () => {
  const request = buildDecisionPayload(page(), goal, [], "jev-latest");
  const decision = resolveDecision(
    {
      answers: {
        operation: {
          type: "choice",
          choice: "TYPE_TEXT",
          confidence: 0.9,
          probabilities: { TYPE_TEXT: 0.7, CLICK: 0.3 },
        },
        click_target: {
          type: "choice",
          choice: "4",
          probabilities: { "4": 0.9 },
        },
        type_text_target: {
          type: "choice",
          choice: "2",
          confidence: 0.8,
          probabilities: { "2": 0.6, "3": 0.4 },
        },
      },
    },
    request,
    120,
  );
  assert.equal(decision.operation, "TYPE_TEXT");
  assert.equal(decision.target, "2");
  assert.equal(decision.action?.kind, "fill");
  assert.equal(decision.action?.label, "Where from?");
  assert.deepEqual(decision.speculativeHeads, ["click_target"]);
  assert.equal(decision.targetConfidence, 0.8);
});
test("a singleton SELECT head resolves without a model answer", () => {
  const request = buildDecisionPayload(page(), goal, [], "jev-latest");
  const decision = resolveDecision(
    {
      answers: {
        operation: {
          type: "choice",
          choice: "SELECT",
          probabilities: { SELECT: 1 },
        },
      },
    },
    request,
    50,
  );
  assert.equal(decision.target, "1:1");
  assert.equal(decision.action?.value, "one-way");
});
test("invalid or off-list answers never become actions", () => {
  const request = buildDecisionPayload(page(), goal, [], "jev-latest");
  assert.throws(
    () =>
      resolveDecision(
        { answers: { operation: { type: "choice", choice: "NAVIGATE" } } },
        request,
        1,
      ),
    /no operation chosen/,
  );
  assert.throws(
    () =>
      resolveDecision(
        {
          answers: {
            operation: { type: "choice", choice: "CLICK" },
            click_target: { type: "choice", choice: "99" },
          },
        },
        request,
        1,
      ),
    /without a valid target/,
  );
  // Argmax over reported probabilities stands in for a missing choice field.
  const decision = resolveDecision(
    {
      answers: {
        operation: { type: "choice", probabilities: { DONE: 0.2, WAIT: 0.8 } },
      },
    },
    request,
    1,
  );
  assert.equal(decision.operation, "WAIT");
  assert.equal(decision.action?.kind, "wait");
});
test("recent rejections travel with the state as history", () => {
  const request = buildDecisionPayload(
    page(),
    goal,
    [
      {
        step: 1,
        action: "Search flights",
        operation: "CLICK",
        kind: "click",
        text: null,
        outcome: "rejected: Covered by dialog “Price tracking tip”.",
        pageChanged: false,
      },
    ],
    "jev-latest",
  );
  const state = request.payload.state as {
    recent_actions: { outcome: string }[];
  };
  assert.match(state.recent_actions[0].outcome, /Covered by dialog/);
});
test("text helper output must be a one-key JSON object", () => {
  assert.equal(parseTextHelperOutput('{"text": "Zurich"}'), "Zurich");
  assert.equal(parseTextHelperOutput('{"text": null}'), null);
  for (const raw of [
    "Zurich",
    '{"text": ""}',
    '{"text": "a", "note": "b"}',
    '["Zurich"]',
    '{"value": "Zurich"}',
    `{"text": "${"x".repeat(2001)}"}`,
  ])
    assert.throws(() => parseTextHelperOutput(raw), Error, raw);
});
test("goal spans form a closed set Jev can choose from", () => {
  const spans = spanCandidates(
    "Fly from Zurich to London on September 20, 2026.",
  );
  assert.ok(spans.includes("Zurich"));
  assert.ok(spans.includes("September 20 2026"));
  assert.ok(!spans.some((s) => s.includes(",") || s.endsWith(".")));
  const payload = validatePayload(
    buildSpanPayload(
      {
        goal: "Fly from Zurich to London.",
        field: { label: "Where from?", role: "combobox", value: "" },
        page: { title: "", text: "" },
        recent_actions: [],
      },
      "jev-latest",
    ),
  );
  const criteria = payload.questions.field_text.criteria as Record<
    string,
    string
  >;
  assert.equal(criteria.none.length > 0, true);
  assert.ok(Object.values(criteria).includes("Zurich"));
});
test("a cycle log records the table, the choice, its confidence and the outcome", () => {
  const request = buildDecisionPayload(page(), goal, [], "jev-latest");
  const decision = resolveDecision(
    {
      answers: {
        operation: {
          type: "choice",
          choice: "CLICK",
          confidence: 0.77,
          probabilities: { CLICK: 0.9 },
        },
        click_target: {
          type: "choice",
          choice: "4",
          probabilities: { "4": 0.8, "2": 0.2 },
        },
      },
    },
    request,
    90,
  );
  const entry = finishCycle(
    recordDecision(startCycle(1, 0, page()), decision),
    "rejected",
    "Covered by dialog “Price tracking tip”.",
    140,
  );
  assert.equal(entry.elementTable.length, 4);
  assert.equal(entry.confidence, 0.77);
  assert.equal(entry.targetLabel, "Search flights");
  assert.equal(
    describeCycle(entry),
    "CLICK [4] Search flights → Target rejected: Covered by dialog “Price tracking tip”.",
  );
});

test("diagnostics retain the exact request and all response heads, model, and usage", async () => {
  const response = {
    model: "jev-1.13.0",
    answers: {
      operation: { type: "choice", choice: "BLOCKED", confidence: 0.95, probabilities: { BLOCKED: 0.96, CLICK: 0.03, TYPE_TEXT: 0.01 } },
      type_text_target: { type: "choice", choice: "2", confidence: 0.85, probabilities: { "2": 0.89, "3": 0.11 } },
    },
    _playgroundUsage: { inputTokens: 2586, outputTokens: 270 },
  };
  const decision = await decideWithJev(page(), goal, [], "jev-latest", undefined, async () => response);
  const entry = recordDecision(startCycle(1, 0, page()), decision);
  assert.deepEqual(entry.request, decision.request);
  assert.deepEqual(entry.response, response);
  assert.deepEqual(entry.usage, response._playgroundUsage);
  assert.equal(entry.observation.omitted, 0);
});

test("failed and invalid decisions retain exchange evidence", async () => {
  for (const invalid of [false, true]) {
    const response = { answers: { operation: { type: "choice", choice: "OFF_LIST" } } };
    let captured: any = null;
    await assert.rejects(decideWithJev(page(), goal, [], "jev-latest", undefined, async () => {
      if (invalid) return response;
      throw Error("Provider unavailable");
    }, (exchange) => { captured = exchange; }), invalid ? /no operation/ : /Provider unavailable/);
    assert.equal(captured.request.model, "jev-latest");
    assert.deepEqual(captured.response, invalid ? response : null);
    assert.ok(captured.jevLatencyMs >= 0);
  }
});

test("run analytics use cycle durations and report missing token coverage explicitly", () => {
  const request = buildDecisionPayload(page(), goal, [], "jev-latest");
  const decision = resolveDecision({ answers: { operation: { type: "choice", choice: "BLOCKED", confidence: 0.95, probabilities: { BLOCKED: 0.96, CLICK: 0.03, TYPE_TEXT: 0.01 } } } }, request, 100, { inputTokens: 2586, outputTokens: 270 });
  const first = finishCycle(recordDecision(startCycle(1, 10, page()), decision), "blocked", "Retry", 110);
  const second = { ...first, step: 2, startedMs: 120, elapsedMs: 320, jevLatencyMs: 200, usage: null };
  const state = { ...createAgentState(goal), log: [first, second], decisions: 2 };
  const analytics = analyzeRun(state);
  assert.deepEqual(analytics.cycleLatencyMs, { n: 2, mean: 150, median: 150, p95: 200, max: 200 });
  assert.deepEqual(analytics.decisionLatencyMs, analytics.cycleLatencyMs);
  assert.deepEqual(analytics.tokens.input, { knownTotal: 2586, total: null, reportedCycles: 1, missingCycles: 1 });
  assert.equal(analytics.choices[0].selectedProbability, 0.96);
  assert.ok(Math.abs(analytics.choices[0].margin! - 0.93) < 1e-10);
  assert.equal(analytics.choices[0].confidence, 0.95);
});

test("empty and malformed evidence never become zero-cost or confident diagnoses", () => {
  const state = createAgentState(goal);
  assert.equal(analyzeRun(state).decisionLatencyMs.mean, null);
  const entry = startCycle(1, 0, page());
  entry.operation = "BLOCKED";
  entry.operationProbabilities = { BLOCKED: 1.2, CLICK: -0.2 };
  state.log = [entry];
  state.decisions = 1;
  const analytics = analyzeRun(state);
  assert.equal(analytics.choices[0].selectedProbability, null);
  assert.equal(analytics.choices[0].margin, null);
  assert.equal(analytics.tokens.input.total, null);
  assert.deepEqual(analytics.evidenceCoverage.missingRequestSteps, [1]);
});

test("the pasteable report carries source evidence and explicit single-run limits", () => {
  const state = createAgentState(goal);
  const entry = startCycle(1, 0, page());
  entry.request = buildDecisionPayload(page(), goal, [], "jev-latest").payload;
  entry.response = { model: "jev-1.13.0", answers: { operation: { choice: "BLOCKED" }, type_text_target: { choice: "2" } } };
  state.log = [entry];
  state.decisions = 1;
  const report = formatDebugReport(state, { environment: { userAgent: "Test browser" }, verifier: { name: "verifyFlightSearch" } });
  assert.match(report, /single run/i);
  assert.match(report, /not calibrated/i);
  assert.match(report, /nearest-rank/i);
  assert.match(report, /missing/i);
  assert.match(report, /jev-1.13.0/);
  assert.match(report, /type_text_target/);
  assert.match(report, /Test browser/);
  const evidence = JSON.parse(report.split("```json\n")[1].split("\n```")[0]);
  assert.deepEqual(evidence.run.log[0].request, entry.request);
  assert.deepEqual(evidence.run.log[0].response, entry.response);
  assert.equal(evidence.schemaVersion, 1);
});

test("decision probabilities outside [0,1] and non-choice answers cannot drive actions", () => {
  const request = buildDecisionPayload(page(), "Goal", [], "jev-latest");
  const decision = resolveDecision({ answers: { operation: { type: "choice", probabilities: { WAIT: 2, DONE: .4, BLOCKED: -1 } } } }, request, 1);
  assert.equal(decision.operation, "DONE");
  assert.deepEqual(decision.operationProbabilities, { DONE: .4 });
  assert.throws(() => resolveDecision({ answers: { operation: { type: "score", choice: "DONE" } } } as any, request, 1), /operation/);
});
