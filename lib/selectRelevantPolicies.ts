import type { ChangeImpact } from "../types/ast";
import type { GovernancePolicy } from "../types/governance";
export function matchesPolicyPath(path: string, glob: string) {
  return new RegExp(
    `^${glob
      .split("*")
      .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join(".*")}$`,
  ).test(path);
}
export function parseGovernancePolicies(raw: string): GovernancePolicy[] {
  if (raw.length > 26000) throw Error("Policy must be under 26 KB.");
  const items = JSON.parse(raw.trim() || "[]");
  const ids = new Set();
  if (!Array.isArray(items) || items.length > 20)
    throw Error("Use a policy array of at most 20 rules.");
  return items.map((p) => {
    if (
      !p ||
      !/^[a-z][a-z0-9_]{0,39}$/.test(p.id) ||
      ids.has(p.id) ||
      [
        "secrets",
        "protected_paths",
        "public_api",
        "tests",
        "generated",
      ].includes(p.id) ||
      !["protected_path", "test_requirement", "security", "style"].includes(
        p.kind,
      ) ||
      typeof p.description !== "string" ||
      !p.description.trim() ||
      p.description.length > 1000 ||
      !Array.isArray(p.paths) ||
      p.paths.length > 20 ||
      !p.paths.length ||
      p.paths.some(
        (x: unknown) => typeof x !== "string" || !x || x.length > 250,
      ) ||
      (p.symbols !== undefined &&
        (!Array.isArray(p.symbols) ||
          p.symbols.length > 50 ||
          p.symbols.some(
            (x: unknown) => typeof x !== "string" || !x || x.length > 250,
          )))
    )
      throw Error(
        "Each policy needs a unique id, valid kind, nonempty paths array, and description.",
      );
    ids.add(p.id);
    return {
      id: p.id,
      kind: p.kind,
      paths: p.paths,
      symbols: p.symbols,
      description: p.description,
      source: "repo" as const,
    };
  });
}
export function selectRelevantPolicies(
  impact: ChangeImpact,
  repoRules: GovernancePolicy[],
): GovernancePolicy[] {
  const builtins: [string, string, boolean][] = [
    [
      "secrets",
      "Secrets, credentials, and environment files must not enter a merge candidate.",
      !!impact.secretsTouched.length,
    ],
    [
      "protected_paths",
      "Auth, payments, permissions, and production configuration require human review.",
      !!impact.protectedPathsTouched.length,
    ],
    [
      "public_api",
      "Public parameter or export changes require caller compatibility review.",
      impact.publicApiChanged,
    ],
    [
      "tests",
      "Production changes need related test updates and a verified test scope.",
      impact.testsLikelyAffected,
    ],
    [
      "generated",
      "Generated/vendor changes are low priority, unless protected or otherwise risky.",
      !!impact.generatedFiles.length,
    ],
  ];
  return [
    ...builtins
      .filter(([, , active]) => active)
      .map(([id, description]) => ({
        id,
        description,
        kind: "builtin" as const,
        source: "builtin" as const,
      })),
    ...repoRules.filter(
      (p) =>
        impact.changedPaths.some((path) =>
          p.paths!.some((glob) => matchesPolicyPath(path, glob)),
        ) &&
        (!p.symbols?.length ||
          impact.changedSymbols.some(
            (s) => p.symbols!.includes(s.id) || p.symbols!.includes(s.name),
          )),
    ),
  ];
}
