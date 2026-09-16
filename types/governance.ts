import type { ChangeImpact, CodebaseManifest, SymbolGraph } from "./ast";
import type { ParsedPullRequest } from "../src/pr-review/types";
export type GovernancePolicy = {
  id: string;
  kind:
    "protected_path" | "test_requirement" | "security" | "style" | "builtin";
  paths?: string[];
  symbols?: string[];
  description: string;
  source?: "builtin" | "repo";
};
export type PolicyFinding = {
  id: string;
  kind:
    | "secrets"
    | "protected_path"
    | "public_api"
    | "missing_tests"
    | "context"
    | "generated"
    | "repo_policy";
  severity: "block" | "review" | "info";
  message: string;
  filePaths: string[];
  hunkIds: string[];
  symbolIds: string[];
};
export type GovernanceAnalysis = {
  pr: ParsedPullRequest;
  manifest: CodebaseManifest;
  graph: SymbolGraph;
  impact: ChangeImpact;
  policies: GovernancePolicy[];
  checks: { blocked: boolean; findings: PolicyFinding[] };
};
export type GovernanceInput = {
  title: string;
  description: string;
  diff: string;
  manifest: string;
  policy: string;
};
