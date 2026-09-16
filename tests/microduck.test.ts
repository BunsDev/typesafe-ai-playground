import { test } from "node:test";
import assert from "node:assert/strict";
import {
  actionCost,
  advance,
  blocked,
  createWorld,
  defaultArena,
  neighbor,
  observe,
  rng,
  step,
  target,
} from "../lib/microduckWorld";
import {
  buildDrivePayload,
  randomAction,
  resolveAction,
  scoreboard,
  topAction,
} from "../lib/driveDuckWithJev";
import { validatePayload } from "../lib/api";
import {
  simActions,
  type Decision,
  type Duck,
  type SimAction,
  type World,
} from "../types/microduck";
/** A hand-built 3x3 arena: one wall due north of the duck, cargo due west. */
const lab = (patch: Partial<Duck> = {}): World => ({
  width: 3,
  height: 3,
  walls: ["1,0"],
  ducks: [
    {
      id: "d1",
      name: "Duck A",
      x: 1,
      y: 1,
      heading: 0,
      battery: 100,
      carrying: false,
      lastAction: "none",
      steps: 0,
      collisions: 0,
      wasted: 0,
      goals: 0,
      ...patch,
    },
  ],
  missions: { d1: { cargo: { x: 0, y: 1 }, nest: { x: 2, y: 2 } } },
  seed: 1,
  tick: 0,
});
const only = (world: World) => world.ducks[0];
const reachable = (
  world: World,
  from: { x: number; y: number },
  to: { x: number; y: number },
) => {
  const seen = new Set([`${from.x},${from.y}`]);
  const queue = [from];
  while (queue.length) {
    const cell = queue.shift()!;
    if (cell.x === to.x && cell.y === to.y) return true;
    for (const [dx, dy] of [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ]) {
      const next = { x: cell.x + dx, y: cell.y + dy };
      const id = `${next.x},${next.y}`;
      if (
        next.x < 0 ||
        next.y < 0 ||
        next.x >= world.width ||
        next.y >= world.height ||
        world.walls.includes(id) ||
        seen.has(id)
      )
        continue;
      seen.add(id);
      queue.push(next);
    }
  }
  return false;
};
test("the same seed rebuilds the same arena, a different seed does not", () => {
  assert.deepEqual(createWorld(defaultArena), createWorld(defaultArena));
  assert.notDeepEqual(
    createWorld(defaultArena),
    createWorld({ ...defaultArena, seed: defaultArena.seed + 1 }),
  );
});
test("rng is a pure function of its seed", () => {
  const a = rng(42);
  const b = rng(42);
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
  assert.notEqual(rng(42)(), rng(43)());
});
test("every duck can still reach its cargo and its nest", () => {
  for (const seed of [1, 2, 3, 7, 19, 404]) {
    const world = createWorld({ ...defaultArena, seed, ducks: 4 });
    const placed = new Set<string>();
    for (const duck of world.ducks) {
      const mission = world.missions[duck.id];
      assert.ok(
        reachable(world, duck, mission.cargo!),
        `seed ${seed}: ${duck.name} cannot reach its cargo`,
      );
      assert.ok(
        reachable(world, mission.cargo!, mission.nest),
        `seed ${seed}: ${duck.name} cannot carry cargo to its nest`,
      );
      for (const cell of [duck, mission.cargo!, mission.nest]) {
        const id = `${cell.x},${cell.y}`;
        assert.ok(!world.walls.includes(id), `seed ${seed}: ${id} is a wall`);
        assert.ok(!placed.has(id), `seed ${seed}: ${id} is used twice`);
        placed.add(id);
      }
    }
  }
});
test("arena sizes outside the supported range are clamped, not refused", () => {
  const tiny = createWorld({ seed: 5, ducks: 9, width: 1, height: 0 });
  assert.deepEqual([tiny.width, tiny.height], [5, 5]);
  assert.equal(tiny.ducks.length, 4, "four ducks is the ceiling");
  const huge = createWorld({ seed: 5, ducks: 0, width: 99, height: 99 });
  assert.deepEqual([huge.width, huge.height], [14, 14]);
  assert.equal(huge.ducks.length, 1, "one duck is the floor");
  for (const seed of [1, 2, 3, 7, 19, 404]) {
    const packed = createWorld({ seed, ducks: 4, width: 5, height: 5 });
    const cells = packed.ducks.flatMap((duck) => [
      duck,
      packed.missions[duck.id].cargo!,
      packed.missions[duck.id].nest,
    ]);
    assert.equal(
      new Set(cells.map((c) => `${c.x},${c.y}`)).size,
      12,
      `seed ${seed}: the smallest arena still seats four ducks`,
    );
  }
});
test("the state names obstacles and the goal relative to the duck's nose", () => {
  const state = observe(lab(), only(lab()));
  assert.equal(state.obstacle_ahead, true);
  assert.equal(state.obstacle_left, false);
  assert.equal(state.obstacle_right, false);
  assert.equal(state.goal_direction, "left");
  assert.equal(state.distance_to_goal, 1);
  assert.equal(state.on_goal, false);
  assert.equal(state.last_action, "none");
  const facing = lab({ heading: 3 });
  assert.equal(observe(facing, only(facing)).goal_direction, "ahead");
  const away = lab({ heading: 1 });
  assert.equal(observe(away, only(away)).goal_direction, "behind");
});
test("driving into a wall dents the duck instead of moving it", () => {
  const before = lab();
  const { world, event } = step(before, "d1", "move_forward");
  assert.equal(event, "collision");
  assert.equal(only(world).collisions, 1);
  assert.deepEqual([only(world).x, only(world).y], [1, 1]);
  assert.equal(only(world).battery, 100 - actionCost.move_forward);
  assert.equal(only(before).collisions, 0, "the previous world is untouched");
  assert.equal(only(before).battery, 100);
});
test("a tick carries cargo from the floor to the nest", () => {
  let world = lab({ heading: 3 });
  world = step(world, "d1", "move_forward").world;
  assert.deepEqual([only(world).x, only(world).y], [0, 1]);
  assert.equal(observe(world, only(world)).on_goal, true);
  const picked = step(world, "d1", "pick_up");
  assert.equal(picked.event, "picked");
  assert.equal(only(picked.world).carrying, true);
  assert.equal(picked.world.missions.d1.cargo, null);
  assert.deepEqual(target(picked.world, only(picked.world)), { x: 2, y: 2 });
  const parked = {
    ...picked.world,
    ducks: [{ ...only(picked.world), x: 2, y: 2, battery: 40 }],
  };
  const delivered = step(parked, "d1", "drop");
  assert.equal(delivered.event, "delivered");
  assert.equal(only(delivered.world).goals, 1);
  assert.equal(only(delivered.world).carrying, false);
  assert.equal(only(delivered.world).battery, 100, "the nest recharges it");
  assert.ok(delivered.world.missions.d1.cargo, "a fresh cargo is placed");
});
test("dropping away from the nest leaves the cargo on that tile", () => {
  const carrying = lab({ carrying: true });
  const { world, event } = step(carrying, "d1", "drop");
  assert.equal(event, "dropped");
  assert.equal(only(world).goals, 0);
  assert.deepEqual(world.missions.d1.cargo, { x: 1, y: 1 });
});
test("picking up nothing and dropping nothing are counted as wasted ticks", () => {
  const empty = step(lab(), "d1", "pick_up");
  assert.equal(empty.event, "wasted");
  assert.equal(only(empty.world).wasted, 1);
  const nothing = step(lab(), "d1", "drop");
  assert.equal(nothing.event, "wasted");
  assert.equal(only(nothing.world).wasted, 1);
});
test("turning costs a quarter turn and holding position costs no battery", () => {
  assert.equal(only(step(lab(), "d1", "turn_left").world).heading, 3);
  assert.equal(only(step(lab(), "d1", "turn_right").world).heading, 1);
  const held = step(lab(), "d1", "stop");
  assert.equal(held.event, "idle");
  assert.equal(only(held.world).battery, 100);
  assert.equal(only(held.world).steps, 1);
});
test("a duck without the battery for an action goes flat rather than moving", () => {
  const { world, event } = step(
    lab({ battery: 1, heading: 3 }),
    "d1",
    "move_forward",
  );
  assert.equal(event, "flat");
  assert.equal(only(world).battery, 1);
  assert.deepEqual([only(world).x, only(world).y], [1, 1]);
  assert.equal(only(world).steps, 0);
  assert.equal(
    step(lab({ battery: 0 }), "d1", "stop").event,
    "idle",
    "holding still is always affordable",
  );
});
test("ducks block each other and the arena edge", () => {
  const world = lab();
  const two: World = {
    ...world,
    ducks: [
      only(world),
      { ...only(world), id: "d2", name: "Duck B", x: 2, y: 1 },
    ],
    missions: { ...world.missions, d2: world.missions.d1 },
  };
  assert.equal(blocked(two, { x: 2, y: 1 }, "d1"), true);
  assert.equal(blocked(two, { x: 2, y: 1 }, "d2"), false, "not by itself");
  assert.equal(blocked(two, { x: -1, y: 1 }), true, "the edge is solid");
  assert.equal(blocked(two, { x: 1, y: 0 }), true, "so is a wall");
  assert.deepEqual(neighbor(only(two), 2), { x: 1, y: 2 });
});
test("the tick counter only moves when the arena advances it", () => {
  assert.equal(step(lab(), "d1", "stop").world.tick, 0);
  assert.equal(advance(lab()).tick, 1);
});
test("one tick asks one closed question over all seven actions", () => {
  const world = lab();
  const { payload, sent, hidden } = buildDrivePayload(
    observe(world, only(world)),
    "",
  );
  const clean = validatePayload(payload);
  assert.equal(clean.model, "jev-latest");
  assert.deepEqual(Object.keys(clean.questions), ["action"]);
  assert.equal(clean.questions.action.type, "choice");
  assert.deepEqual(
    Object.keys(clean.questions.action.criteria!).sort(),
    [...simActions].sort(),
  );
  assert.deepEqual(hidden, []);
  assert.equal(Object.keys(sent).length, 9);
});
test("withheld fields leave the state entirely, and are not described", () => {
  const world = lab();
  const { payload, sent, hidden } = buildDrivePayload(
    observe(world, only(world)),
    "jev-latest",
    ["battery_pct", "obstacle_left"],
  );
  assert.deepEqual(hidden, ["obstacle_left", "battery_pct"]);
  assert.ok(!("battery_pct" in sent));
  assert.ok(!("obstacle_left" in sent));
  assert.ok("obstacle_right" in sent);
  const { instructions } = payload.questions.action;
  assert.ok(!instructions.includes("battery_pct"));
  assert.ok(instructions.includes("obstacle_right"));
  assert.throws(
    () =>
      buildDrivePayload(observe(world, only(world)), "", [
        ...Object.keys(sent),
        "battery_pct",
        "obstacle_left",
      ] as never),
    /at least one sensor field/,
  );
});
const answered = (choice: unknown, probabilities?: Record<string, unknown>) =>
  ({
    answers: {
      action: { type: "choice", choice, probabilities },
    },
  }) as never;
test("a named action is taken as given", () => {
  const choice = resolveAction(
    answered("turn_left", { turn_left: 0.7, stop: 0.2 }),
  );
  assert.equal(choice.action, "turn_left");
  assert.equal(choice.source, "choice");
  assert.deepEqual(choice.probabilities, { turn_left: 0.7, stop: 0.2 });
});
test("an action outside the seven falls back to the best-scoring one", () => {
  const choice = resolveAction(
    answered("fly_away", { move_forward: 0.3, turn_right: 0.55 }),
  );
  assert.equal(choice.action, "turn_right");
  assert.equal(choice.source, "argmax");
});
test("nothing usable stops the duck instead of guessing a move", () => {
  for (const response of [
    undefined,
    answered(undefined),
    answered("fly_away", { fly_away: 0.9, honk: 0.8 }),
    answered("fly_away", { move_forward: Number.NaN }),
  ]) {
    const choice = resolveAction(response);
    assert.equal(choice.action, "stop");
    assert.equal(choice.source, "fallback");
    assert.deepEqual(choice.probabilities, {});
  }
  assert.equal(topAction({}), null);
});
test("the random baseline only ever plays legal actions", () => {
  for (const value of [0, 0.5, 0.999999, 1]) {
    const action = randomAction(() => value);
    assert.ok(simActions.includes(action), `${value} produced ${action}`);
  }
  const stream = rng(11);
  const seen = new Set<SimAction>();
  for (let i = 0; i < 400; i++) seen.add(randomAction(stream));
  assert.equal(seen.size, simActions.length, "every action turns up");
});
const decision = (patch: Partial<Decision>): Decision => ({
  duckId: "d1",
  tick: 0,
  state: observe(lab(), only(lab())),
  sent: {},
  action: "stop",
  probabilities: {},
  source: "choice",
  latencyMs: 100,
  ...patch,
});
test("the scoreboard totals the arena and counts failed calls apart", () => {
  const world: World = {
    ...lab(),
    ducks: [{ ...only(lab()), steps: 6, goals: 1, collisions: 2, wasted: 1 }],
  };
  const board = scoreboard(
    world,
    [
      decision({ event: "moved", latencyMs: 200 }),
      decision({ event: "flat", latencyMs: 0 }),
      decision({
        event: "collision",
        error: "TypeSafe returned HTTP 429.",
        latencyMs: 0,
      }),
      decision({ event: "moved", latencyMs: 400 }),
    ],
    2000,
  );
  assert.equal(board.goals, 1);
  assert.equal(board.collisions, 2);
  assert.equal(board.wasted, 1);
  assert.equal(board.steps, 6);
  assert.equal(board.flat, 1);
  assert.equal(board.failures, 1);
  assert.equal(board.decisions, 4);
  assert.equal(board.meanLatencyMs, 300);
  assert.equal(board.lastLatencyMs, 400);
  assert.equal(board.decisionsPerSecond, 2);
  assert.equal(board.agreement, null, "nothing manual to agree with");
  assert.equal(board.agreementOf, 0);
});
test("agreement compares Jev's advice with the action the human took", () => {
  const board = scoreboard(
    lab(),
    [
      decision({
        source: "manual",
        action: "turn_left",
        probabilities: { turn_left: 0.8, stop: 0.1 },
      }),
      decision({
        source: "manual",
        action: "move_forward",
        probabilities: { turn_right: 0.6, move_forward: 0.3 },
      }),
      decision({ source: "manual", action: "stop", probabilities: {} }),
    ],
    1000,
  );
  assert.equal(board.agreementOf, 2, "advice-free moves are not counted");
  assert.equal(board.agreement, 0.5);
});
