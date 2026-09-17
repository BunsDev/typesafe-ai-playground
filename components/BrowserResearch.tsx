"use client";
import { useEffect, useRef, useState } from "react";
import type { ResearchAnswer, ResearchBundle, ResearchTask } from "../lib/browserResearch";
import { ErrorNote, Export, RunButton } from "./ui";
import { errorMessage } from "../lib/client";

type Result = ResearchBundle & { answer: ResearchAnswer | null; synthesisError?: string; model?: string };
const goals: Record<ResearchTask, string> = {
  github: "Find today's number 1 starred GitHub repo and read its docs",
  typesafe: "Read the docs for typesafe.ai and provide us the top 10 use cases",
};
export function BrowserResearch() {
  const [task, setTask] = useState<ResearchTask>("github");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function run() {
    const c = new AbortController();
    controller.current = c;
    setBusy(true); setError(""); setResult(null);
    try {
      const response = await fetch("/api/browser-research", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task }), signal: c.signal,
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "Research failed.");
      setResult(data);
    } catch (e) { setError(c.signal.aborted ? "Research stopped." : errorMessage(e)); }
    finally { setBusy(false); }
  }
  return (
    <section className="panel lab-panel browser-research" aria-labelledby="research-heading" aria-busy={busy}>
      <div className="panel-heading">
        <h2 id="research-heading">Live documentation research</h2>
        <Export data={result} name="documentation-research.json" />
      </div>
      <label>
        Research example
        <select aria-label="Research example" value={task} disabled={busy} onChange={(e) => { setTask(e.target.value as ResearchTask); setResult(null); setError(""); }}>
          <option value="github">GitHub · today’s top trending repo</option>
          <option value="typesafe">TypeSafe · top 10 use cases</option>
        </select>
      </label>
      <p><strong>{goals[task]}</strong></p>
      <p className="field-hint">{task === "github"
        ? "“Number 1” means the first repository on GitHub Trending · Today, across all languages. Daily Trending order is not an all-time star ranking or a sort by stars gained."
        : "Reads TypeSafe’s official documentation and ranks ten practical applications by documented fit, value, and ease of implementation."}</p>
      <RunButton busy={busy} onClick={run} onCancel={() => controller.current?.abort()} usesJev={false}>Research docs</RunButton>
      <p className="field-hint" role="status">{busy ? "Reading live sources and preparing a cited answer…" : "Fetches public docs directly. Answer generation uses the server’s TEXT_MODEL configuration; no Jev calls are needed for this preset."}</p>
      <ErrorNote message={error} />
      {result && <div className="research-results">
        <p className="field-hint">Retrieved {result.retrievedAt} · {result.sources.length} pages read{result.model ? ` · ${result.model}` : ""}</p>
        {result.repository && <p><strong>#1 on <a href="https://github.com/trending?since=daily" target="_blank" rel="noreferrer">daily GitHub Trending</a>: </strong><a href={`https://github.com/${result.repository.repository}`} target="_blank" rel="noreferrer">{result.repository.repository}</a> · {result.repository.starsToday.toLocaleString()} stars today</p>}
        <ErrorNote message={result.synthesisError || ""} />
        {!!result.gaps.length && <details open><summary>Pages that could not be read ({result.gaps.length})</summary><ul>{result.gaps.map((gap) => <li key={gap}>{gap}</li>)}</ul></details>}
        {result.answer && <>
          <p>{result.answer.summary}</p>
          <ol className="research-answer">{result.answer.items.map((item) => <li key={item.title}>
            <h3>{item.title}</h3><p>{item.explanation}</p><p>{item.application}</p>
            {item.evidence.map((evidence, i) => {
              const source = result.sources.find((s) => s.id === evidence.sourceId)!;
              return <blockquote key={`${source.id}-${i}`}><p>{evidence.quote}</p><a href={source.url} target="_blank" rel="noreferrer">[{source.id}] {source.title}</a></blockquote>;
            })}
          </li>)}</ol>
        </>}
        <details><summary>Read sources and coverage</summary>{result.sources.map((source) => <section key={source.id}>
          <h3><a href={source.url} target="_blank" rel="noreferrer">[{source.id}] {source.title}</a></h3>
          <p className="field-hint">{source.truncated ? "Excerpt: first 16,000 characters; remaining content not read." : "Full extracted page text."}</p>
          <pre className="research-source">{source.text}</pre>
        </section>)}</details>
      </div>}
    </section>
  );
}
