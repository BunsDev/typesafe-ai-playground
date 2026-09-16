import {
  BookOpen,
  ChevronDown,
  ArrowDownWideNarrow,
  Gauge,
  Layers,
  Flag,
} from "lucide-react";
export function RerankerGuide() {
  return (
    <details className="panel rerank-guide">
      <summary>
        <span className="rerank-guide-icon">
          <BookOpen size={19} />
        </span>
        <span className="rerank-guide-title">
          <strong>How to read this comparison</strong>
          <span>Follow the rank changes. Inspect the evidence.</span>
        </span>
        <span className="rerank-guide-toggle">
          Quick guide <ChevronDown size={17} />
        </span>
      </summary>
      <div className="rerank-guide-body">
        <div
          className="rerank-guide-flow"
          aria-label="Three views of the same candidates"
        >
          <span>
            <b>01</b> Vector similarity
          </span>
          <span aria-hidden="true">→</span>
          <span>
            <b>02</b> Jev relevance
          </span>
          <span aria-hidden="true">↔</span>
          <span>
            <b>03</b> Lexical mock
          </span>
        </div>
        <div className="rerank-guide-grid">
          <article>
            <ArrowDownWideNarrow size={18} />
            <h3>Relevance answers “does it help?”</h3>
            <p>
              Higher scores mean the snippet more directly answers your query.
              The original vector score stays visible so you can see what moved.
            </p>
            <div className="relevance-scale" aria-label="Relevance levels">
              <span>Irrelevant</span>
              <span>Tangential</span>
              <span>Relevant</span>
              <span>Direct</span>
            </div>
            <div className="scale-endpoints">
              <span>0 · unrelated</span>
              <span>1 · direct answer</span>
            </div>
          </article>
          <article>
            <Gauge size={18} />
            <h3>Confidence answers “how certain?”</h3>
            <p>
              Confidence describes Jev’s certainty about its chosen label. A
              snippet can be confidently irrelevant. Unknown or failed
              classifications remain unscored.
            </p>
            <div className="guide-example">
              <span>Example</span>
              <strong>
                Relevance 0.00 <span>·</span> Confidence 98%
              </strong>
              <small>Strong confidence that this result is unrelated.</small>
            </div>
          </article>
          <article>
            <Layers size={18} />
            <h3>Agreement compares the two lists</h3>
            <p>
              <strong>Top-10 overlap</strong> counts shared results near the
              top. <strong>Rank correlation</strong> compares the whole order,
              from −1 (opposite) to +1 (the same).
            </p>
            <div className="guide-example">
              <span>Example</span>
              <strong>7 shared results = 70% overlap</strong>
              <small>Agreement does not measure correctness.</small>
            </div>
          </article>
          <article>
            <Flag size={18} />
            <h3>Disagreements deserve a closer look</h3>
            <p>
              Highlighted cards moved at least 20% of the shortlist between Jev
              and the baseline, with a minimum difference of five places.
            </p>
            <div className="guide-inspect-hint">
              <strong>Click any file name</strong>
              <span>
                Read the full snippet and compare all three ranks against your
                query.
              </span>
            </div>
          </article>
        </div>
        <div className="rerank-guide-note">
          <strong>Know what you’re comparing</strong>
          <p>
            The baseline is a local token-overlap mock. This demo has no human
            relevance labels, so it cannot establish accuracy or outperforming a
            traditional reranker. Jev timing includes network calls; vector
            timing covers sorting only.
          </p>
        </div>
        <details className="rerank-scoring-detail">
          <summary>Scoring details</summary>
          <p>
            Relevance uses the probability-weighted ordinal level when a
            complete normalized distribution is available; otherwise it uses the
            selected level. Confidence is the lower of model confidence and
            selected-label probability. Ties use vector similarity, then input
            order. Unscored candidates appear last and withhold comparison
            metrics. Cost estimates use your entered per-request price and
            exclude hosting and compute.
          </p>
        </details>
      </div>
    </details>
  );
}
