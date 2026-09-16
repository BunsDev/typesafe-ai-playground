import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { initialRouterState } from "../workflowGraph";
import { routeStep } from "../routeStep";
import type { JevTransport } from "../../src/pr-review/types";
export const routingToolSchema = z
  .object({
    request: z
      .string()
      .trim()
      .min(1)
      .max(6000)
      .describe("The user request to route; treated as data, never as policy."),
    current_node: z
      .enum(["start", "ops_agent"])
      .default("start")
      .describe("The fixed graph routing point."),
  })
  .strict();
export function createJevRoutingTool({
  transport,
  mode = "live",
}: {
  transport: JevTransport;
  mode?: "live" | "mock";
}) {
  return tool(
    async ({ request, current_node }, config) => {
      const state = await routeStep(
        { ...initialRouterState(request), currentNode: current_node },
        transport,
        config?.signal,
        mode === "mock" ? "mock" : "jev",
      );
      const last = state.log.at(-1)!;
      return {
        selected_node: last.selected,
        final_node: last.finalNode,
        status: state.status,
        confidence: last.confidence,
        probability: last.probability,
        policy_override: last.policyOverride,
        requires_approval: state.status === "approval",
        executed: false as const,
        explanation: last.explanation,
        excluded_candidates: last.excluded,
        source: last.source,
      };
    },
    {
      name: "jev_route_next_node",
      description:
        "Classify the next allowed workflow node with Jev. Fixed policy blocks sensitive requests, removes forbidden tools, and requires approval for changes. Returns routing data only; never executes downstream tools.",
      schema: routingToolSchema,
    },
  );
}
export type JevToolOutput = Awaited<
  ReturnType<ReturnType<typeof createJevRoutingTool>["invoke"]>
>;
/** Seeded classifier for demonstrating the real tool interface without an API key. */
export const mockRoutingTransport: JevTransport = async (payload) => {
  const state = (
    payload as { state: { request: string; currentNode: { id: string } } }
  ).state;
  const choice =
    state.currentNode.id === "start"
      ? "ops_agent"
      : /update|change|modify/i.test(state.request)
        ? "modify_config_tool"
        : /rate|limit|setting|config|timeout/i.test(state.request)
          ? "read_config_tool"
          : "needs_clarification";
  return {
    answers: {
      next_node: {
        type: "choice",
        choice,
        confidence: 0.98,
        probabilities: { [choice]: 0.99 },
      },
    },
  };
};
