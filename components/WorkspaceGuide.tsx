"use client";
import { useRef } from "react";
import { usePathname } from "next/navigation";
import { ArrowRight, BookOpen, X } from "lucide-react";
import { playgroundPages } from "../lib/playground";
import { workspaceGuides } from "../lib/workspace-guides";

export function WorkspaceGuide() {
  const path = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const guide = workspaceGuides[path];
  const page = playgroundPages.find((p) => p.href === path);
  if (!guide || !page) return null;
  const Icon = page.icon;
  return (
    <>
      <button
        className="button workspace-guide-trigger"
        onClick={() => dialog.current?.showModal()}
      >
        <BookOpen size={15} /> Workspace guide
      </button>
      <dialog
        ref={dialog}
        className="workspace-guide-dialog"
        aria-label={`${page.label} guide`}
      >
        <div className="workspace-guide-heading">
          <span className="workspace-guide-icon">
            <Icon size={23} strokeWidth={1.5} />
          </span>
          <button
            autoFocus
            className="icon-button"
            aria-label="Close workspace guide"
            onClick={() => dialog.current?.close()}
          >
            <X size={19} />
          </button>
        </div>
        <span className="eyebrow">A QUICK WALKTHROUGH</span>
        <h2>{page.label}</h2>
        <ol>
          {guide.steps.map(([title, text], index) => (
            <li key={title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="workspace-boundary">{guide.boundary}</p>
        <button
          className="button primary"
          onClick={() => dialog.current?.close()}
        >
          Back to workspace <ArrowRight size={15} />
        </button>
      </dialog>
    </>
  );
}

export function DecisionPreview() {
  const path = usePathname();
  const guide = workspaceGuides[path];
  const page = playgroundPages.find((p) => p.href === path);
  if (!guide || !page) return null;
  const Icon = page.icon;
  return (
    <div className="decision-preview" aria-label="How this example works">
      <span className="decision-preview-icon">
        <Icon size={30} strokeWidth={1.25} />
      </span>
      <div className="decision-preview-flow">
        {guide.flow.map((step, i) => (
          <span key={step}>
            {i > 0 && <ArrowRight size={13} aria-hidden="true" />}
            <span>{step}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
