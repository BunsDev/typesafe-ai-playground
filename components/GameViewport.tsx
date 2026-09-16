import { DoomScene } from "./DoomScene";
import { DoomMiniMap } from "./DoomMiniMap";
import type { DoomAction, GameState } from "../types/doom";
import { TICK_MS } from "../lib/gameLoop";
export function GameViewport({
  game,
  active,
  mode,
  onKeyDown,
  onKeyUp,
  onBlur,
  onAction,
}: {
  game: GameState;
  active: boolean;
  mode: string;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onKeyUp: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onBlur: () => void;
  onAction: (action: DoomAction) => void;
}) {
  const p = game.player;
  return (
    <div
      className="doom-viewport"
      tabIndex={0}
      role="application"
      aria-label="Maze shooter. Focus here for keyboard controls."
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onBlur={onBlur}
    >
      <div className="doom-screen-top">
        <span>JEV / SECTOR 01</span>
        <span>
          {active ? "LIVE" : "PAUSED"} · {mode.toUpperCase()}
        </span>
      </div>
      <DoomScene game={game} active={active} mode={mode} onAction={onAction} />
      <details className="doom-minimap" onKeyDown={(e) => e.stopPropagation()}>
        <summary>Tactical map</summary>
        <DoomMiniMap game={game} />
      </details>

      {game.status !== "playing" && (
        <div className="doom-game-over">
          <strong>
            {game.status === "won"
              ? "SECTOR CLEARED"
              : game.status === "dead"
                ? "YOU DIED"
                : "TIME LIMIT"}
          </strong>
          <span>
            {game.kills} kills · {((game.tick * TICK_MS) / 1000).toFixed(1)}s
            survived
          </span>
        </div>
      )}
      <div className="doom-screen-hud">
        <span>
          HEALTH <strong>{p.health}</strong>
        </span>
        <span>
          AMMO <strong>{p.ammo}</strong>
        </span>
        <span>
          KILLS <strong>{game.kills}/5</strong>
        </span>
      </div>
    </div>
  );
}
