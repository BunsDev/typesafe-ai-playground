import { DOOM_ACTIONS, type DoomAction, type GameState } from "../types/doom";
/** Seeded, reproducible baseline; it receives no tactical policy or privileged map inputs. */
export function baselineRandomAgent(
  state: Pick<GameState, "seed" | "tick">,
): DoomAction {
  let value =
    (Math.imul(state.seed + 1, 747796405) +
      Math.imul(state.tick + 1, 2891336453)) >>>
    0;
  value = Math.imul(value ^ (value >>> 16), 2246822507) >>> 0;
  value = (value ^ (value >>> 13)) >>> 0;
  return DOOM_ACTIONS[value % DOOM_ACTIONS.length];
}
