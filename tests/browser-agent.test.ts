import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePayload } from "../lib/api";
import { buildDecisionPayload, resolveDecision } from "../lib/callJev";
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
