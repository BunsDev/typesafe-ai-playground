import type { UsageSnapshot, UsageLimit } from "../types/usage";
import { INPUT_USD_PER_MILLION } from "../lib/estimateCost";
export const dollars = (v: number) => `$${v.toFixed(6)}`;
function Limit({ label, value }: { label: string; value?: UsageLimit }) {
  if (!value)
    return (
      <div className="usage-limit">
        <span>{label}</span>
        <strong>Not reported</strong>
      </div>
    );
  const used = Math.max(0, value.limit - value.remaining);
  return (
    <div className="usage-limit">
      <span>
        {label} · {value.window}
      </span>
      <strong>
        {used.toLocaleString()} / {value.limit.toLocaleString()}
      </strong>
      <progress
        max={Math.max(1, value.limit)}
        value={used}
        aria-label={`${label} quota used`}
      />
      <small>{value.remaining.toLocaleString()} remaining</small>
    </div>
  );
}
export function UsageDetailPanel({
  usage,
  personal,
}: {
  usage: UsageSnapshot;
  personal: boolean;
}) {
  return (
    <>
      <div className="usage-key">
        <strong>{personal ? "Personal key" : "Community key"}</strong>
        <span>Plan / tier: {usage.account.plan ?? "not reported by API"}</span>
      </div>
      <p className="usage-scope">{usage.account.reason}</p>
      <div className="usage-metrics">
        <div>
          <span>Requests attempted</span>
          <strong>{usage.requests.toLocaleString()}</strong>
          <small>This browser session</small>
        </div>
        <div>
          <span>Input tokens</span>
          <strong>{usage.tokens.toLocaleString()}</strong>
          <small>
            {usage.estimatedTokens
              ? `${usage.estimatedTokens.toLocaleString()} estimated · remainder API-reported`
              : "API-reported where available"}
          </small>
        </div>
        <div>
          <span>Estimated input cost</span>
          <strong>{dollars(usage.cost)}</strong>
          <small>List price, not billed amount</small>
        </div>
      </div>
      <p className="usage-price-source">
        Calculation: input tokens × $42 ÷ 1,000,000,000.{" "}
        <a href="https://typesafe.ai/" target="_blank" rel="noreferrer">
          Source: TypeSafe public pricing
        </a>{" "}
        · checked Sep 16, 2026. Input-only estimate; not billed cost.
      </p>
      <div className="usage-limits">
        <Limit label="Token allowance" value={usage.account.tokens} />
        <Limit
          label="Request allowance / daily cap"
          value={usage.account.requests}
        />
      </div>
      <p className="field-hint">
        No quota percentage is shown without a reported cap. Reset:{" "}
        {usage.block?.resetAt
          ? new Date(usage.block.resetAt).toLocaleString()
          : "not reported"}
        .
      </p>
      <details className="usage-method">
        <summary>How these numbers are calculated</summary>
        <p>
          Successful calls use TypeSafe’s input_tokens and output_tokens when
          returned. Otherwise, input tokens are estimated as serialized request
          characters ÷ 4. Failed or cancelled calls without usage have unknown
          tokens and costs; they are not treated as free.
        </p>
        <p>
          Estimated input cost uses{" "}
          <a href="https://typesafe.ai/" target="_blank" rel="noreferrer">
            TypeSafe’s public ${INPUT_USD_PER_MILLION} per million input tokens
          </a>{" "}
          (checked September 16, 2026). Output charges, discounts, and
          account-specific billing are not included. This session includes calls
          from keys used in this tab; limits apply only to the currently
          selected key.
        </p>
        <p>
          Only counts, timestamps, example names and status are stored in
          sessionStorage. No prompts, documents, responses or API keys are
          included. The latest 200 calls are listed; running totals retain all
          calls for this session.
        </p>
      </details>
      {usage.unknownCalls > 0 && (
        <p className="usage-scope">
          {usage.unknownCalls} calls have unknown token usage and cost. Totals
          are incomplete.
        </p>
      )}
      <div className="usage-table">
        <table>
          <caption>Per-call activity · newest first</caption>
          <thead>
            <tr>
              <th>Time / example</th>
              <th>Input / output tokens</th>
              <th>Estimated input cost</th>
            </tr>
          </thead>
          <tbody>
            {usage.entries.map((e, i) => (
              <tr key={`${e.timestamp}-${i}`}>
                <td>
                  <strong>{e.example}</strong>
                  <small>
                    {new Date(e.timestamp).toLocaleTimeString()} · {e.keySource}{" "}
                    · {e.status}
                  </small>
                  <code>{e.endpoint}</code>
                </td>
                <td>
                  {e.inputTokens?.toLocaleString() ?? "Unknown"} /{" "}
                  {e.outputTokens?.toLocaleString() ?? "—"}
                  <small>{e.tokenSource}</small>
                </td>
                <td>
                  {e.estimatedCost === null
                    ? "Unknown"
                    : dollars(e.estimatedCost)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!usage.entries.length && (
          <p className="usage-empty">
            No live calls yet. Run any Jev example to see its usage here. Mock
            runs do not consume tokens.
          </p>
        )}
      </div>
    </>
  );
}
