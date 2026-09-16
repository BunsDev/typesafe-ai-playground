import { FINDING_GUIDE } from "../lib/governanceCopy";
import type { GovernanceAnalysis } from "../types/governance";
export function PolicyFindings({
  analysis: a,
}: {
  analysis: GovernanceAnalysis;
}) {
  return (
    <section>
      <h3>Why these rules fired</h3>
      <p className="field-hint">
        These are deterministic checks against paths, signatures and test
        mappings. Jev cannot remove them.
      </p>
      {a.checks.findings.map((f) => (
        <article className="compact-finding" key={f.id}>
          <span className="tag">{f.severity}</span>
          <strong>{FINDING_GUIDE[f.kind].title}</strong>
          <p>{f.message}</p>
          <details className="finding-explanation">
            <summary>Why it matters &amp; what to do</summary>
            <p>
              <strong>Why:</strong> {FINDING_GUIDE[f.kind].why}
            </p>
            <p>
              <strong>Next:</strong> {FINDING_GUIDE[f.kind].next}
            </p>
          </details>
          <div className="evidence-links">
            {f.hunkIds.map((id) => (
              <a key={id} href={`#gov-${id}`}>
                {
                  a.pr.files.flatMap((f) => f.hunks).find((h) => h.id === id)
                    ?.path
                }{" "}
                · diff
              </a>
            ))}
          </div>
        </article>
      ))}
      {!a.checks.findings.length && (
        <p>No deterministic findings within the supplied snapshot.</p>
      )}
      <details>
        <summary>Activated rules · {a.policies.length}</summary>
        {a.policies.map((p) => (
          <p key={p.id}>
            <strong>{p.id}</strong> · {p.description}{" "}
            <span className="tag">{p.source}</span>
          </p>
        ))}
      </details>
    </section>
  );
}
