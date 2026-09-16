import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parsePullRequest,
  buildHunkCandidates,
  classifyHunkWithJev,
  routeForReview,
  aggregateReviewResults,
  DEFAULT_THRESHOLDS,
  LABELS,
  type Classification,
} from "../src/pr-review";
const diff = `diff --git a/src/auth.ts b/src/auth.ts
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -1,3 +1,3 @@
-export function auth(token: string) {
-  return verify(token);
+export function auth(token: string, bypass: boolean) {
+  return bypass || verify(token);
 }
`;
const pr = () =>
  parsePullRequest({
    diff,
    title: "Add bypass",
    description: "New auth parameter",
  });
function result(
  labels: string[] = ["safe_change"],
  confidence = 0.99,
): Classification {
  const hunk = pr().files[0].hunks[0];
  return {
    hunk,
    candidates: buildHunkCandidates(hunk, []),
    decisions: LABELS.map((label) => ({
      label,
      selected: labels.includes(label) ? label : "not_applicable",
      confidence,
      probability: confidence,
      certainty: confidence,
    })),
    rule: {
      selected: "hunk_evidence",
      confidence,
      probability: confidence,
      certainty: confidence,
    },
    source: "jev",
  };
}
test("parser preserves paths and exact hunk evidence and detects truncation", () => {
  const parsed = pr();
  assert.equal(parsed.files[0].path, "src/auth.ts");
  assert.match(parsed.files[0].hunks[0].diff, /\+  return bypass/);
  assert.equal(parsed.files[0].hunks[0].complete, true);
  assert.equal(
    parsePullRequest({
      diff: diff.replace("+  return bypass || verify(token);\n", ""),
    }).files[0].hunks[0].complete,
    false,
  );
});
test("binary and rename-only files remain explicit review units", () => {
  const parsed = parsePullRequest({
    diff: "diff --git a/a.png b/a.png\nBinary files a/a.png and b/a.png differ\ndiff --git a/old.ts b/new.ts\nsimilarity index 100%\nrename from old.ts\nrename to new.ts\n",
  });
  assert.equal(parsed.files.length, 2);
  assert.ok(
    parsed.files.every((f) => f.hunks.length === 1 && !f.hunks[0].complete),
  );
  assert.equal(parsed.files[1].previousPath, "old.ts");
});
test("empty and unsupported input cannot become an approval", () => {
  assert.throws(() => parsePullRequest({ diff: "hello" }));
  assert.equal(aggregateReviewResults([]).decision, "needs_review");
});
test("closed-set request includes unknown and human escape options in every question", async () => {
  const hunk = pr().files[0].hunks[0];
  const candidates = buildHunkCandidates(hunk, []);
  const output = await classifyHunkWithJev(
    hunk,
    candidates,
    { pr: pr(), rules: [] },
    async (payload) => {
      assert.equal((payload.state as any).hunk.diff, hunk.diff);
      const answers = Object.fromEntries(
        Object.entries(payload.questions).map(([id, q]) => {
          assert.equal(q.type, "choice");
          assert.ok(q.criteria && !Array.isArray(q.criteria));
          assert.ok((q.criteria as any).unknown);
          assert.ok((q.criteria as any).needs_human_review);
          const choice =
            id === "rule"
              ? "hunk_evidence"
              : id === "safe_change"
                ? "safe_change"
                : "not_applicable";
          return [
            id,
            {
              type: "choice",
              choice,
              confidence: 0.99,
              probabilities: { [choice]: 0.99 },
            },
          ];
        }),
      );
      return { answers };
    },
  );
  assert.equal(routeForReview(output, DEFAULT_THRESHOLDS).route, "skip");
});
test("invented labels and missing confidence fail closed", async () => {
  const hunk = pr().files[0].hunks[0];
  const candidates = buildHunkCandidates(hunk, []);
  await assert.rejects(
    classifyHunkWithJev(
      hunk,
      candidates,
      { pr: pr(), rules: [] },
      async () => ({
        answers: {
          safe_change: { type: "choice", choice: "invented", confidence: 1 },
        },
      }),
    ),
  );
  const r = result();
  r.decisions[1].certainty = null;
  assert.notEqual(routeForReview(r, DEFAULT_THRESHOLDS).route, "skip");
});
test("high risks override generated labels; protected paths and conflicts cannot skip", () => {
  assert.equal(
    routeForReview(
      result(["security_risk", "generated_or_vendor_code"]),
      DEFAULT_THRESHOLDS,
    ).decision,
    "block_candidate",
  );
  assert.equal(
    routeForReview(result(["safe_change", "possible_bug"]), DEFAULT_THRESHOLDS)
      .route,
    "human",
  );
  const r = result();
  r.candidates = buildHunkCandidates(r.hunk, [
    {
      id: "auth",
      kind: "protected_path",
      path: "src/auth.ts",
      text: "Auth requires human review",
    },
  ]);
  assert.equal(routeForReview(r, DEFAULT_THRESHOLDS).route, "human");
});
test("thresholds re-route saved classifications and incomplete runs never approve", () => {
  const r = result(["safe_change"], 0.9);
  assert.notEqual(routeForReview(r, DEFAULT_THRESHOLDS).route, "skip");
  const routed = routeForReview(r, { ...DEFAULT_THRESHOLDS, safe: 0.85 });
  assert.equal(routed.route, "skip");
  assert.equal(aggregateReviewResults([routed], 2).decision, "needs_review");
  assert.equal(
    aggregateReviewResults([routed], 1).decision,
    "approve_candidate",
  );
  assert.throws(() =>
    routeForReview(r, { safe: NaN, risk: 0.8, minimum: 0.6 }),
  );
});

test("parser retains quoted paths, deleted files, and paths beginning with a/", () => {
  assert.equal(
    parsePullRequest(
      "diff --git a/a/file.ts b/a/file.ts\nold mode 100644\nnew mode 100755\n",
    ).files[0].path,
    "a/file.ts",
  );
  assert.equal(
    parsePullRequest(
      'diff --git "a/file name.ts" "b/file name.ts"\n--- "a/file name.ts"\n+++ "b/file name.ts"\n@@ -1 +1 @@\n-old\n+new\n',
    ).files[0].path,
    "file name.ts",
  );
  assert.equal(
    parsePullRequest(
      "diff --git a/removed.ts b/removed.ts\n--- a/removed.ts\n+++ /dev/null\n@@ -1 +0,0 @@\n-old\n",
    ).files[0].path,
    "removed.ts",
  );
});
test("cancelled review leaves queued hunks explicitly unclassified", async () => {
  const { reviewPullRequest, SAMPLE_PR, SAMPLE_RULES } =
    await import("../src/pr-review");
  const controller = new AbortController();
  controller.abort();
  const seen: Classification[] = [];
  const output = await reviewPullRequest(
    parsePullRequest(SAMPLE_PR),
    SAMPLE_RULES,
    {
      signal: controller.signal,
      onResult: (r) => seen.push(r),
      transport: async () => {
        throw Error("must not call");
      },
    },
  );
  assert.equal(seen.length, 3);
  assert.ok(output.every((r) => r.source === "unclassified"));
  assert.equal(
    aggregateReviewResults(output.map((r) => routeForReview(r))).decision,
    "needs_review",
  );
});

test("plain single-file unified diff has no phantom metadata file", () => {
  const pr = parsePullRequest({
    diff: "--- a/src/util.ts\n+++ b/src/util.ts\n@@ -1 +1 @@\n-const x = 1;\n+const x = 2;\n",
  });
  assert.equal(pr.files.length, 1);
  assert.equal(pr.files[0].path, "src/util.ts");
  assert.equal(pr.files[0].hunks.length, 1);
});
