/**
 * The MicroDuck arena: a deterministic top-down grid stand-in for the
 * pollen-robotics/microduck simulator. Every value Jev sees about the robot is
 * defined here, so an odd decision can always be traced back to a typed state.
 */
export type SimAction =
  | "move_forward"
  | "move_backward"
  | "turn_left"
  | "turn_right"
  | "stop"
  | "pick_up"
  | "drop";
/** The closed action list. Jev never returns anything outside it. */
export const simActions: SimAction[] = [
  "move_forward",
  "move_backward",
  "turn_left",
  "turn_right",
  "stop",
  "pick_up",
  "drop",
];
export const actionLabels: Record<SimAction, string> = {
  move_forward: "Move forward",
  move_backward: "Move backward",
  turn_left: "Turn left",
  turn_right: "Turn right",
  stop: "Stop",
  pick_up: "Pick up",
  drop: "Drop",
};
/** What each action does in the arena, sent verbatim as the choice criteria. */
export const actionCriteria: Record<SimAction, string> = {
  move_forward:
    "Drive one tile in the direction the duck faces. Wastes the step and counts as a collision when obstacle_ahead is true.",
  move_backward:
    "Reverse one tile without turning. Useful only when the duck is wedged and the tile behind it is open.",
  turn_left:
    "Rotate 90 degrees counter-clockwise without moving. Use it when the goal or the only open tile is to the left.",
  turn_right:
    "Rotate 90 degrees clockwise without moving. Use it when the goal or the only open tile is to the right.",
  stop: "Hold position and spend no battery. Correct only when no other action can make progress.",
  pick_up:
    "Grab the cargo. Only works while on_goal is true, carrying is false, and the duck is standing on the cargo tile.",
  drop: "Release the cargo. Delivers it and recharges the duck when on_goal is true while carrying; otherwise it dumps the cargo on the floor.",
};
export const isSimAction = (value: unknown): value is SimAction =>
  typeof value === "string" && (simActions as string[]).includes(value);
/** 0 north, 1 east, 2 south, 3 west. */
export type Heading = 0 | 1 | 2 | 3;
export const headingLabels: Record<Heading, string> = {
  0: "north",
  1: "east",
  2: "south",
  3: "west",
};
export type GoalDirection = "here" | "ahead" | "behind" | "left" | "right";
/** Exactly what Jev is given each tick. Nothing else about the world is sent. */
export interface SimState {
  distance_to_goal: number;
  goal_direction: GoalDirection;
  obstacle_ahead: boolean;
  obstacle_left: boolean;
  obstacle_right: boolean;
  battery_pct: number;
  carrying: boolean;
  on_goal: boolean;
  last_action: SimAction | "none";
}
export type SimStateField = keyof SimState;
export const stateFields: SimStateField[] = [
  "distance_to_goal",
  "goal_direction",
  "obstacle_ahead",
  "obstacle_left",
  "obstacle_right",
  "battery_pct",
  "carrying",
  "on_goal",
  "last_action",
];
/** Fields the degraded-context test is allowed to withhold. */
export const hideableFields: SimStateField[] = [
  "obstacle_left",
  "obstacle_right",
  "obstacle_ahead",
  "goal_direction",
  "distance_to_goal",
  "battery_pct",
];
export const fieldHints: Record<SimStateField, string> = {
  distance_to_goal: "Tiles between the duck and whatever it owes next.",
  goal_direction: "Where that target sits relative to the duck's nose.",
  obstacle_ahead: "A wall or the arena edge one tile in front.",
  obstacle_left: "A wall or the arena edge one tile to the left.",
  obstacle_right: "A wall or the arena edge one tile to the right.",
  battery_pct: "Charge left. Delivering cargo to the nest refills it.",
  carrying: "True once the cargo is aboard.",
  on_goal: "The duck is standing on the tile it is heading for.",
  last_action: "The action applied on the previous tick.",
};
export interface Cell {
  x: number;
  y: number;
}
export interface Duck {
  id: string;
  name: string;
  x: number;
  y: number;
  heading: Heading;
  battery: number;
  carrying: boolean;
  lastAction: SimAction | "none";
  steps: number;
  collisions: number;
  wasted: number;
  goals: number;
}
/** Each duck owns its own cargo and nest, so no two ducks race for a tile. */
export interface Mission {
  cargo: Cell | null;
  nest: Cell;
}
export interface World {
  width: number;
  height: number;
  walls: string[];
  ducks: Duck[];
  missions: Record<string, Mission>;
  seed: number;
  tick: number;
}
export type StepEvent =
  | "moved"
  | "turned"
  | "collision"
  | "picked"
  | "dropped"
  | "delivered"
  | "wasted"
  | "idle"
  | "flat";
export type DecisionSource =
  "argmax" | "choice" | "fallback" | "random" | "manual";
/** One decision, kept whole so the viewport, panels, and export agree. */
export interface Decision {
  duckId: string;
  tick: number;
  state: SimState;
  sent: Partial<SimState>;
  action: SimAction;
  probabilities: Partial<Record<SimAction, number>>;
  source: DecisionSource;
  latencyMs: number;
  event?: StepEvent;
  /** The same tick re-asked with fields withheld, when the test is on. */
  degraded?: {
    sent: Partial<SimState>;
    hidden: SimStateField[];
    action: SimAction;
    probabilities: Partial<Record<SimAction, number>>;
    source: DecisionSource;
    latencyMs: number;
    error?: string;
  };
  error?: string;
}
export type ControlMode = "jev" | "random" | "manual";
export const modeLabels: Record<ControlMode, string> = {
  jev: "Jev control",
  random: "Random baseline",
  manual: "Manual control",
};
export interface Scoreboard {
  ducks: number;
  steps: number;
  goals: number;
  collisions: number;
  wasted: number;
  flat: number;
  decisions: number;
  failures: number;
  decisionsPerSecond: number;
  meanLatencyMs: number;
  lastLatencyMs: number;
  /** Manual mode only: how often Jev's advice matched the human's action. */
  agreement: number | null;
  agreementOf: number;
}
