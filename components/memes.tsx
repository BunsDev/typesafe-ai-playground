"use client";
import { useEffect, useRef, useState } from "react";
import { Laugh, Sparkles } from "lucide-react";
import { buildMemeRequest, memeSamples } from "../lib/memes";
import { runJev, percent, errorMessage } from "../lib/client";
import type { Response as JevResponse } from "../web/conversation";
import { Empty, ErrorNote, Export, Heading, RunButton } from "./ui";
export function Memes() {
  const [input, setInput] = useState(memeSamples[0]);
  const [result, setResult] = useState<JevResponse | null>(null);
  const [snapshot, setSnapshot] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function run() {
    setBusy(true);
    setError("");
    setResult(null);
    setSnapshot(JSON.stringify(input));
    controller.current = new AbortController();
    try {
      setResult(
        await runJev(buildMemeRequest(input), controller.current.signal),
      );
    } catch (e) {
      setError(
        controller.current.signal.aborted
          ? "Meme test stopped."
          : errorMessage(e),
      );
    } finally {
      setBusy(false);
    }
  }
  const answer = result?.answers;
  const lands = answer?.lands?.noul;
  return (
    <div className="workspace">
      <Heading
        eyebrow="Meme lab"
        title="Does the joke land?"
        description="Test the text, read the room, and find the humor. No caption generation."
      >
        <span className="pill">
          <Laugh size={15} />
          Subjective by design
        </span>
      </Heading>
      <div className="split">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <Laugh size={18} />
              <h2>The meme</h2>
            </div>
            <select
              aria-label="Meme sample"
              className="compact-select"
              disabled={busy}
              value={input.name}
              onChange={(e) =>
                setInput(memeSamples.find((s) => s.name === e.target.value)!)
              }
            >
              {memeSamples.map((s) => (
                <option key={s.name}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="panel-content scroll">
            <fieldset disabled={busy}>
              <label>
                Setup / top text
                <textarea
                  value={input.setup}
                  onChange={(e) =>
                    setInput({ ...input, setup: e.target.value })
                  }
                  rows={2}
                  maxLength={4000}
                />
              </label>
              <label>
                Punchline / bottom text
                <textarea
                  value={input.punchline}
                  onChange={(e) =>
                    setInput({ ...input, punchline: e.target.value })
                  }
                  rows={2}
                  maxLength={4000}
                />
              </label>
              <div className="meme-preview" aria-label="Text meme preview">
                <p>{input.setup || "Your setup"}</p>
                <div className="meme-scene">
                  <Sparkles size={30} />
                  <span>the moment of realization</span>
                </div>
                <p>{input.punchline || "Your punchline"}</p>
              </div>
              <label>
                Visual context
                <textarea
                  value={input.context}
                  onChange={(e) =>
                    setInput({ ...input, context: e.target.value })
                  }
                  rows={2}
                  maxLength={4000}
                />
              </label>
              <label>
                Intended audience
                <input
                  value={input.audience}
                  onChange={(e) =>
                    setInput({ ...input, audience: e.target.value })
                  }
                  maxLength={1000}
                />
              </label>
            </fieldset>
            <p className="muted">
              Describe the image in words. This prototype evaluates text, not
              image pixels.
            </p>
          </div>
          <div className="panel-bottom">
            <span className="muted">4 closed-set questions · 1 request</span>
            <RunButton
              busy={busy}
              onClick={run}
              onCancel={() => controller.current?.abort()}
            >
              Test meme
            </RunButton>
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>The read</h2>
            <Export
              data={result ? { input: JSON.parse(snapshot), result } : null}
              name="meme-test.json"
            />
          </div>
          <div className="panel-content scroll" aria-live="polite">
            <ErrorNote message={error} />
            {result && snapshot !== JSON.stringify(input) && (
              <p className="notice">
                Meme changed. Test again for an updated read.
              </p>
            )}
            {!answer ? (
              <Empty
                title={
                  busy ? "Reading the room…" : "A second opinion on the joke."
                }
              >
                Test your meme to see its humor style, tone, and likely sticking
                point.
              </Empty>
            ) : (
              <>
                <div className="meme-verdict">
                  <span className="eyebrow">Likelihood it lands</span>
                  <strong>{percent(lands)}</strong>
                  <h2>
                    {typeof lands !== "number"
                      ? "Result unavailable"
                      : lands >= 0.75
                        ? "This one has legs."
                        : lands >= 0.45
                          ? "Know your audience."
                          : "Might need a little context."}
                  </h2>
                  <div className="probability-track">
                    <span style={{ width: percent(lands) }} />
                  </div>
                  <p>
                    Jev’s estimate for this audience, not a measured reaction.
                  </p>
                </div>
                {(["style", "tone", "confusion"] as const).map((key) => {
                  const a = answer[key];
                  return (
                    <article className="evidence-card" key={key}>
                      <div className="evidence-title">
                        <h3>
                          {key === "style"
                            ? "Humor style"
                            : key === "tone"
                              ? "How it comes across"
                              : "Potential sticking point"}
                        </h3>
                        <span>
                          {percent(a?.probabilities?.[a?.choice || ""])}
                        </span>
                      </div>
                      <div className="classification">
                        {a?.choice?.replaceAll("_", " ") || "Unavailable"}
                      </div>
                      <div className="candidate-list">
                        {Object.entries(a?.probabilities || {})
                          .sort((a, b) => b[1] - a[1])
                          .map(([choice, p]) => (
                            <span
                              className={choice === a.choice ? "chosen" : ""}
                              key={choice}
                            >
                              {choice.replaceAll("_", " ")} · {percent(p)}
                            </span>
                          ))}
                      </div>
                    </article>
                  );
                })}
                <details className="disclosure">
                  <summary>Raw response</summary>
                  <pre className="criteria-preview">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </details>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
