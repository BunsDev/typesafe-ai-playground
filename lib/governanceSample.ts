import type { CodebaseManifest } from "../types/ast";
import type { GovernanceAnalysis } from "../types/governance";
import type { GovernanceDecision } from "../types/review";
import { buildGovernanceUnits } from "./classifyWithJev";
export const GOVERNANCE_SAMPLE = {
  title: "Add organizationId to createUser",
  description:
    "Add organization membership to user creation. The HTTP caller is updated; the invitation job and tests are not.",
  diff: `diff --git a/src/auth/service.ts b/src/auth/service.ts
--- a/src/auth/service.ts
+++ b/src/auth/service.ts
@@ -1,3 +1,3 @@
-export function createUser(email: string, password: string) {
-  return { email };
+export function createUser(email: string, password: string, organizationId: string) {
+  return { email, organizationId };
 }
diff --git a/src/routes/register.ts b/src/routes/register.ts
--- a/src/routes/register.ts
+++ b/src/routes/register.ts
@@ -1,3 +1,3 @@
-export function registerUser(email: string, password: string) {
-  return createUser(email, password);
+export function registerUser(email: string, password: string, organizationId: string) {
+  return createUser(email, password, organizationId);
 }
`,
};
export const GOVERNANCE_MANIFEST: CodebaseManifest = {
  complete: true,
  environmentHash: "demo-toolchain-v1",
  symbols: [
    {
      id: "src/auth/service.ts#createUser",
      filePath: "src/auth/service.ts",
      kind: "function",
      name: "createUser",
      parameters: ["email", "password"],
      calls: [],
      exported: true,
      hash: "mock-create-user-v1",
    },
    {
      id: "src/routes/register.ts#registerUser",
      filePath: "src/routes/register.ts",
      kind: "function",
      name: "registerUser",
      parameters: ["email", "password"],
      calls: ["src/auth/service.ts#createUser"],
      exported: true,
      hash: "mock-register-v1",
    },
    {
      id: "src/jobs/invite.ts#inviteUser",
      filePath: "src/jobs/invite.ts",
      kind: "function",
      name: "inviteUser",
      parameters: ["email", "password"],
      calls: ["src/auth/service.ts#createUser"],
      exported: true,
      hash: "mock-invite-v1",
    },
  ],
  tests: [
    {
      filePath: "tests/auth.test.ts",
      symbolIds: ["src/auth/service.ts#createUser"],
    },
    {
      filePath: "tests/invite.test.ts",
      symbolIds: ["src/jobs/invite.ts#inviteUser"],
    },
  ],
};
export function mockGovernanceResults(
  a: GovernanceAnalysis,
): GovernanceDecision[] {
  return buildGovernanceUnits(a).map((unit) => ({
    unit,
    outcome:
      unit.focus === "compatibility"
        ? "possible_breaking_change"
        : unit.focus === "test_coverage"
          ? "missing_test_coverage"
          : "needs_human_review",
    confidence: 0.97,
    probability: 0.98,
    source: "mock",
  }));
}
