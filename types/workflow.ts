export type WorkflowNode = {
  id: string;
  label: string;
  type: "tool" | "agent" | "approval" | "end";
  description: string;
  policy?: "requires_approval" | "always_blocked";
};
export type WorkflowEdge = { from: string; to: string; condition?: string };
export type RoutingChoice = {
  nodeId: string;
  confidence: number | null;
  probability: number | null;
  source: "jev" | "mock" | "deterministic" | "unavailable";
  error?: string;
};
export type RoutingLogEntry = {
  step: number;
  from: string;
  selected: string | null;
  finalNode: string;
  confidence: number | null;
  probability: number | null;
  source: RoutingChoice["source"];
  policyOverride: string | null;
  explanation: string;
  output?: string;
  excluded: string[];
};
export type RouterState = {
  request: string;
  currentNode: string;
  status: "ready" | "approval" | "ended" | "blocked" | "clarification";
  pendingNode?: string;
  log: RoutingLogEntry[];
};
