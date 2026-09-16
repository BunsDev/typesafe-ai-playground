import { quotaState, useUsage } from "../lib/logUsageEntry";
export function QuotaWarningBanner() {
  const usage = useUsage();
  const state = quotaState(usage);
  if (state === "healthy") return null;
  return (
    <div
      className={`quota-warning ${state}`}
      role={state === "exhausted" ? "alert" : "status"}
    >
      <strong>
        {state === "exhausted"
          ? "Live API calls paused"
          : "Approaching your quota"}
      </strong>
      <span>
        {usage.block?.message ||
          "More than 80% of a reported quota is used. Check usage before continuing."}{" "}
        Open Usage in the header for details. Local demos remain available.
      </span>
    </div>
  );
}
