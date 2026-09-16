import type { ChangeImpact, CodebaseManifest, SymbolGraph } from "../types/ast";
import type { GovernanceAnalysis, GovernanceInput } from "../types/governance";
import type { ParsedPullRequest } from "../src/pr-review/types";
import { parseDiff } from "./parseDiff";
import { buildSymbolGraph, parseManifest } from "./buildSymbolGraph";
import {
  parseGovernancePolicies,
  selectRelevantPolicies,
} from "./selectRelevantPolicies";
import { evaluateHardRules } from "./evaluateHardRules";
export const isTestPath = (p: string) =>
  /(^|\/)(__tests__|tests?|specs?)(\/|$)|\.(test|spec)\./i.test(p);
export const isGeneratedPath = (p: string) =>
  /(^|\/)(generated|vendor|node_modules|dist)(\/|$)|\.generated\./i.test(p);
export const isProtectedPath = (p: string) =>
  /(^|\/)(auth[^/]*|payments?[^/]*|permissions?[^/]*)(\/|$)|(^|\/)prod(?:uction)?(?:[./_-]|$)/i.test(
    p,
  );
export const isSecretPath = (p: string) =>
  /(^|\/)(secrets?|credentials?)(\/|$)|(^|\/)(\.env(?:\..*)?|\.envrc|[^/]*(?:secret|credential)[^/]*|[^/]+\.(?:pem|key|p12|pfx))$/i.test(
    p,
  );
export function analyzeImpact(
  pr: ParsedPullRequest,
  graph: SymbolGraph,
  manifest: CodebaseManifest,
): ChangeImpact {
  const changedPaths = [
    ...new Set(
      pr.files.flatMap((f) => [
        f.path,
        ...(f.previousPath ? [f.previousPath] : []),
      ]),
    ),
  ];
  const changedSymbols = graph.nodes.filter((s) =>
    graph.changedIds.includes(s.id),
  );
  const targets = new Set(graph.changedIds);
  let more = true;
  while (more) {
    more = false;
    for (const e of graph.edges)
      if (e.kind === "calls" && targets.has(e.to) && !targets.has(e.from)) {
        targets.add(e.from);
        more = true;
      }
  }
  const callerIds = new Set(
    graph.edges
      .filter((e) => e.kind === "calls" && targets.has(e.to))
      .map((e) => e.from),
  );
  const affectedCallers = graph.nodes.filter((s) => callerIds.has(s.id));
  const productionFiles = changedPaths.filter(
    (p) =>
      /\.(?:[cm]?[jt]sx?|py|go|rs|java|rb|cs)$/.test(p) &&
      !isTestPath(p) &&
      (!isGeneratedPath(p) || isProtectedPath(p)),
  );
  const testScope = manifest.tests
    .filter((t) => t.symbolIds.some((id) => graph.relevantIds.includes(id)))
    .map((t) => t.filePath);
  const changedTestFiles = changedPaths.filter(isTestPath);
  return {
    changedSymbols,
    affectedCallers,
    changedPaths,
    protectedPathsTouched: changedPaths.filter(isProtectedPath),
    secretsTouched: changedPaths.filter(isSecretPath),
    publicApiChanged: changedSymbols.some((s) => s.publicChanged),
    testsLikelyAffected: !!productionFiles.length,
    productionFiles,
    generatedFiles: changedPaths.filter(isGeneratedPath),
    missedCallerIds: affectedCallers
      .filter((s) => !graph.changedIds.includes(s.id))
      .map((s) => s.id),
    updatedCallerIds: affectedCallers
      .filter((s) => graph.changedIds.includes(s.id))
      .map((s) => s.id),
    testScope,
    changedTestFiles,
    relatedTestsChanged:
      testScope.length > 0 &&
      testScope.every((p) => changedTestFiles.includes(p)),
  };
}
export async function analyzeGovernance(
  input: GovernanceInput,
): Promise<GovernanceAnalysis> {
  const pr = parseDiff(input);
  const manifest = parseManifest(input.manifest);
  const graph = await buildSymbolGraph(pr, manifest);
  const impact = analyzeImpact(pr, graph, manifest);
  const policies = selectRelevantPolicies(
    impact,
    parseGovernancePolicies(input.policy),
  );
  return {
    pr,
    manifest,
    graph,
    impact,
    policies,
    checks: evaluateHardRules(pr, impact, graph, policies),
  };
}
