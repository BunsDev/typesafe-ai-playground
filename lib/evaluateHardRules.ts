import type { ChangeImpact, SymbolGraph } from "../types/ast";
import type { GovernancePolicy, PolicyFinding } from "../types/governance";
import type { ParsedPullRequest } from "../src/pr-review/types";
import { matchesPolicyPath } from "./selectRelevantPolicies";
export function evaluateHardRules(
  pr: ParsedPullRequest,
  impact: ChangeImpact,
  graph: SymbolGraph,
  policies: GovernancePolicy[],
) {
  const findings: PolicyFinding[] = [];
  function add(
    kind: PolicyFinding["kind"],
    severity: PolicyFinding["severity"],
    message: string,
    paths: string[],
    symbolIds: string[] = [],
  ) {
    findings.push({
      id: `${kind}-${findings.length}`,
      kind,
      severity,
      message,
      filePaths: paths,
      hunkIds: pr.files
        .filter(
          (f) =>
            paths.includes(f.path) ||
            (!!f.previousPath && paths.includes(f.previousPath)),
        )
        .flatMap((f) => f.hunks.map((h) => h.id)),
      symbolIds,
    });
  }
  if (impact.secretsTouched.length)
    add(
      "secrets",
      "block",
      "Secrets, credential, or environment files were touched. Jev is not called for this PR.",
      impact.secretsTouched,
    );
  if (impact.protectedPathsTouched.length)
    add(
      "protected_path",
      "review",
      "Protected paths require owner review; generated code does not bypass this rule.",
      impact.protectedPathsTouched,
    );
  if (impact.publicApiChanged)
    add(
      "public_api",
      "review",
      `Public parameters or exports changed. ${impact.missedCallerIds.length} known caller(s) have no corresponding symbol update in the supplied diff.`,
      impact.changedSymbols
        .filter((s) => s.publicChanged)
        .map((s) => s.filePath),
      impact.changedSymbols.filter((s) => s.publicChanged).map((s) => s.id),
    );
  if (impact.testsLikelyAffected && !impact.relatedTestsChanged)
    add(
      "missing_tests",
      "review",
      "Production code changed without all related manifest-listed tests being updated. Existing tests have not been executed.",
      impact.productionFiles,
    );
  if (
    (impact.productionFiles.length && !graph.complete) ||
    pr.files.some((f) => f.hunks.some((h) => !h.complete))
  )
    add(
      "context",
      "review",
      "The mock index or diff is incomplete. A real parser and repository context are needed to confirm impact.",
      impact.changedPaths,
    );
  if (impact.generatedFiles.length)
    add(
      "generated",
      "info",
      "Generated/vendor files are lower priority; this does not prove that their changes are safe.",
      impact.generatedFiles,
    );
  for (const p of policies.filter((p) => p.source === "repo")) {
    const paths = impact.changedPaths.filter((path) =>
      p.paths!.some((glob) => matchesPolicyPath(path, glob)),
    );
    add("repo_policy", "review", `${p.id}: ${p.description}`, paths);
  }
  return { blocked: findings.some((f) => f.severity === "block"), findings };
}

export { evaluateWorkflowRules } from "./toolRouterRules";
