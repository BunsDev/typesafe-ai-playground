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
  { href: "/memes", label: "Meme lab", icon: Laugh, detail: "Read the room" },
];
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const current = pages.find((p) => p.href === path);
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
            API documentation <ArrowUpRight size={15} />
          </a>
        </div>
      </aside>
      <div className="app-body">
        <header className="app-header">
          <div className="breadcrumb">
            Playground <span>/</span>{" "}
            <strong>{current?.label ?? "Workspace"}</strong>
          </div>
          <div className="header-actions">
            <span
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
        </header>
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
