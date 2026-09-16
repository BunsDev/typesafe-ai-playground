export type SymbolNode = {
  id: string;
  filePath: string;
  kind: "function" | "class" | "method" | "module";
  name: string;
  parameters?: string[];
  calls?: string[];
  imports?: string[];
  hash?: string;
  exported?: boolean;
  previousParameters?: string[];
  publicChanged?: boolean;
  hunkIds?: string[];
  startLine?: number;
  endLine?: number;
};
export type SymbolEdge = {
  from: string;
  to: string;
  kind: "calls" | "imports";
};
export type SymbolGraph = {
  nodes: SymbolNode[];
  edges: SymbolEdge[];
  changedIds: string[];
  relevantIds: string[];
  issues: string[];
  complete: boolean;
};
export type VerifiedRun = {
  simulated: true;
  verified: true;
  fingerprint: string;
  symbolHashes: Record<string, string>;
  tests: string[];
  environmentHash: string;
};
export type CodebaseManifest = {
  complete: boolean;
  environmentHash: string;
  symbols: SymbolNode[];
  tests: { filePath: string; symbolIds: string[] }[];
  priorVerifiedRun?: VerifiedRun;
};
export type ChangeImpact = {
  changedSymbols: SymbolNode[];
  affectedCallers: SymbolNode[];
  protectedPathsTouched: string[];
  publicApiChanged: boolean;
  testsLikelyAffected: boolean;
  changedPaths: string[];
  secretsTouched: string[];
  productionFiles: string[];
  generatedFiles: string[];
  missedCallerIds: string[];
  updatedCallerIds: string[];
  testScope: string[];
  changedTestFiles: string[];
  relatedTestsChanged: boolean;
};
