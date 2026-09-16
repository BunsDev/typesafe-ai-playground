"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Laugh,
  Blocks,
  FileScan,
  GitBranch,
  GitPullRequest,
  MessageSquare,
  Moon,
  Sun,
  Sparkles,
} from "lucide-react";
const pages = [
  {
    href: "/",
    label: "Examples",
    icon: Blocks,
    detail: "Explore the possibilities",
  },
  {
    href: "/conversation",
    label: "Conversation lab",
    icon: MessageSquare,
    detail: "Find the right reply",
  },
  {
    href: "/workflow",
    label: "Workflow chat",
    icon: GitBranch,
    detail: "Turn context into a decision",
  },
  {
    href: "/extraction",
    label: "Document extraction",
    icon: FileScan,
    detail: "From source to structured data",
  },
  {
    href: "/pr-review",
    label: "PR review",
    icon: GitPullRequest,
    detail: "Review the risky parts",
  },
  { href: "/memes", label: "Meme lab", icon: Laugh, detail: "Read the room" },
];
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [dark, setDark] = useState(false);
  const [health, setHealth] = useState("Connecting");
  useEffect(() => {
    setDark(document.documentElement.dataset.theme === "dark");
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setHealth(d.configured ? "Jev connected" : "API key needed"))
      .catch(() => setHealth("Connection unavailable"));
  }, []);
  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    try {
      localStorage.setItem(
        "typesafe-playground-theme",
        next ? "dark" : "light",
      );
    } catch {}
  }
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to workspace
      </a>
      <aside className="sidebar">
        <Link className="brand" href="/">
          <span className="brand-mark">
            <Blocks size={21} />
          </span>
          <span>
            TypeSafe<span className="brand-sub">PLAYGROUND</span>
          </span>
        </Link>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Workspaces">
          {pages.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-label={label}
              title={label}
              className={path === href ? "active" : ""}
              aria-current={path === href ? "page" : undefined}
            >
              <Icon size={18} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="model-card">
            <Sparkles size={17} />
            <div>
              <strong>Small model. Clear choices.</strong>
              <p>Powered by Jev</p>
            </div>
          </div>
          <a
            href="https://docs.typesafe.ai/introduction/quickstart"
            target="_blank"
            rel="noreferrer"
            className="docs-link"
          >
            Docs <ArrowUpRight size={15} />
          </a>
        </div>
        <div className="header-actions">
          <a
            className="icon-button github-link"
            href="https://github.com/BunsDev/typesafe-ai-playground"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View TypeSafe AI Playground on GitHub"
            title="View source on GitHub"
          >
            <svg
              width="19"
              height="19"
              viewBox="0 0 24 24"
              aria-hidden="true"
              fill="currentColor"
            >
              <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2.23c-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.95.1-.74.4-1.25.73-1.54-2.56-.29-5.25-1.28-5.25-5.69 0-1.26.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.16 1.18a11 11 0 0 1 5.75 0c2.19-1.49 3.15-1.18 3.15-1.18.63 1.58.23 2.75.11 3.04.74.8 1.19 1.82 1.19 3.08 0 4.42-2.69 5.4-5.26 5.69.42.36.78 1.06.78 2.14v3.17c0 .31.21.67.79.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
            </svg>
          </a>
          <span
            title={health}
            aria-label={health}
            className={`connection ${health === "Jev connected" ? "connected" : ""}`}
          >
            <i />
            {health}
          </span>
          <button
            className="icon-button"
            onClick={toggle}
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </aside>
      <div className="app-body">
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <footer className="app-footer">
          <span>
            TypeSafe AI <span className="footer-dot">·</span> Community
            playground
          </span>
          <span>Choose with confidence.</span>
        </footer>
      </div>
    </div>
  );
}
