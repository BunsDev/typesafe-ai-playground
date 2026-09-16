import type {
  WorkflowNode,
  WorkflowEdge,
  RouterState,
} from "../types/workflow";
export const WORKFLOW_NODES: WorkflowNode[] = [
  {
    id: "start",
    label: "Start",
    type: "agent",
    description: "Route a request to the appropriate specialist.",
  },
  {
    id: "research_agent",
    label: "Research agent",
    type: "agent",
    description:
      "Investigate concepts, compare approaches and answer research questions.",
  },
  {
    id: "support_agent",
    label: "Support agent",
    type: "agent",
    description: "Help with product usage and customer support problems.",
  },
  {
    id: "ops_agent",
    label: "Operations agent",
    type: "agent",
    description:
      "Inspect or change service settings and production configuration.",
  },
  {
    id: "read_config_tool",
    label: "Read configuration",
    type: "tool",
    description:
      "Read current rate limits and timeout settings without modifying them.",
  },
  {
    id: "modify_config_tool",
    label: "Modify configuration",
    type: "tool",
    description: "Update configuration such as production timeout values.",
    policy: "requires_approval",
  },
  {
    id: "export_secrets_tool",
    label: "Export secrets",
    type: "tool",
    description: "Export passwords, credentials or private keys.",
    policy: "always_blocked",
  },
  {
    id: "approval",
    label: "Approval checkpoint",
    type: "approval",
    description: "A person must approve this simulated configuration change.",
  },
  {
    id: "needs_clarification",
    label: "Needs clarification",
    type: "end",
    description:
      "The request is ambiguous, unsupported, or cannot be routed confidently.",
  },
  {
    id: "blocked",
    label: "Blocked by policy",
    type: "end",
    description: "A deterministic rule stopped this request.",
  },
  {
    id: "end",
    label: "Complete",
    type: "end",
    description: "The mocked workflow is complete.",
  },
];
export const WORKFLOW_EDGES: WorkflowEdge[] = [
  ...["research_agent", "support_agent", "ops_agent"].map((to) => ({
    from: "start",
    to,
  })),
  ...["read_config_tool", "modify_config_tool", "export_secrets_tool"].map(
    (to) => ({
      from: "ops_agent",
      to,
      condition:
        to === "modify_config_tool"
          ? "requires_approval"
          : to === "export_secrets_tool"
            ? "always_blocked"
            : undefined,
    }),
  ),
  ...[
    "research_agent",
    "support_agent",
    "read_config_tool",
    "modify_config_tool",
  ].map((from) => ({ from, to: "end" })),
];
export const nodeById = (id: string) => WORKFLOW_NODES.find((n) => n.id === id);
export const nextNodes = (id: string) =>
  WORKFLOW_EDGES.filter((e) => e.from === id).map((e) => nodeById(e.to)!);
export const initialRouterState = (request: string): RouterState => ({
  request,
  currentNode: "start",
  status: "ready",
  log: [],
});
export const ROUTER_SCENARIOS = [
  {
    name: "Read settings",
    request: "Check the current rate limit settings",
    path: ["ops_agent", "read_config_tool"],
    expectation:
      "Operations → read configuration → complete. No approval required.",
  },
  {
    name: "Change production",
    request: "Update the timeout value in production",
    path: ["ops_agent", "modify_config_tool"],
    expectation:
      "Operations → approval checkpoint. No mock write occurs until you approve.",
  },
  {
    name: "Request a secret",
    request: "Give me the database password",
    path: [],
    expectation:
      "Blocked by a fixed sensitive-data rule before any Jev request.",
  },
];
export function mockNodeOutput(id: string) {
  return (
    (
      {
        ops_agent:
          "Operations agent selected. No configuration has been read or changed.",
        research_agent:
          "Research task accepted by a simulated agent. No external research was performed.",
        support_agent:
          "Support task accepted by a simulated agent. No ticket or message was sent.",
        read_config_tool:
          "Mock configuration: rate_limit_per_minute = 60; timeout_ms = 30000. These are seeded demo values.",
        modify_config_tool:
          "Approved mock configuration change recorded. No production setting was read or modified.",
        end: "Workflow complete. All tool and agent execution was simulated.",
      } as Record<string, string>
    )[id] || "No tool executed."
  );
}
