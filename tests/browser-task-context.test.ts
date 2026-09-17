import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveBrowserContext, PC_BUILD_GOAL } from "../lib/browserTaskContext";
import { FLIGHT_GOAL } from "../lib/flightSandbox";

test("Newegg goals use PC constraints and never inherit flight verification", () => {
  const context = resolveBrowserContext("go to newegg.com and pick out parts to build a pc for $2500 make good use of the budget. for 1440p gaming");
  assert.equal(context.kind, "newegg");
  if (context.kind !== "newegg") return;
  assert.equal(context.budgetCents, 250000);
  assert.equal(context.resolution, "1440p");
  assert.equal(context.verifier, "validateBuild + verifySelectedParts");
  assert.equal(resolveBrowserContext(PC_BUILD_GOAL).kind, "newegg");
  assert.equal(resolveBrowserContext(FLIGHT_GOAL).kind, "flight");
});

test("unsupported goals never silently run the fixed flight or PC preset", () => {
  for (const goal of ["Book a hotel", "Build a PC on newegg.com for $1800 at 1440p", "Build a PC on newegg.com for $2500 at 4K", FLIGHT_GOAL.replace("London", "Paris")])
    assert.equal(resolveBrowserContext(goal).kind, "unsupported", goal);
});

test("PC API rejects mismatched goals before any research starts", async () => {
  const { POST } = await import("../app/api/pc-build/route");
  const response = await POST(new Request("http://localhost/api/pc-build", { method: "POST", signal: AbortSignal.abort(), headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goal: FLIGHT_GOAL }) }));
  assert.equal(response.status, 400);
  const data = await response.json();
  assert.equal(data.metrics.toolCalls, 0);
});
