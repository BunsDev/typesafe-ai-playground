"use client";
import { useState } from "react";
import type { GovernanceAnalysis } from "../types/governance";
export function ImpactGraph({ analysis: a }: { analysis: GovernanceAnalysis }) {
  const [selected, setSelected] = useState("");
  const all = a.graph.nodes.filter((n) => a.graph.relevantIds.includes(n.id));
  const nodes = all.slice(0, 40);
  const chosen = all.find((n) => n.id === selected) || nodes[0];
  const callers = new Set(a.impact.affectedCallers.map((n) => n.id));
  let left = 0,
    right = 0;
  const coords = new Map(
    nodes.map((n) => [
      n.id,
      {
        x: callers.has(n.id) ? 10 : 330,
        y: 35 + (callers.has(n.id) ? left++ : right++) * 74,
      },
    ]),
  );
  return (
    <section>
      <h3>
        Change impact graph <span className="tag">Mock AST</span>
      </h3>
      <p className="field-hint">
        Read each arrow as “uses.” Callers appear on the left; other affected
        symbols appear on the right. Purple nodes changed in this diff. Select a
        node to inspect it.
      </p>
      <div className="impact-graph">
        <svg
          viewBox={`0 0 640 ${Math.max(150, Math.max(left, right) * 74 + 60)}`}
          role="img"
          aria-label="Symbol dependency graph"
        >
          <defs>
            <marker
              id="gov-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
            </marker>
          </defs>
          {a.graph.edges.map((e, i) => {
            const s = coords.get(e.from),
              t = coords.get(e.to);
            return s && t ? (
              <path
                key={i}
                d={`M ${s.x + 290} ${s.y + 27} C ${s.x + 320} ${s.y + 27}, ${t.x - 25} ${t.y + 27}, ${t.x} ${t.y + 27}`}
                fill="none"
                stroke="currentColor"
                opacity=".45"
                markerEnd="url(#gov-arrow)"
              />
            ) : null;
          })}
          {nodes.map((n) => {
            const p = coords.get(n.id)!;
            return (
              <g
                key={n.id}
                role="button"
                aria-label={`Inspect ${n.name}`}
                tabIndex={0}
                onClick={() => setSelected(n.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(n.id);
                  }
                }}
              >
                <rect
                  x={p.x}
                  y={p.y}
                  width="290"
                  height="54"
                  rx="6"
                  className={
                    a.graph.changedIds.includes(n.id)
                      ? "graph-changed"
                      : "graph-node"
                  }
                  stroke={chosen?.id === n.id ? "currentColor" : "var(--line)"}
                />
                <text
                  x={p.x + 12}
                  y={p.y + 22}
                  fill="currentColor"
                  fontSize="13"
                >
                  {n.name.slice(0, 32)}
                </text>
                <text
                  x={p.x + 12}
                  y={p.y + 41}
                  fill="currentColor"
                  fontSize="10"
                >
                  {a.graph.changedIds.includes(n.id)
                    ? "Changed"
                    : "Unchanged in this diff"}{" "}
                  · {n.kind}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <details>
        <summary>Read the connections as text</summary>
        <ul>
          {a.graph.edges
            .filter(
              (e) =>
                a.graph.relevantIds.includes(e.from) &&
                a.graph.relevantIds.includes(e.to),
            )
            .map((e, i) => (
              <li key={i}>
                {a.graph.nodes.find((n) => n.id === e.from)?.name} {e.kind}{" "}
                {a.graph.nodes.find((n) => n.id === e.to)?.name}
              </li>
            ))}
        </ul>
      </details>
      {all.length > 40 && (
        <p>
          Showing 40 of {all.length} symbols; export includes the complete
          graph.
        </p>
      )}
      {chosen && (
        <div className="compact-finding">
          <strong>{chosen.name}</strong>
          <code>{chosen.filePath}</code>
          <p>Parameters: {chosen.parameters?.join(", ") || "none recorded"}</p>
          {chosen.publicChanged && (
            <p>
              Public API changed · previous:{" "}
              {chosen.previousParameters?.join(", ") || "none"}
            </p>
          )}
          <p>Imports: {chosen.imports?.join(", ") || "none recorded"}</p>
        </div>
      )}
      {a.graph.issues.length > 0 && (
        <details>
          <summary>{a.graph.issues.length} context limitations</summary>
          <ul>
            {a.graph.issues.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
