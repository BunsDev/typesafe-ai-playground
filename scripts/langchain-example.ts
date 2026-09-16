import { existsSync } from "node:fs";
import { RunnableLambda } from "@langchain/core/runnables";
import {
  createJevRoutingTool,
  mockRoutingTransport,
} from "../lib/langchain/jev-tool";
import { serverJevTransport } from "../lib/serverJev";
async function main() {
  const live = process.argv.includes("--live");
  if (live && !process.env.TYPESAFE_API_KEY && existsSync(".env.local"))
    process.loadEnvFile(".env.local");
  const router = createJevRoutingTool({
    transport: live ? serverJevTransport : mockRoutingTransport,
    mode: live ? "live" : "mock",
  });
  const chain = RunnableLambda.from(async (request: string) =>
    router.invoke({ request, current_node: "ops_agent" }),
  ).pipe(
    RunnableLambda.from((result) => ({
      integration: "LangChain tool + RunnableLambda",
      mode: live ? "live" : "mock",
      ...result,
    })),
  );
  console.log(
    JSON.stringify(
      await chain.invoke("Check the current rate limit settings"),
      null,
      2,
    ),
  );
}
main().catch(() => {
  console.error(
    "Example failed. Check setup and TYPESAFE_API_KEY for live mode.",
  );
  process.exitCode = 1;
});
