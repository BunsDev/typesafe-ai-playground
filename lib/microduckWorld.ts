import type {
  Cell,
  Duck,
  GoalDirection,
  Heading,
  Mission,
  SimAction,
  SimState,
  StepEvent,
  World,
} from "../types/microduck";
/** Seeded PRNG, so the same seed always builds and runs the same arena. */
export function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const key = (cell: Cell) => `${cell.x},${cell.y}`;
export const same = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;
/** 0 north, 1 east, 2 south, 3 west, with y growing downward. */
const vectors: Record<Heading, Cell> = {
  0: { x: 0, y: -1 },
  1: { x: 1, y: 0 },
  2: { x: 0, y: 1 },
  3: { x: -1, y: 0 },
};
export const turned = (heading: Heading, quarters: number) =>
  ((((heading + quarters) % 4) + 4) % 4) as Heading;
/** The cell one tile away, `quarters` right-turns off the duck's nose. */
export const neighbor = (duck: Duck, quarters: number): Cell => {
  const vector = vectors[turned(duck.heading, quarters)];
  return { x: duck.x + vector.x, y: duck.y + vector.y };
};
const inside = (world: World, cell: Cell) =>
  cell.x >= 0 && cell.y >= 0 && cell.x < world.width && cell.y < world.height;
/** A tile the duck cannot enter: the arena edge, a wall, or another duck. */
export const blocked = (world: World, cell: Cell, mover?: string) =>
  !inside(world, cell) ||
  world.walls.includes(key(cell)) ||
  world.ducks.some((d) => d.id !== mover && d.x === cell.x && d.y === cell.y);
const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, Math.round(value) || low));
const wallDensity = 0.16;
const reachable = (
  walls: Set<string>,
  width: number,
  height: number,
  from: Cell,
  to: Cell,
) => {
  const seen = new Set([key(from)]);
  const queue = [from];
  while (queue.length) {
    const cell = queue.shift()!;
    if (same(cell, to)) return true;
    for (const vector of Object.values(vectors)) {
      const next = { x: cell.x + vector.x, y: cell.y + vector.y };
      const id = key(next);
      if (
        next.x < 0 ||
        next.y < 0 ||
        next.x >= width ||
        next.y >= height ||
        walls.has(id) ||
        seen.has(id)
      )
        continue;
      seen.add(id);
      queue.push(next);
    }
  }
  return false;
};
/**
 * Random walls can seal a cargo or a nest away. When that happens the arena
 * clears an L-shaped corridor to it, so every mission stays solvable and the
 * seed still reproduces the same layout.
 */
function carve(
  walls: Set<string>,
  width: number,
  height: number,
  from: Cell,
  to: Cell,
) {
  if (reachable(walls, width, height, from, to)) return;
  const at = { x: from.x, y: from.y };
  while (at.x !== to.x) {
    at.x += Math.sign(to.x - at.x);
    walls.delete(key(at));
  }
  while (at.y !== to.y) {
    at.y += Math.sign(to.y - at.y);
    walls.delete(key(at));
  }
}
const duckNames = ["Duck A", "Duck B", "Duck C", "Duck D"];
export interface ArenaOptions {
  seed: number;
  ducks: number;
  width: number;
  height: number;
}
export const defaultArena: ArenaOptions = {
  seed: 7,
  ducks: 2,
  width: 9,
  height: 9,
};
/** Builds the whole arena from the seed: walls, spawns, cargo, and nests. */
export function createWorld(options: ArenaOptions): World {
  const width = clamp(options.width, 5, 14);
  const height = clamp(options.height, 5, 14);
  const count = clamp(options.ducks, 1, 4);
  const seed = Math.trunc(options.seed) || 0;
  const random = rng(seed);
  const walls = new Set<string>();
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (random() < wallDensity) walls.add(`${x},${y}`);
  const taken = new Set<string>();
  const claim = (): Cell => {
    const open: Cell[] = [];
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const id = `${x},${y}`;
        if (!walls.has(id) && !taken.has(id)) open.push({ x, y });
      }
    if (!open.length)
      throw Error("This arena is too small for that many ducks.");
    const cell = open[Math.floor(random() * open.length)];
    taken.add(key(cell));
    return cell;
  };
  const ducks: Duck[] = [];
  const missions: Record<string, Mission> = {};
  for (let index = 0; index < count; index++) {
    const spawn = claim();
    const duck: Duck = {
      id: `d${index + 1}`,
      name: duckNames[index],
      x: spawn.x,
      y: spawn.y,
      heading: Math.floor(random() * 4) as Heading,
      battery: 100,
      carrying: false,
      lastAction: "none",
      steps: 0,
      collisions: 0,
      wasted: 0,
      goals: 0,
    };
    ducks.push(duck);
    missions[duck.id] = { cargo: claim(), nest: claim() };
  }
  for (const duck of ducks) {
    const mission = missions[duck.id];
    carve(walls, width, height, duck, mission.cargo!);
    carve(walls, width, height, mission.cargo!, mission.nest);
  }
  return {
    width,
    height,
    walls: [...walls].sort(),
    ducks,
    missions,
    seed,
    tick: 0,
  };
}
/** Whatever the duck owes next: the cargo, or the nest once it is aboard. */
export const target = (world: World, duck: Duck): Cell => {
  const mission = world.missions[duck.id];
  return duck.carrying ? mission.nest : (mission.cargo ?? mission.nest);
};
function bearing(duck: Duck, goal: Cell): GoalDirection {
  const dx = goal.x - duck.x;
  const dy = goal.y - duck.y;
  if (!dx && !dy) return "here";
  const forward = vectors[duck.heading];
  const right = vectors[turned(duck.heading, 1)];
  const along = dx * forward.x + dy * forward.y;
  const across = dx * right.x + dy * right.y;
  if (Math.abs(along) >= Math.abs(across))
    return along > 0 ? "ahead" : "behind";
  return across > 0 ? "right" : "left";
}
/** Everything the duck can sense this tick. Jev is never given more. */
export function observe(world: World, duck: Duck): SimState {
  const goal = target(world, duck);
  return {
    distance_to_goal: Math.abs(goal.x - duck.x) + Math.abs(goal.y - duck.y),
    goal_direction: bearing(duck, goal),
    obstacle_ahead: blocked(world, neighbor(duck, 0), duck.id),
    obstacle_left: blocked(world, neighbor(duck, -1), duck.id),
    obstacle_right: blocked(world, neighbor(duck, 1), duck.id),
    battery_pct: duck.battery,
    carrying: duck.carrying,
    on_goal: same(duck, goal),
    last_action: duck.lastAction,
  };
}
/** Battery each action spends. Holding position is free; driving costs most. */
export const actionCost: Record<SimAction, number> = {
  move_forward: 2,
  move_backward: 2,
  turn_left: 1,
  turn_right: 1,
  stop: 0,
  pick_up: 1,
  drop: 1,
};
function respawn(world: World, duck: Duck): Cell {
  const random = rng(world.seed + world.tick * 131 + duck.x * 7 + duck.y);
  const open: Cell[] = [];
  for (let y = 0; y < world.height; y++)
    for (let x = 0; x < world.width; x++) {
      const cell = { x, y };
      if (blocked(world, cell) || same(cell, world.missions[duck.id].nest))
        continue;
      open.push(cell);
    }
  return open.length ? open[Math.floor(random() * open.length)] : { ...duck };
}
/**
 * Applies one action and returns a fresh world. Illegal moves are carried out
 * and charged rather than corrected: a collision is the experiment's result,
 * not an error to hide.
 */
export function step(
  world: World,
  duckId: string,
  action: SimAction,
): { world: World; event: StepEvent } {
  const index = world.ducks.findIndex((d) => d.id === duckId);
  if (index < 0) throw Error(`No duck named ${duckId} in this arena.`);
  const duck = { ...world.ducks[index] };
  const mission = { ...world.missions[duckId] };
  const next: World = {
    ...world,
    ducks: world.ducks.map((d, i) => (i === index ? duck : d)),
    missions: { ...world.missions, [duckId]: mission },
  };
  const price = actionCost[action];
  if (duck.battery < price) return { world: next, event: "flat" };
  duck.battery -= price;
  duck.steps += 1;
  duck.lastAction = action;
  switch (action) {
    case "turn_left":
    case "turn_right": {
      duck.heading = turned(duck.heading, action === "turn_left" ? -1 : 1);
      return { world: next, event: "turned" };
    }
    case "move_forward":
    case "move_backward": {
      const cell = neighbor(duck, action === "move_forward" ? 0 : 2);
      if (blocked(next, cell, duck.id)) {
        duck.collisions += 1;
        return { world: next, event: "collision" };
      }
      duck.x = cell.x;
      duck.y = cell.y;
      return { world: next, event: "moved" };
    }
    case "pick_up": {
      if (!duck.carrying && mission.cargo && same(duck, mission.cargo)) {
        duck.carrying = true;
        mission.cargo = null;
        return { world: next, event: "picked" };
      }
      duck.wasted += 1;
      return { world: next, event: "wasted" };
    }
    case "drop": {
      if (!duck.carrying) {
        duck.wasted += 1;
        return { world: next, event: "wasted" };
      }
      duck.carrying = false;
      if (same(duck, mission.nest)) {
        duck.goals += 1;
        duck.battery = 100;
        mission.cargo = respawn(next, duck);
        return { world: next, event: "delivered" };
      }
      mission.cargo = { x: duck.x, y: duck.y };
      return { world: next, event: "dropped" };
    }
    default:
      return { world: next, event: "idle" };
  }
}
export const advance = (world: World): World => ({
  ...world,
  tick: world.tick + 1,
});
