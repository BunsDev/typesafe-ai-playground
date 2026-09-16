import type { GovernanceAnalysis } from "../types/governance";
import type { GovernanceDecision, TestCacheResult } from "../types/review";
import { resolveReviewStatus } from "../lib/resolveReviewStatus";
import { OUTCOME_GUIDE } from "../lib/governanceCopy";
import { percent } from "../lib/client";
import { ImpactGraph } from "./ImpactGraph";
import { PolicyFindings } from "./PolicyFindings";
export function ReviewResults({
  analysis: a,
  decisions,
  threshold,
  cache,
  onSimulate,
  busy,
}: {
  analysis: GovernanceAnalysis;
  decisions: GovernanceDecision[];
  threshold: number;
  cache: TestCacheResult | null;
  onSimulate: () => void;
  busy: boolean;
}) {
  const result = resolveReviewStatus(a, decisions, threshold);
  const reviewFindings = a.checks.findings.filter((f) => f.severity !== "info");
  const mode = decisions.some((d) => d.source === "mock")
    ? "Demo labels · no Jev call"
    : decisions.some((d) => d.source === "jev")
      ? "Live Jev classifications"
      : "Static checks only";
  return (
    <div className="lab-result-stack">
      <div className="compact-verdict" role="status">
        <span className="eyebrow">MERGE RECOMMENDATION</span>
        <h2>
          {result.status === "needs_review"
            ? "Human review required"
            : result.status === "block_candidate"
              ? "Blocked by policy"
              : "Merge candidate"}
        </h2>
        <code>{result.status}</code>
        <span className="tag decision-source">{mode}</span>
        <p>{result.reason}</p>
        <p>
          <strong>Next step:</strong>{" "}
          {a.checks.blocked
            ? "Remove the sensitive-file change and analyze the proposal again."
            : result.status === "needs_review"
              ? "Review the flagged changes with a code owner, confirm caller compatibility, and verify the related tests."
              : "Continue your repository’s normal review and CI process; this is a candidate, not an automatic approval."}
        </p>
        <div className="impact-totals">
          <span>
            <b>{a.impact.changedSymbols.length}</b> changed symbols
          </span>
          <span>
            <b>{a.impact.affectedCallers.length}</b> affected callers
          </span>
          <span>
            <b>{reviewFindings.length}</b> reasons to review
          </span>
        </div>
      </div>
      {a.impact.changedSymbols.some((s) => s.publicChanged) && (
        <section>
          <h3>What changed in the public interface</h3>
          {a.impact.changedSymbols
            .filter((s) => s.publicChanged)
            .map((s) => (
              <article className="signature-change" key={s.id}>
                <code>{s.filePath}</code>
                <div>
                  <span>Before</span>
                  <code>
                    {s.name}({s.previousParameters?.join(", ")})
                  </code>
                </div>
                <div>
                  <span>After</span>
                  <code>
                    {s.name}({s.parameters?.join(", ")})
                  </code>
                </div>
                <p className="field-hint">
                  Compare the parameters above, then check each caller below.
                  Export or type changes can also trigger this rule; the
                  original diff is the full evidence.
                </p>
              </article>
            ))}
        </section>
      )}
      <ImpactGraph analysis={a} />
      <section>
        <h3>Affected callers · {a.impact.affectedCallers.length}</h3>
        <p className="field-hint">
          A caller uses a changed function, directly or through another caller.
          “Not updated” means no matching symbol update was found in this diff;
          it is a compatibility question, not proof of a bug.
        </p>
        {!a.impact.affectedCallers.length && (
          <p>
            No callers were identified in the supplied index. This does not
            establish that none exist.
          </p>
        )}
        {a.impact.affectedCallers.map((n) => (
          <div className="compact-finding" key={n.id}>
            <strong>{n.name}</strong>
            <span className="tag">
              {a.impact.missedCallerIds.includes(n.id)
                ? "Not updated — verify compatibility"
                : "Updated in diff"}
            </span>
            <code>{n.filePath}</code>
          </div>
        ))}
      </section>
      <PolicyFindings analysis={a} />
      <section>
        <h3>Jev classifications · {decisions.length}</h3>
        <p className="field-hint">
          Jev ranks six predefined outcomes for compatibility, test coverage or
          the change itself. Scores reflect model certainty, not proof that a
          bug exists. Both scores must meet {percent(threshold)}; fixed policy
          findings still win.
        </p>
        {!decisions.length && (
          <p className="field-hint">
            {a.checks.blocked
              ? "Hard block: nothing is sent to Jev."
              : "Classify ambiguous findings after inspecting the deterministic checks."}
          </p>
        )}
        {decisions.map((d) => (
          <article className="compact-finding" key={d.unit.id}>
            <strong>{d.outcome}</strong>
            <span className="tag">
              {d.source === "mock"
                ? "Demo prediction"
                : d.source === "jev"
                  ? "Live prediction"
                  : "Not classified"}
            </span>
            <p>{OUTCOME_GUIDE[d.outcome]}</p>
            <p>
              Confidence {percent(d.confidence)} · probability{" "}
              {percent(d.probability)} · {d.unit.focus}
            </p>
            <a href={`#gov-${d.unit.hunkId}`}>
              {d.unit.filePath} · original hunk
            </a>
            {d.error && <p>{d.error}</p>}
          </article>
        ))}
      </section>
      <section>
        <h3>
          Test impact <span className="tag">Simulation only</span>
        </h3>
        <strong>{cache?.action.replaceAll("_", " ")}</strong>
        <p>{cache?.reason}</p>
        <p className="field-hint">
          Suggested scope comes only from test-to-symbol mappings in your
          manifest. A matching cache requires identical dependency hashes,
          environment, policy and test scope.
        </p>
        {!a.impact.testScope.length && (
          <p>
            No test scope is known. Supply test mappings or ask a maintainer
            which tests cover this change.
          </p>
        )}
        <ul>
          {a.impact.testScope.map((p) => (
            <li key={p}>
              <code>{p}</code>
            </li>
          ))}
        </ul>
        <button
          className="button"
          onClick={onSimulate}
          disabled={busy || cache?.action === "needs_human_confirmation"}
        >
          Simulate verified test run
        </button>
        <p className="field-hint">
          No code or tests are executed. A cache match never overrides a
          governance finding.
        </p>
      </section>
      <section>
        <h3>Original diff evidence</h3>
        <p className="field-hint">
          Expand a hunk to inspect the exact source. Minus lines were removed;
          plus lines were added. Paths and line headers remain attached to every
          finding.
        </p>
        {a.pr.files
          .flatMap((f) => f.hunks)
          .map((h) => (
            <details id={`gov-${h.id}`} key={h.id} className="compact-finding">
              <summary>
                <strong>{h.path}</strong> <code>{h.header}</code>
              </summary>
              <pre className="diff-evidence">{h.diff}</pre>
            </details>
          ))}
      </section>
    </div>
  );
}
