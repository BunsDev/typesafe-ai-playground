import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DeltaStream,
  buildNativeRequest,
  resolveNativeBatch,
  nativeMetrics,
  goalValues,
} from "../lib/nativeBrowser/protocol";
import type { NativeSnapshot, NativeTrace } from "../lib/nativeBrowser/types";
const snapshot = (patch: Partial<NativeSnapshot> = {}): NativeSnapshot => ({
  documentId: "doc1",
  revision: 0,
  url: "https://example.test/setup",
  title: "Setup",
  text: ["Account details", "Save your draft"],
  scroll: { y: 0, height: 600, viewport: 600 },
  challenge: null,
  nodes: [
    {
      id: "n1",
      role: "textbox",
      label: "Name",
      value: "",
      kind: "fill",
      guard: "g1",
      group: "f1",
    },
    {
      id: "n2",
      role: "textbox",
      label: "Email",
      value: "",
      kind: "fill",
      guard: "g2",
      group: "f1",
    },
    {
      id: "n3",
      role: "button",
      label: "Save draft",
      value: "",
      kind: "click",
      guard: "g3",
      group: "f1",
    },
  ],
  ...patch,
});

test("local text values preserve exact quoted whitespace and prioritize dates over capped ngrams", () => {
  const goal = `${"context ".repeat(100)} Set departure to September 21, 2026 and name to "Ada  Lovelace".`;
  const values = goalValues(goal);
  assert.ok(values.includes("September 21, 2026"));
  assert.ok(values.includes("Ada  Lovelace"));
  assert.ok(!values.includes("Ada Lovelace"));
  assert.ok(values.length <= 80);
  assert.ok(values.every((value) => goal.includes(value)));
});
test("only the first policy update contains a baseline; unchanged text and nodes are absent later", () => {
  const stream = new DeltaStream();
  const first = stream.next(snapshot(), "Name Ada; Email ada@example.test");
  assert.equal(first.kind, "baseline");
  const second = stream.next(
    snapshot({
      ...snapshot(),
      revision: 1,
      nodes: snapshot().nodes.map((n) =>
        n.id === "n1" ? { ...n, value: "Ada", guard: "g4" } : n,
      ),
    }),
    "Name Ada; Email ada@example.test",
  );
  assert.equal(second.kind, "delta");
  assert.equal(second.changed.length, 1);
  assert.equal(second.changed[0].id, "n1");
  assert.deepEqual(second.added, []);
  assert.deepEqual(second.text.added, []);
  assert.ok(!JSON.stringify(second).includes("Save your draft"));
});
test("navigation invalidates old handles and emits a delta instead of replaying a baseline", () => {
  const stream = new DeltaStream();
  stream.next(snapshot(), "Setup");
  const delta = stream.next(
    snapshot({
      documentId: "doc2",
      url: "https://example.test/next",
      nodes: [],
      text: ["Ready"],
    }),
    "Setup",
  );
  assert.equal(delta.kind, "delta");
  assert.equal(delta.navigation, true);
  assert.deepEqual(delta.removed, ["n1", "n2", "n3"]);
  assert.deepEqual(delta.text.added, ["Ready"]);
});
test("one Jev exchange resolves multiple explicitly chosen field actions using exact user values", () => {
  const page = snapshot(),
    stream = new DeltaStream();
  const request = buildNativeRequest(
    page,
    stream.next(page, 'Set Name to "Ada" and Email to "ada@example.test"'),
    'Set Name to "Ada" and Email to "ada@example.test"',
    "jev-latest",
  );
  const answers = Object.fromEntries(
    Object.entries(request.menus).map(([head, menu]) => {
      const id = Object.keys(menu).find(
        (id) =>
          menu[id].text === (head === "action_1" ? "Ada" : "ada@example.test"),
      );
      return [head, { type: "choice", choice: id ?? "SKIP" }];
    }),
  );
  const batch = resolveNativeBatch({ answers }, request);
  assert.equal(batch.length, 2);
  assert.deepEqual(
    batch.map((a) => a.operation),
    ["TYPE_TEXT", "TYPE_TEXT"],
  );
  assert.equal(batch[1].text, "ada@example.test");
});
test("a navigation/control choice discards every speculative field choice", () => {
  const page = snapshot();
  const r = buildNativeRequest(
    page,
    new DeltaStream().next(page, 'Name "Ada"'),
    'Name "Ada"',
    "jev-latest",
  );
  const answers = Object.fromEntries(
    Object.keys(r.menus).map((head) => [
      head,
      {
        type: "choice",
        choice:
          head === "action_1"
            ? "DONE"
            : Object.keys(r.menus[head]).find(
                (id) => r.menus[head][id].operation === "TYPE_TEXT",
              ),
      },
    ]),
  );
  assert.deepEqual(
    resolveNativeBatch({ answers }, r).map((a) => a.operation),
    ["DONE"],
  );
});
test("invented commands and malformed answers fail closed for the whole batch", () => {
  const p = snapshot(),
    r = buildNativeRequest(
      p,
      new DeltaStream().next(p, "Ada"),
      "Ada",
      "jev-latest",
    );
  assert.throws(() =>
    resolveNativeBatch(
      { answers: { action_1: { type: "choice", choice: "eval(script)" } } },
      r,
    ),
  );
});
test("missing provider usage never becomes a zero-token benchmark result", () => {
  const traces = [
    {
      usage: null,
      executed: 3,
      requestCharacters: 300,
      fullStateCharacters: 2000,
      latencyMs: 10,
    },
  ] as NativeTrace[];
  const m = nativeMetrics(traces);
  assert.equal(m.outputTokensPerAction, null);
  assert.equal(m.outputTokens, null);
  assert.equal(m.executedActions, 3);
  assert.equal(m.modelCalls, 1);
  const scripted = nativeMetrics(traces, "scripted");
  assert.equal(scripted.modelCalls, 0);
  assert.equal(scripted.decisionCalls, 1);
  assert.equal(scripted.outputTokens, null);
});

test("observed checkbox commands can batch while arbitrary click commands remain barriers", () => {
  const page = snapshot({
    nodes: snapshot()
      .nodes.slice(0, 2)
      .map((n) => ({ ...n, kind: "toggle", role: "checkbox", value: "false" })),
  });
  const request = buildNativeRequest(
    page,
    new DeltaStream().next(page, "Enable both"),
    "Enable both",
    "jev-latest",
  );
  const actions = resolveNativeBatch(
    {
      answers: Object.fromEntries(
        Object.keys(request.menus).map((head) => [
          head,
          { type: "choice", choice: "TOGGLE" },
        ]),
      ),
    },
    request,
  );
  assert.equal(actions.length, 2);
  assert.ok(actions.every((a) => a.operation === "CLICK" && a.batchable));
});

test("pre-call compression retains a relevant select option beyond the first forty entries", () => {
  const page = snapshot({
    nodes: [
      {
        ...snapshot().nodes[0],
        kind: "select",
        label: "Country",
        options: Array.from({ length: 250 }, (_, index) => ({
          index,
          label: index === 249 ? "United States" : `Option ${index}`,
          value: String(index),
        })),
      },
    ],
  });
  const goal = 'Set Country to "United States"';
  const delta = new DeltaStream().next(page, goal);
  const request = buildNativeRequest(page, delta, goal, "jev-latest");
  assert.equal(delta.added[0].options?.length, 40);
  assert.equal(request.menus.action_1.S249?.value, "249");
  assert.equal(delta.added[0].options?.[0].label, "United States");
});
