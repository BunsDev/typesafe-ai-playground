"use client";
import {
  ArrowRight,
  LoaderCircle,
  Download,
  Square,
  CircleDashed,
} from "lucide-react";
import { useUsage, usageBlocked } from "../lib/logUsageEntry";
import { download } from "../lib/client";
export function Heading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}
export function RunButton({
  busy,
  children,
  onClick,
  onCancel,
  disabled,
  usesJev = true,
}: {
  busy: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  onCancel?: () => void;
  disabled?: boolean;
  usesJev?: boolean;
}) {
  useUsage();
  const blocked = usesJev && usageBlocked();
  return (
    <div className="run-actions">
      <button
        type={onClick ? "button" : "submit"}
        className="button primary"
        disabled={busy || disabled || blocked}
        title={
          blocked
            ? "Live API calls paused — open Usage in the header."
            : undefined
        }
        onClick={onClick}
      >
        {busy ? (
          <LoaderCircle size={16} className="spin" />
        ) : (
          <ArrowRight size={16} />
        )}{" "}
        {busy ? "Running…" : children}
      </button>
      {busy && onCancel && (
        <button className="button" type="button" onClick={onCancel}>
          <Square size={13} />
          Stop
        </button>
      )}
    </div>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <CircleDashed size={29} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function ErrorNote({ message }: { message: string }) {
  return message ? (
    <div className="error-note" role="alert">
      {message}
    </div>
  ) : null;
}
export function Export({
  data,
  name = "results.json",
}: {
  data: unknown;
  name?: string;
}) {
  return (
    <button
      className="button quiet"
      disabled={!data}
      onClick={() => download(name, data)}
    >
      <Download size={14} />
      Export
    </button>
  );
}
