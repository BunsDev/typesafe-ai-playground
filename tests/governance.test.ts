import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeGovernance } from "../lib/analyzeImpact";
import {
  GOVERNANCE_SAMPLE,
  GOVERNANCE_MANIFEST,
  mockGovernanceResults,
} from "../lib/governanceSample";
import { resolveReviewStatus } from "../lib/resolveReviewStatus";
import { buildGovernanceUnits, classifyWithJev } from "../lib/classifyWithJev";
import { createMockVerifiedRun, testCache } from "../lib/testCache";
const sample = () =>
  analyzeGovernance({
    ...GOVERNANCE_SAMPLE,
    manifest: JSON.stringify(GOVERNANCE_MANIFEST),
    policy: "[]",
  });
test("demo identifies the new required parameter, both callers and the missed caller", async () => {
  const a = await sample();
  assert.equal(a.impact.publicApiChanged, true);
  assert.equal(a.impact.affectedCallers.length, 2);
  assert.ok(a.impact.missedCallerIds.includes("src/jobs/invite.ts#inviteUser"));
  assert.ok(
    a.impact.changedSymbols
      .find((s) => s.name === "createUser")
      ?.parameters?.includes("organizationId"),
  );
  assert.ok(a.checks.findings.some((f) => f.kind === "protected_path"));
  assert.ok(a.checks.findings.some((f) => f.kind === "missing_tests"));
  assert.equal(
    resolveReviewStatus(a, mockGovernanceResults(a)).status,
    "needs_review",
  );
});
test("secret files block before Jev and cannot be downgraded", async () => {
  const a = await analyzeGovernance({
    title: "Env",
    description: "",
    diff: "diff --git a/.env b/.env\n--- a/.env\n+++ b/.env\n@@ -1 +1 @@\n-KEY=old\n+KEY=new\n",
    manifest: "",
    policy: "[]",
  });
  assert.equal(a.checks.blocked, true);
  assert.equal(buildGovernanceUnits(a).length, 0);
  assert.equal(resolveReviewStatus(a, []).status, "block_candidate");
  assert.equal((await testCache(a)).action, "needs_human_confirmation");
});
test("only relevant policies enter the compact analysis", async () => {
  const a = await analyzeGovernance({
    ...GOVERNANCE_SAMPLE,
    manifest: JSON.stringify(GOVERNANCE_MANIFEST),
    policy: JSON.stringify([
      {
        id: "billing",
        kind: "security",
        paths: ["src/payments/*"],
        description: "Billing review",
      },
    ]),
  });
  assert.ok(!a.policies.some((p) => p.id === "billing"));
  assert.ok(a.policies.some((p) => p.id === "protected_paths"));
});
test("Jev choices are fixed and missing confidence requires human review", async () => {
  const a = await sample();
  const unit = buildGovernanceUnits(a)[0];
  const answer = await classifyWithJev(unit, a, async (p) => {
    const q = p.questions.outcome;
    assert.equal(q.type, "choice");
    assert.ok((q.criteria as any).needs_human_review);
    assert.ok((q.criteria as any).needs_more_context);
    assert.equal(Object.keys(q.criteria!).length, 6);
    return {
      answers: {
        outcome: {
          type: "choice",
          choice: "safe_change",
          probabilities: { safe_change: 0.99 },
        },
      },
    };
  });
  assert.equal(answer.confidence, null);
  assert.equal(resolveReviewStatus(a, [answer]).status, "needs_review");
  await assert.rejects(
    classifyWithJev(unit, a, async () => ({
      answers: { outcome: { type: "choice", choice: "invented_bug" } },
    })),
  );
});
test("mock test cache requires the complete same dependency snapshot and never executes tests", async () => {
  const a = await sample();
  assert.equal((await testCache(a)).action, "rerun_tests");
  const prior = await createMockVerifiedRun(a);
  assert.equal((await testCache(a, prior)).action, "skip_tests");
  const changed = structuredClone(GOVERNANCE_MANIFEST);
  changed.symbols[2].hash = "changed-caller";
  const b = await analyzeGovernance({
    ...GOVERNANCE_SAMPLE,
    manifest: JSON.stringify(changed),
    policy: "[]",
  });
  assert.equal((await testCache(b, prior)).action, "rerun_tests");
  const incomplete = await analyzeGovernance({
    ...GOVERNANCE_SAMPLE,
    manifest: "",
    policy: "[]",
  });
  assert.equal(
    (await testCache(incomplete, prior)).action,
    "needs_human_confirmation",
  );
});
test("generated code does not override a protected auth path", async () => {
  const a = await analyzeGovernance({
    title: "Generated auth",
    description: "",
    diff: "diff --git a/vendor/auth/service.ts b/vendor/auth/service.ts\n--- a/vendor/auth/service.ts\n+++ b/vendor/auth/service.ts\n@@ -1 +1 @@\n-export const ok = false;\n+export const ok = true;\n",
    manifest: "",
    policy: "[]",
  });
  assert.ok(a.impact.protectedPathsTouched.length);
  assert.equal(resolveReviewStatus(a, []).status, "needs_review");
});

test("ambiguous multi-function hunks do not invent call ownership", async () => {
  const a = await analyzeGovernance({
    title: "Two helpers",
    description: "",
    policy: "[]",
    manifest: JSON.stringify({
      complete: true,
      symbols: [
        {
          id: "target",
          name: "target",
          filePath: "src/target.ts",
          kind: "function",
          hash: "v1",
        },
      ],
      tests: [],
    }),
    diff: "diff --git a/src/util.ts b/src/util.ts\n--- a/src/util.ts\n+++ b/src/util.ts\n@@ -0,0 +1,2 @@\n+function first() { return target(); }\n+function second() { return 1; }\n",
  });
  assert.equal(
    a.graph.edges.some((e) => e.to === "target"),
    false,
  );
  assert.equal(a.graph.complete, false);
  assert.match(a.graph.issues.join(" "), /call ownership/);
});

test("strings and comments never create symbols or call relationships", async () => {
  const input = {
    title: "Literal text",
    description: "",
    policy: "[]",
    manifest: JSON.stringify({
      complete: true,
      symbols: [
        {
          id: "target",
          name: "target",
          filePath: "src/other.ts",
          kind: "function",
          hash: "v1",
        },
      ],
      tests: [],
    }),
    diff: 'diff --git a/src/util.ts b/src/util.ts\n--- a/src/util.ts\n+++ b/src/util.ts\n@@ -0,0 +1,2 @@\n+function changed() { return "target()"; }\n+// function fake() { target(); }\n',
  };
  const a = await analyzeGovernance(input);
  assert.equal(a.graph.edges.length, 0);
  assert.equal(
    a.graph.nodes.some((n) => n.name === "fake"),
    false,
  );
  assert.equal(
    a.graph.issues.some((i) => i.includes("target")),
    false,
  );
  const b = await analyzeGovernance({
    ...input,
    diff: input.diff.replace('"target()"', "target()"),
  });
  assert.equal(b.graph.edges.length, 0);
  assert.equal(b.graph.complete, false);
  assert.match(b.graph.issues.join(" "), /unindexed call/);
});
test("an unchanged context-only caller is never marked updated", async () => {
  const a = await analyzeGovernance({
    title: "Required argument",
    description: "",
    policy: "[]",
    manifest: JSON.stringify({
      complete: true,
      symbols: [
        {
          id: "target",
          name: "target",
          filePath: "src/util.ts",
          kind: "function",
          hash: "v1",
          exported: true,
        },
        {
          id: "caller",
          name: "caller",
          filePath: "src/util.ts",
          kind: "function",
          hash: "v1",
          calls: ["target"],
        },
      ],
      tests: [],
    }),
    diff: "diff --git a/src/util.ts b/src/util.ts\n--- a/src/util.ts\n+++ b/src/util.ts\n@@ -1,2 +1,2 @@\n-export function target() { return 1; }\n+export function target(required: string) { return 1; }\n function caller() { return target(); }\n",
  });
  assert.deepEqual(a.impact.updatedCallerIds, []);
  assert.deepEqual(a.impact.missedCallerIds, ["caller"]);
  assert.equal(a.graph.complete, false);
});

test("literal parameter type changes remain public API evidence after lexical masking", async () => {
  const a = await analyzeGovernance({
    title: "Literal type",
    description: "",
    policy: "[]",
    manifest: "",
    diff: 'diff --git a/src/util.ts b/src/util.ts\n--- a/src/util.ts\n+++ b/src/util.ts\n@@ -1 +1 @@\n-export function action(mode: "read") { return 1; }\n+export function action(mode: "send") { return 1; }\n',
  });
  assert.equal(a.impact.publicApiChanged, true);
  assert.ok(a.checks.findings.some((f) => f.kind === "public_api"));
});

test("export additions and removals are public API changes", async () => {
  for (const [before, after, exported] of [
    ["function helper() {}", "export function helper() {}", true],
    ["export function helper() {}", "function helper() {}", false],
    ["", "export function helper() {}", true],
  ] as const) {
    const result = await analyzeGovernance({
      title: "Change public surface",
      description: "",
      policy: "[]",
      manifest: "",
      diff: `diff --git a/src/util.ts b/src/util.ts\n--- a/src/util.ts\n+++ b/src/util.ts\n@@ -1,${before ? 1 : 0} +1 @@\n${before ? "-" + before + "\n" : ""}+${after}\n`,
    });
    assert.equal(result.impact.publicApiChanged, true);
    assert.equal(
      result.impact.changedSymbols.find((s) => s.name === "helper")?.exported,
      exported,
    );
  }
});
