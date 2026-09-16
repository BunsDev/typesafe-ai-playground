import type { PolicyFinding } from "../types/governance";
import type { ReviewOutcome } from "../types/review";
export const FINDING_GUIDE: Record<
  PolicyFinding["kind"],
  { title: string; why: string; next: string }
> = {
  secrets: {
    title: "Sensitive file changed",
    why: "Environment and credential files can expose secrets. This built-in rule stops classification before any content reaches Jev.",
    next: "Remove the sensitive-file change from this proposal and follow your repository’s secret-handling process.",
  },
  protected_path: {
    title: "Protected area needs an owner",
    why: "Authentication, payments, permissions and production configuration can affect access or live behavior.",
    next: "Ask the responsible code owner to inspect the linked changes.",
  },
  public_api: {
    title: "A function’s public contract changed",
    why: "Code calling this function may still use the previous parameters or exported interface.",
    next: "Check every listed caller, including unchanged ones, and confirm compatibility.",
  },
  missing_tests: {
    title: "Related test updates are missing",
    why: "Production behavior changed, but the supplied diff does not update all tests mapped to the affected symbols. This does not prove existing tests are inadequate.",
    next: "Review the suggested test scope below, add coverage where needed, and run it in your real repository.",
  },
  context: {
    title: "The codebase picture is incomplete",
    why: "A diff is only a fragment. Missing symbols, unresolved dependencies or unsupported syntax prevent a reliable impact assessment.",
    next: "Supply a more complete manifest or use compiler-backed analysis before approving.",
  },
  generated: {
    title: "Generated code has lower priority",
    why: "Generated or vendor paths usually need less manual attention. Protected paths still take precedence.",
    next: "Verify the source or generator change; do not use this classification to bypass other findings.",
  },
  repo_policy: {
    title: "A repository rule applies",
    why: "The changed path or symbol matches a rule supplied with this proposal.",
    next: "Check the activated rule and linked evidence with its owner.",
  },
};
export const OUTCOME_GUIDE: Record<ReviewOutcome, string> = {
  safe_change:
    "The supplied evidence looks low risk; policy findings still apply.",
  possible_breaking_change:
    "A signature or caller change may break compatibility.",
  missing_test_coverage:
    "The supplied change lacks corresponding test evidence.",
  security_or_policy_risk:
    "The change may affect security or an activated policy.",
  needs_human_review: "The classifier cannot safely settle this finding.",
  needs_more_context: "More codebase or test context is needed.",
};
