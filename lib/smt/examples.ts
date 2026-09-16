import type { ConstraintType } from "./parser";
export const SOLVER_EXAMPLES: {
  name: string;
  type: ConstraintType;
  text: string;
  expected: "satisfiable" | "unsatisfiable";
}[] = [
  {
    name: "Impossible bounds",
    type: "integer",
    text: "x > 5\nx < 3",
    expected: "unsatisfiable",
  },
  {
    name: "Team availability",
    type: "boolean",
    text: "alice_available = true\nbob_available = true\nmeeting_requires_alice = true\nmeeting_requires_bob = true",
    expected: "satisfiable",
  },
  {
    name: "Equality contradiction",
    type: "equality",
    text: "x = y\ny = 2\nx != 2",
    expected: "unsatisfiable",
  },
  {
    name: "Ordered tasks",
    type: "ordering",
    text: "a < b\nb < c\na = 1\nc = 5",
    expected: "satisfiable",
  },
  {
    name: "Overlapping meetings",
    type: "scheduling",
    text: "a_start = 9\na_end = 11\nb_start = 10\nb_end = 12\n(a_end <= b_start) || (b_end <= a_start)",
    expected: "unsatisfiable",
  },
];
