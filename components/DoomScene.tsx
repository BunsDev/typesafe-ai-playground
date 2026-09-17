"use client";
import { useEffect, useRef, useState } from "react";
import type { DoomAction, GameState } from "../types/doom";
export function DoomScene({
  game,
  active,
  mode,
  onAction,
}: {
  game: GameState;
  active: boolean;
  mode: string;
  onAction: (action: DoomAction) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const current = useRef(game);
  current.current = game;
  const controller = useRef<ReturnType<
    typeof import("../lib/doom-scene").createDoomScene
  > | null>(null);
  const [status, setStatus] = useState("loading");
  const drag = useRef<{ x: number; moved: boolean } | null>(null);
  useEffect(() => {
    let stopped = false;
    const element = canvas.current!;
    const lost = (event: Event) => {
      event.preventDefault();
      element.removeEventListener("webglcontextlost", lost);
      controller.current?.dispose();
      controller.current = null;
      setStatus("unavailable");
    };
    element.addEventListener("webglcontextlost", lost);
    import("../lib/doom-scene")
      .then(({ createDoomScene }) => {
        if (stopped) return;
        try {
          controller.current = createDoomScene(element, current.current);
          setStatus("ready");
        } catch {
          setStatus("unavailable");
        }
      })
      .catch(() => {
        if (!stopped) setStatus("unavailable");
      });
    return () => {
      stopped = true;
      element.removeEventListener("webglcontextlost", lost);
      controller.current?.dispose();
      controller.current = null;
    };
  }, []);
  useEffect(() => {
    controller.current?.update(game);
  }, [game]);
  return (
    <div
      className={"doom-scene " + (game.damageFlash ? "doom-hit" : "")}
      data-status={status}
    >
      <canvas
        ref={canvas}
        aria-label={`First-person 3D arena. Health ${game.player.health}. ${game.kills} kills.`}
        role="img"
        onPointerDown={(e) => {
          if (!active || mode !== "human") return;
          e.currentTarget.closest<HTMLElement>(".doom-viewport")?.focus();
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, moved: false };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || !active || mode !== "human") return;
          const dx = e.clientX - d.x;
          if (Math.abs(dx) > 18) {
            d.moved = true;
            d.x = e.clientX;
            onAction(dx > 0 ? "turn_right" : "turn_left");
          }
        }}
        onPointerUp={() => {
          if (drag.current && !drag.current.moved && active && mode === "human")
            onAction("shoot");
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      />
      {status === "ready" && (
        <>
          <span className="doom-crosshair" aria-hidden="true">
            +
          </span>
          <span className="doom-view-label">FIRST PERSON · 3D</span>
        </>
      )}
      {status !== "ready" && (
        <div className="doom-render-message" role="status">
          {status === "loading"
            ? "Initializing 3D arena…"
            : "3D graphics unavailable. Open Tactical map to play, or enable WebGL and reload."}
        </div>
      )}
    </div>
  );
}
