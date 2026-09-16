import type {
  CodebaseManifest,
  SymbolGraph,
  SymbolNode,
  SymbolEdge,
} from "../types/ast";
import type { ParsedPullRequest } from "../src/pr-review/types";
export async function hashStructured(value: unknown): Promise<string> {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
const text = (v: unknown, max = 1024): v is string =>
  typeof v === "string" &&
  v.length > 0 &&
  v.length <= max &&
  !/[\x00-\x1f]/.test(v);
const stringList = (v: unknown) =>
  v === undefined ||
  (Array.isArray(v) && v.length <= 50 && v.every((s) => text(s)));
export function parseManifest(raw: string): CodebaseManifest {
  if (raw.length > 100000) throw Error("Manifest must be under 100 KB.");
  if (!raw.trim())
    return { complete: false, environmentHash: "", symbols: [], tests: [] };
  const value = JSON.parse(raw);
  if (
    !value ||
    !Array.isArray(value.symbols) ||
    value.symbols.length > 100 ||
    !Array.isArray(value.tests) ||
    value.tests.length > 100
  )
    throw Error(
      "Manifest requires symbols and tests arrays, at most 100 each.",
    );
  const ids = new Set<string>();
  const symbols: SymbolNode[] = value.symbols.map((s: SymbolNode) => {
    if (
      !s ||
      !text(s.id, 250) ||
      ids.has(s.id) ||
      !text(s.filePath) ||
      !text(s.name, 150) ||
      !["function", "class", "method", "module"].includes(s.kind) ||
      !stringList(s.parameters) ||
      !stringList(s.calls) ||
      !stringList(s.imports) ||
      (s.hash !== undefined && !text(s.hash, 250)) ||
      (s.exported !== undefined && typeof s.exported !== "boolean") ||
      ((s.startLine !== undefined || s.endLine !== undefined) &&
        (!Number.isInteger(s.startLine) ||
          !Number.isInteger(s.endLine) ||
          s.startLine! < 1 ||
          s.endLine! < s.startLine!))
    )
      throw Error("Invalid or duplicate symbol in manifest.");
    ids.add(s.id);
    return {
      id: s.id,
      filePath: s.filePath,
      name: s.name,
      kind: s.kind,
      parameters: s.parameters,
      calls: s.calls,
      imports: s.imports,
      hash: s.hash,
      exported: s.exported,
      startLine: s.startLine,
      endLine: s.endLine,
    };
  });
  const tests = value.tests.map(
    (t: { filePath: string; symbolIds: string[] }) => {
      if (
        !t ||
        !text(t.filePath) ||
        !Array.isArray(t.symbolIds) ||
        t.symbolIds.length > 100 ||
        !t.symbolIds.every((id) => text(id, 250) && ids.has(id))
      )
        throw Error("Tests must reference known symbol IDs and a filePath.");
      return { filePath: t.filePath, symbolIds: t.symbolIds };
    },
  );
  if (value.environmentHash !== undefined && !text(value.environmentHash, 250))
    throw Error("Invalid environmentHash.");
  const prior = value.priorVerifiedRun;
  if (
    prior &&
    (prior.simulated !== true ||
      prior.verified !== true ||
      !text(prior.fingerprint, 64) ||
      !prior.symbolHashes ||
      typeof prior.symbolHashes !== "object" ||
      Array.isArray(prior.symbolHashes) ||
      Object.values(prior.symbolHashes).some((h) => !text(h, 250)) ||
      !Array.isArray(prior.tests) ||
      !prior.tests.every((p: unknown) => text(p)) ||
      !text(prior.environmentHash, 250))
  )
    throw Error("Invalid simulated priorVerifiedRun.");
  return {
    complete: value.complete === true,
    environmentHash: value.environmentHash || "",
    symbols,
    tests,
    priorVerifiedRun: prior,
  };
}
type Declaration = {
  name: string;
  kind: SymbolNode["kind"];
  parameters: string[];
  signature: string;
  exported: boolean;
};
/** Mask literal/comment contents before inspecting code-shaped text. Keeps offsets and newlines. */
function maskCode(code: string) {
  return code.replace(
    /\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|`(?:\\[\s\S]|[^`\\])*`/g,
    (literal) => literal.replace(/[^\n]/g, " "),
  );
}
function declarations(code: string): Declaration[] {
  const original = code;
  code = maskCode(code);
  const out: Declaration[] = [];
  for (const pattern of [
    /(export\s+)?(?:async\s+)?function\s+([\w$]+)\s*\(([^)]*)\)/g,
    /(export\s+)?(?:const|let)\s+([\w$]+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*(?::[^=\n]+)?=>/g,
  ])
    for (const m of code.matchAll(pattern)) {
      const start = m.index! + m[0].indexOf("(") + 1;
      const parameters = original.slice(start, start + m[3].length);
      out.push({
        name: m[2],
        kind: "function",
        parameters: parameters
          .split(",")
          .map((p) => p.trim().split(/[:=]/)[0].trim())
          .filter(Boolean),
        signature: parameters.replace(/\s+/g, " ").trim(),
        exported: !!m[1],
      });
    }
  for (const m of code.matchAll(/(export\s+)?class\s+([\w$]+)/g))
    out.push({
      name: m[2],
      kind: "class",
      parameters: [],
      signature: "",
      exported: !!m[1],
    });
  return out;
}
function normalizedImport(file: string, entry: string) {
  const parts = file.split("/").slice(0, -1);
  for (const part of entry.split("/")) {
    if (part === "..") parts.pop();
    else if (part !== "." && part) parts.push(part);
  }
  return parts.join("/");
}
export async function buildSymbolGraph(
  pr: ParsedPullRequest,
  manifest: CodebaseManifest,
): Promise<SymbolGraph> {
  const nodes = new Map(
    manifest.symbols.map((s) => [
      s.id,
      {
        ...s,
        calls: [...(s.calls || [])],
        imports: [...(s.imports || [])],
      } as SymbolNode,
    ]),
  );
  const changed = new Set<string>();
  const issues: string[] = [];
  const parsedCalls = new Map<string, string[]>();
  for (const file of pr.files)
    for (const hunk of file.hunks) {
      if (!hunk.complete) issues.push(`${file.path}: ${hunk.issue}`);
      const lines = hunk.diff.split("\n").slice(1);
      const before = lines
        .filter((l) => l.startsWith(" ") || l.startsWith("-"))
        .map((l) => l.slice(1))
        .join("\n");
      const after = lines
        .filter((l) => l.startsWith(" ") || l.startsWith("+"))
        .map((l) => l.slice(1))
        .join("\n");
      const old = declarations(before);
      const next = declarations(after);
      const allNames = [...new Set([...old, ...next].map((d) => d.name))];
      // A declaration visible as context is not evidence that its caller was updated.
      const changedDeclarationNames = new Set(
        declarations(
          lines
            .filter((l) => l.startsWith("+") || l.startsWith("-"))
            .map((l) => l.slice(1))
            .join("\n"),
        ).map((d) => d.name),
      );
      const names = allNames.filter((name) =>
        changedDeclarationNames.has(name),
      );
      if (!names.length && allNames.length === 1) names.push(allNames[0]);
      if (allNames.length > 1)
        issues.push(
          `${file.path}: multiple declarations in one hunk need compiler-backed ownership analysis; context-only declarations are not confirmed updates.`,
        );
      const maskedAfter = maskCode(after);
      if (after.includes("${"))
        issues.push(
          `${file.path}: template interpolation needs compiler-backed analysis.`,
        );
      const imports = [
        ...after.matchAll(
          /\bimport\s+(?:[^;\n]*?\s+from\s+)?["']([^"']+)["']/g,
        ),
      ]
        .filter((m) => maskedAfter.slice(m.index!, m.index! + 6) === "import")
        .map((m) => m[1]);
      if (!names.length) {
        const owners = manifest.symbols.filter(
          (s) =>
            s.filePath === file.path &&
            s.startLine !== undefined &&
            hunk.oldStart >= s.startLine &&
            hunk.oldStart <= s.endLine!,
        );
        if (owners.length) names.push(...owners.map((s) => s.name));
        else {
          names.push("(module)");
          if (/\.[cm]?[jt]sx?$/.test(file.path))
            issues.push(
              `${file.path}: no function owner can be established for ${hunk.header}.`,
            );
        }
      }
      for (const name of names) {
        const prior = manifest.symbols.find(
          (s) => s.filePath === file.path && s.name === name,
        );
        const removed = old.find((d) => d.name === name);
        const added = next.find((d) => d.name === name);
        const id = prior?.id || `${file.path}#${name}`;
        const previous = nodes.get(id);
        const parameters = added?.parameters || prior?.parameters || [];
        const wasPublic = removed?.exported ?? prior?.exported ?? false;
        const isPublic = added?.exported ?? (removed ? false : wasPublic);
        const publicChanged =
          wasPublic !== isPublic ||
          (wasPublic &&
            ((!!removed && !added) ||
              (!!removed &&
                !!added &&
                (removed.signature !== added.signature ||
                  removed.exported !== added.exported)) ||
              (!removed &&
                !!prior &&
                !!added &&
                JSON.stringify(prior.parameters) !==
                  JSON.stringify(parameters))));
        const node: SymbolNode = {
          id,
          filePath: file.path,
          name,
          kind: added?.kind || prior?.kind || removed?.kind || "module",
          parameters,
          previousParameters: removed?.parameters || prior?.parameters,
          exported: isPublic,
          publicChanged: publicChanged || previous?.publicChanged,
          calls: [
            ...new Set([...(previous?.calls || []), ...(prior?.calls || [])]),
          ],
          imports: [...new Set([...(previous?.imports || []), ...imports])],
          hunkIds: [...new Set([...(previous?.hunkIds || []), hunk.id])],
          hash: await hashStructured({
            prior: previous?.hash || null,
            after,
            hunk: hunk.id,
            parameters,
          }),
        };
        if ((added?.signature || "").match(/[{}[\]]|=>/))
          issues.push(
            `${file.path}#${name}: complex parameter syntax requires compiler-backed analysis.`,
          );
        nodes.set(id, node);
        changed.add(id);
        const body = maskedAfter.replace(/function\s+[\w$]+\s*\([^)]*\)/g, "");
        // A hunk containing several declarations does not establish which body owns a call.
        const ambiguousCalls =
          allNames.length > 1 || /(?:\.[\w$]+|\])\s*\(/.test(body);
        if (ambiguousCalls)
          issues.push(
            `${file.path}: call ownership requires compiler-backed analysis; only manifest call edges are retained.`,
          );
        parsedCalls.set(id, [
          ...new Set([
            ...(parsedCalls.get(id) || []),
            ...[...(ambiguousCalls ? "" : body).matchAll(/\b([\w$]+)\s*\(/g)]
              .map((m) => m[1])
              .filter(
                (n) =>
                  ![
                    "if",
                    "for",
                    "while",
                    "switch",
                    "catch",
                    "function",
                    "return",
                    "constructor",
                  ].includes(n) && n !== name,
              ),
          ]),
        ]);
      }
    }
  const edges: SymbolEdge[] = [];
  function edge(from: string, to: string, kind: SymbolEdge["kind"]) {
    if (!edges.some((e) => e.from === from && e.to === to && e.kind === kind))
      edges.push({ from, to, kind });
  }
  const unresolved = new Map<string, string[]>();
  for (const node of [...nodes.values()]) {
    for (const target of node.calls || []) {
      const candidates = nodes.has(target)
        ? [nodes.get(target)!]
        : [...nodes.values()].filter((s) => s.name === target);
      if (candidates.length === 1) edge(node.id, candidates[0].id, "calls");
      else
        unresolved.set(node.id, [...(unresolved.get(node.id) || []), target]);
    }
    for (const observed of parsedCalls.get(node.id) || []) {
      const indexed = (node.calls || []).some(
        (ref) => ref === observed || nodes.get(ref)?.name === observed,
      );
      if (!indexed)
        unresolved.set(node.id, [
          ...(unresolved.get(node.id) || []),
          `unindexed call ${observed}; a manifest relationship or compiler binding is required`,
        ]);
    }
    for (const entry of node.imports || []) {
      const base = entry.startsWith(".")
        ? normalizedImport(node.filePath, entry)
        : entry;
      const targets = [...nodes.values()].filter((s) =>
        [
          base,
          `${base}.ts`,
          `${base}.tsx`,
          `${base}.js`,
          `${base}/index.ts`,
        ].includes(s.filePath),
      );
      if (targets.length) {
        for (const target of targets) edge(node.id, target.id, "imports");
      } else
        unresolved.set(node.id, [
          ...(unresolved.get(node.id) || []),
          `import ${entry}`,
        ]);
    }
  }
  const relevant = new Set(changed);
  let grow = true;
  while (grow) {
    grow = false;
    for (const e of edges)
      if (relevant.has(e.from) || relevant.has(e.to)) {
        for (const id of [e.from, e.to])
          if (!relevant.has(id)) {
            relevant.add(id);
            grow = true;
          }
      }
  }
  for (const id of relevant) {
    const node = nodes.get(id)!;
    if (!node.hash) issues.push(`${id}: dependency hash is missing.`);
    for (const missing of unresolved.get(id) || [])
      issues.push(`${id}: unresolved ${missing}.`);
  }
  if (nodes.size > 200 || edges.length > 500)
    throw Error("Graph exceeds prototype limits: 200 symbols or 500 edges.");
  return {
    nodes: [...nodes.values()],
    edges,
    changedIds: [...changed],
    relevantIds: [...relevant],
    issues: [...new Set(issues)],
    complete: manifest.complete && issues.length === 0,
  };
}
