import type { GameState } from "../types/doom";
import { TICK_MS } from "../lib/gameLoop";
export function GameViewport({
  game,
  active,
  mode,
  onKeyDown,
  onKeyUp,
  onBlur,
}: {
  game: GameState;
  active: boolean;
  mode: string;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onKeyUp: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onBlur: () => void;
}) {
  const p = game.player;
  const size = 32;
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
      <svg
        viewBox="0 0 480 352"
        role="img"
        aria-label={
          "Arena at tick " +
          game.tick +
          ". Health " +
          p.health +
          ", " +
          game.kills +
          " kills."
        }
      >
        <defs>
          <pattern
            id="doom-floor"
            width="32"
            height="32"
            patternUnits="userSpaceOnUse"
          >
            <rect width="32" height="32" fill="#151b27" />
            <path
              d="M0 32V0H32"
              fill="none"
              stroke="#263146"
              strokeWidth=".5"
            />
          </pattern>
        </defs>
        <rect width="480" height="352" fill="url(#doom-floor)" />
        <path
          d={
            "M" +
            p.x * size +
            " " +
            p.y * size +
            " L" +
            (p.x + Math.cos(p.angle - Math.PI / 3) * 8) * size +
            " " +
            (p.y + Math.sin(p.angle - Math.PI / 3) * 8) * size +
            " A256 256 0 0 1 " +
            (p.x + Math.cos(p.angle + Math.PI / 3) * 8) * size +
            " " +
            (p.y + Math.sin(p.angle + Math.PI / 3) * 8) * size +
            " Z"
          }
          fill="#c7e8fd"
          opacity=".045"
        />
        {game.map.flatMap((row, y) =>
          [...row].map((tile, x) =>
            tile === "#" ? (
              <g key={x + "," + y}>
                <rect
                  x={x * size + 1}
                  y={y * size + 1}
                  width="30"
                  height="30"
                  fill="#394055"
                  stroke="#596078"
                />
                <path
                  d={"M" + (x * size + 2) + " " + (y * size + 29) + "h27"}
                  stroke="#232837"
                  strokeWidth="3"
                />
              </g>
            ) : tile === "D" ? (
              <g key={x + "," + y}>
                <rect
                  x={x * size + 3}
                  y={y * size + 1}
                  width="26"
                  height="30"
                  fill="#a24787"
                  stroke="#f089ce"
                />
                <path
                  d={"M" + (x * size + 16) + " " + (y * size + 3) + "v26"}
                  stroke="#f5b0df"
                />
              </g>
            ) : null,
          ),
        )}
        {game.items
          .filter((i) => !i.collected)
          .map((i) => (
            <g
              key={i.id}
              transform={"translate(" + i.x * size + " " + i.y * size + ")"}
            >
              <rect
                x="-7"
                y="-7"
                width="14"
                height="14"
                fill={i.kind === "health" ? "#7bd9b8" : "#ead074"}
              />
              <text
                x="0"
                y="4"
                textAnchor="middle"
                fontSize="12"
                fontWeight="bold"
                fill="#101b21"
              >
                {i.kind === "health" ? "+" : "A"}
              </text>
            </g>
          ))}
        {game.enemies
          .filter((e) => e.health > 0)
          .map((e) => (
            <g
              key={e.id}
              transform={"translate(" + e.x * size + " " + e.y * size + ")"}
            >
              <path
                d="M-9-7L-5-12L0-8L5-12L9-7V8L5 11H-5L-9 8Z"
                fill="#ef729c"
                stroke="#ffa5c4"
              />
              <rect x="-5" y="-3" width="3" height="3" fill="#201822" />
              <rect x="2" y="-3" width="3" height="3" fill="#201822" />
              <path d="M-4 5H4" stroke="#201822" strokeWidth="2" />
            </g>
          ))}
        {game.shotRay && (
          <line
            x1={game.shotRay.from.x * size}
            y1={game.shotRay.from.y * size}
            x2={game.shotRay.to.x * size}
            y2={game.shotRay.to.y * size}
            stroke="#ffe9a5"
            strokeWidth="2"
          />
        )}
        <g
          transform={
            "translate(" +
            p.x * size +
            " " +
            p.y * size +
            ") rotate(" +
            (p.angle * 180) / Math.PI +
            ")"
          }
        >
          <circle
            r="10"
            fill="#b9eaff"
            stroke={game.damageFlash ? "#ff7194" : "#fff"}
            strokeWidth="2"
          />
          <path d="M5-3H16V3H5" fill="#e5f8ff" />
          <path
            d="M-5-4L2 0L-5 4"
            fill="none"
            stroke="#294554"
            strokeWidth="2"
          />
        </g>
        {game.damageFlash && (
          <rect
            x="2"
            y="2"
            width="476"
            height="348"
            fill="none"
            stroke="#ef729c"
            strokeWidth="4"
          />
        )}
      </svg>
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
