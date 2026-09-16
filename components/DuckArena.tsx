"use client";
import { headingLabels, type World } from "../types/microduck";
import { target } from "../lib/microduckWorld";
const letters = "ABCD";
/** A kite pointing north, rotated a quarter turn per heading. */
const body = "M 0.5 0.12 L 0.86 0.88 L 0.5 0.66 L 0.14 0.88 Z";
export function DuckArena({
  world,
  selected,
  onSelect,
}: {
  world: World;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const walls = new Set(world.walls);
  const summary = world.ducks
    .map((duck) => {
      const goal = target(world, duck);
      return `${duck.name} at column ${duck.x + 1}, row ${duck.y + 1}, facing ${headingLabels[duck.heading]}, ${duck.carrying ? "carrying its cargo" : "empty"}, ${duck.battery}% battery, heading for column ${goal.x + 1}, row ${goal.y + 1}.`;
    })
    .join(" ");
  return (
    <div className="arena">
      <svg
        viewBox={`0 0 ${world.width} ${world.height}`}
        role="img"
        aria-label={`MicroDuck arena, ${world.width} by ${world.height} tiles, tick ${world.tick}. ${summary}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <g className="arena-grid">
          {Array.from({ length: world.height }, (_, y) =>
            Array.from({ length: world.width }, (_, x) => (
              <rect
                key={`${x},${y}`}
                x={x}
                y={y}
                width={1}
                height={1}
                className={walls.has(`${x},${y}`) ? "tile wall" : "tile"}
              />
            )),
          )}
        </g>
        {world.ducks.map((duck, index) => {
          const mission = world.missions[duck.id];
          const goal = target(world, duck);
          return (
            <g
              key={duck.id}
              className={
                duck.id === selected ? "duck-layer selected" : "duck-layer"
              }
              data-duck={index + 1}
            >
              <line
                className="goal-line"
                x1={duck.x + 0.5}
                y1={duck.y + 0.5}
                x2={goal.x + 0.5}
                y2={goal.y + 0.5}
              />
              <rect
                className="nest"
                x={mission.nest.x + 0.12}
                y={mission.nest.y + 0.12}
                width={0.76}
                height={0.76}
                rx={0.18}
              />
              <text
                className="marker"
                x={mission.nest.x + 0.5}
                y={mission.nest.y + 0.67}
              >
                {letters[index]}
              </text>
              {mission.cargo && (
                <rect
                  className="cargo"
                  x={mission.cargo.x + 0.3}
                  y={mission.cargo.y + 0.3}
                  width={0.4}
                  height={0.4}
                  rx={0.08}
                />
              )}
              <g
                transform={`translate(${duck.x} ${duck.y}) rotate(${duck.heading * 90} 0.5 0.5)`}
              >
                <path className="duck" d={body} />
              </g>
              {duck.carrying && (
                <circle
                  className="cargo"
                  cx={duck.x + 0.5}
                  cy={duck.y + 0.5}
                  r={0.11}
                />
              )}
              <rect
                className="duck-hit"
                x={duck.x}
                y={duck.y}
                width={1}
                height={1}
                onClick={() => onSelect(duck.id)}
              >
                <title>{`Select ${duck.name}`}</title>
              </rect>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
