"use client";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { API_KEY_EVENT, readApiKey } from "../lib/api-key";
import { fetchAccountUsage } from "../lib/fetchAccountUsage";
import {
  expireUsageBlock,
  initializeUsage,
  releaseUsageBlock,
  updateAccountUsage,
  useUsage,
} from "../lib/logUsageEntry";
import { UsageSummaryBadge } from "./UsageSummaryBadge";
import { UsageDetailPanel } from "./UsageDetailPanel";
export function UsageDashboard() {
  const usage = useUsage();
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const [personal, setPersonal] = useState(false),
    [now, setNow] = useState(Date.now());
  useEffect(() => {
    initializeUsage();
    const sync = () => setPersonal(!!readApiKey());
    sync();
    window.addEventListener(API_KEY_EVENT, sync);
    window.addEventListener("storage", sync);
    void fetchAccountUsage().then(updateAccountUsage);
    const timer = setInterval(() => {
      expireUsageBlock();
      setNow(Date.now());
    }, 1000);
    return () => {
      clearInterval(timer);
      window.removeEventListener(API_KEY_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const left = usage.block?.resetAt
    ? Math.max(0, Math.ceil((Date.parse(usage.block.resetAt) - now) / 1000))
    : null;
  return (
    <>
      <UsageSummaryBadge
        usage={usage}
        personal={personal}
        onClick={() => {
          setOpen(true);
          dialog.current?.showModal();
        }}
      />
      <dialog
        className="usage-dialog"
        ref={dialog}
        onClose={() => setOpen(false)}
        aria-labelledby="usage-title"
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current.close();
        }}
      >
        <div className="usage-dialog-head">
          <div>
            <span className="eyebrow">API ACTIVITY</span>
            <h2 id="usage-title">Usage & budget</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close usage dashboard"
            onClick={() => dialog.current?.close()}
          >
            <X size={18} />
          </button>
        </div>
        <div className="usage-dialog-body">
          {usage.block && (
            <div className="quota-warning exhausted" role="status">
              <strong>
                {usage.block.kind === "rate_limit"
                  ? "Rate limited"
                  : "Budget unavailable"}
              </strong>
              <p>{usage.block.message}</p>
              <p>
                {left !== null
                  ? `Retry available in ${Math.floor(left / 60)}m ${left % 60}s.`
                  : "The API did not provide a reset time."}
              </p>
              {left === null && (
                <button className="button" onClick={releaseUsageBlock}>
                  Resume calls and retry
                </button>
              )}
            </div>
          )}
          {open && <UsageDetailPanel usage={usage} personal={personal} />}
        </div>
      </dialog>
    </>
  );
}
