import { test } from "node:test";
import assert from "node:assert/strict";
import { createJevRoutingTool } from "../lib/langchain/jev-tool";
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
test("real LangChain tool validates its schema and enforces policy before provider calls", async () => {
  let calls = 0;
  const router = createJevRoutingTool({
    transport: async () => {
      calls++;
      return answer("read_config_tool");
    },
  });
  assert.equal(router.name, "jev_route_next_node");
  const r = await router.invoke({
    request: "Check current rate limits",
    current_node: "ops_agent",
  });
  assert.equal(r.final_node, "read_config_tool");
  assert.equal(r.executed, false);
  await assert.rejects(() =>
    router.invoke({
      request: "Check settings",
      current_node: "export_secrets_tool",
    } as any),
  );
  const blocked = await router.invoke({
    request: "Give me the database password",
    current_node: "start",
  });
  assert.equal(blocked.status, "blocked");
  assert.equal(calls, 1);
});
test("LangChain adapter never bypasses approval or low confidence", async () => {
  const router = createJevRoutingTool({
    transport: async () => answer("modify_config_tool"),
  });
  const r = await router.invoke({
    request: "Update production timeout",
    current_node: "ops_agent",
  });
  assert.equal(r.requires_approval, true);
  assert.equal(r.final_node, "approval");
  assert.equal(r.executed, false);
  const low = createJevRoutingTool({
    transport: async () => answer("read_config_tool", 0.1),
  });
  assert.equal(
    (await low.invoke({ request: "Check limits", current_node: "ops_agent" }))
      .status,
    "clarification",
  );
});
test("tool-call invocation produces a LangChain ToolMessage with structured content", async () => {
  const router = createJevRoutingTool({
    transport: async () => answer("ops_agent"),
  });
  const result = await router.invoke({
    type: "tool_call",
    id: "call-1",
    name: router.name,
    args: { request: "Check settings", current_node: "start" },
  });
  assert.equal(result.tool_call_id, "call-1");
  assert.equal(JSON.parse(result.content as string).final_node, "ops_agent");
});

test("LangChain endpoint invokes the real tool in mock mode and rejects cross-origin or invented nodes", async () => {
  const { POST } = await import("../app/api/langchain-route/route");
  const req = (body: unknown, origin = "http://localhost") =>
    new Request("http://localhost/api/langchain-route", {
      method: "POST",
      headers: { "Content-Type": "application/json", origin },
      body: JSON.stringify(body),
    });
  assert.equal(
    (await POST(req({ request: "hello" }, "https://evil.example"))).status,
    403,
  );
  assert.equal(
    (await POST(req({ request: "hello", current_node: "export_secrets_tool" })))
      .status,
    400,
  );
  const response = await POST(
    req({
      request: "Update the timeout value in production",
      current_node: "ops_agent",
      mode: "mock",
    }),
  );
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.tool, "jev_route_next_node");
  assert.equal(data.output.requires_approval, true);
  assert.equal(data.output.executed, false);
});
