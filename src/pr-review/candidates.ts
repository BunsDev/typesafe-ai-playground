import { LABELS, type Candidates, type Hunk, type RepoRule } from "./types";
export function parseRepoRules(raw: string): RepoRule[] {
  const rules: unknown = JSON.parse(raw || "[]");
  if (!Array.isArray(rules) || rules.length > 20)
    throw Error("Use a JSON array of at most 20 repository rules.");
  const ids = new Set<string>();
  return rules.map((rule) => {
    if (
      !rule ||
      typeof rule !== "object" ||
      !/^[a-z][a-z0-9_]{0,39}$/.test(rule.id) ||
      ["unknown", "needs_human_review", "hunk_evidence"].includes(rule.id) ||
      ids.has(rule.id) ||
      !["protected_path", "test_requirement", "security", "style"].includes(
        rule.kind,
      ) ||
      typeof rule.path !== "string" ||
      !rule.path ||
      rule.path.length > 200 ||
      typeof rule.text !== "string" ||
      !rule.text.trim() ||
      rule.text.length > 1000
    )
      throw Error(
        "Each rule needs a unique lowercase id, valid kind, path glob, and text (max 1,000 characters).",
      );
    ids.add(rule.id);
    return { id: rule.id, kind: rule.kind, path: rule.path, text: rule.text };
  });
}
function matches(path: string, glob: string) {
  return new RegExp(
    `^${glob
      .split("*")
      .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join(".*")}$`,
  ).test(path);
}
export function buildHunkCandidates(
  hunk: Hunk,
  repoRules: RepoRule[],
): Candidates {
  const applicable = repoRules.filter(
    (rule) =>
      matches(hunk.path, rule.path) ||
      (!!hunk.previousPath && matches(hunk.previousPath, rule.path)),
  );
  const descriptions = [
    "The visible hunk has no apparent behavior, compatibility, test, or security concern. Do not assume unseen context is safe.",
    "The visible change supplies concrete evidence of a possible logic or correctness defect, not an invented hypothetical bug.",
    "A behavior change appears to need tests under the supplied test requirements, and corresponding test updates are absent from the supplied changed-file evidence. Existing repository tests are unknown.",
    "The visible code indicates a potential security regression such as bypassed authorization or exposed secrets.",
    "The visible diff changes a public contract, required parameter, exported signature, or behavior in a potentially incompatible way.",
    "The supplied file path and diff indicate generated or vendored content. This label does not override any risk or protected-path rule.",
    "Human judgment or unavailable repository context is needed to assess this change responsibly.",
  ];
  return {
    labels: Object.fromEntries(
      LABELS.map((label, i) => [label, descriptions[i]]),
    ) as Candidates["labels"],
    rules: {
      hunk_evidence:
        "Use the original diff hunk as evidence; no supplied repository rule specifically applies.",
      ...Object.fromEntries(
        applicable.map((rule) => [
          rule.id,
          `${rule.kind}: ${rule.text} (path: ${rule.path})`,
        ]),
      ),
    },
    protected: applicable.some((rule) => rule.kind === "protected_path"),
    testsRequired: applicable.some((rule) => rule.kind === "test_requirement"),
  };
}
