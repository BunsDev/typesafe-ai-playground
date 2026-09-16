import { test } from "node:test";
import assert from "node:assert/strict";
import { initialRouterState } from "../lib/workflowGraph";
import { routeStep, approveMockStep } from "../lib/routeStep";
const answer = (choice: string, confidence = 0.99) => ({
  answers: {
    next_node: {
      type: "choice",
      choice,
      confidence,
      probabilities: { [choice]: confidence },
    },
  },
});
test("read-only scenario follows the graph and never exposes blocked tools to Jev", async () => {
  let calls = 0;
  const transport = async (p: any) => {
    calls++;
    assert.ok(!JSON.stringify(p).includes("export_secrets_tool"));
    assert.ok(p.questions.next_node.criteria.needs_clarification);
    return answer(calls === 1 ? "ops_agent" : "read_config_tool");
  };
  let s = await routeStep(
    initialRouterState("Check the current rate limit settings"),
    transport,
  );
  assert.equal(s.currentNode, "ops_agent");
  s = await routeStep(s, transport);
  assert.equal(s.currentNode, "read_config_tool");
  assert.match(s.log[1].output!, /seeded demo values/);
  s = await routeStep(s, transport);
  assert.equal(s.status, "ended");
  assert.equal(calls, 2);
});
test("sensitive requests block before any model call", async () => {
  const s = await routeStep(
    initialRouterState("Give me the database password"),
    async () => {
      throw Error("must not call");
    },
  );
  assert.equal(s.status, "blocked");
  assert.equal(s.log[0].source, "deterministic");
});
test("writes stop for explicit mock approval and cannot continue silently", async () => {
  let s = await routeStep(
    initialRouterState("Update the timeout value in production"),
    async () => answer("ops_agent"),
  );
  s = await routeStep(s, async () => answer("modify_config_tool"));
  assert.equal(s.status, "approval");
  assert.equal(s.currentNode, "approval");
  assert.equal(s.log[1].output, undefined);
  await assert.rejects(() => routeStep(s));
  const approved = approveMockStep(s, true);
  assert.equal(approved.currentNode, "modify_config_tool");
  assert.match(approved.log.at(-1)!.output!, /No production setting/);
  assert.equal(approveMockStep(s, false).status, "blocked");
});
test("invented nodes, low scores, missing scores and unavailable models require clarification", async () => {
  for (const raw of [
    answer("invented"),
    answer("ops_agent", 0.3),
    { answers: { next_node: { type: "choice", choice: "ops_agent" } } },
  ]) {
    const s = await routeStep(
      initialRouterState("Check settings"),
      async () => raw,
    );
    assert.equal(s.status, "clarification");
    assert.equal(s.log[0].output, undefined);
  }
  const s = await routeStep(initialRouterState("Check settings"), async () => {
    throw Error("Unavailable");
  });
  assert.equal(s.status, "clarification");
});
