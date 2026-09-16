export const CONSTRAINT_TYPES = [
  "boolean",
  "integer",
  "equality",
  "ordering",
  "scheduling",
] as const;
export type ConstraintType = (typeof CONSTRAINT_TYPES)[number];
export type ConstraintProblem = {
  variables: string[];
  constraints: string[];
  question: "can_all_constraints_be_true";
  type: ConstraintType;
  sorts: Record<string, "Bool" | "Int">;
  smt: string;
  constraintVariables: string[][];
};
type Expr = { op: string; value?: string; args: Expr[] };
const precedence: Record<string, number> = {
  "=>": 1,
  "||": 2,
  "&&": 3,
  "=": 4,
  "==": 4,
  "!=": 4,
  ">": 4,
  "<": 4,
  ">=": 4,
  "<=": 4,
  "+": 5,
  "-": 5,
  "*": 6,
};
export function parseConstraints(
  text: string,
  type: ConstraintType,
): ConstraintProblem {
  if (
    typeof text !== "string" ||
    text.length > 12000 ||
    !CONSTRAINT_TYPES.includes(type)
  )
    throw Error("Use a supported type and at most 12,000 characters.");
  const constraints = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("#"));
  if (!constraints.length || constraints.length > 60)
    throw Error("Enter 1–60 constraints, one per line.");
  const parents = new Map<string, string>();
  const variables = new Set<string>();
  let nodeCount = 0;
  const root = (key: string): string => {
    const p = parents.get(key);
    return p ? root(p) : key;
  };
  const unify = (a: string, b: string) => {
    a = root(a);
    b = root(b);
    if (a === b) return;
    if ((a === "Bool" && b === "Int") || (a === "Int" && b === "Bool"))
      throw Error("A value cannot be both Boolean and integer.");
    if (a === "Bool" || a === "Int") parents.set(b, a);
    else parents.set(a, b);
  };
  function sort(n: Expr): string {
    if (n.op === "id") return `v:${n.value}`;
    if (n.op === "bool") return "Bool";
    if (n.op === "int") return "Int";
    const s = n.args.map(sort);
    if (["+", "-", "*", "neg"].includes(n.op)) {
      s.forEach((v) => unify(v, "Int"));
      return "Int";
    }
    if ([">", "<", ">=", "<="].includes(n.op)) {
      s.forEach((v) => unify(v, "Int"));
      return "Bool";
    }
    if (["=", "==", "!="].includes(n.op)) {
      unify(s[0], s[1]);
      return "Bool";
    }
    s.forEach((v) => unify(v, "Bool"));
    return "Bool";
  }
  const constraintVariables: string[][] = [];
  const ast = constraints.map((line, lineIndex) => {
    const tokens: string[] = [];
    let pos = 0;
    while (pos < line.length) {
      const m =
        /^\s*(=>|&&|\|\||>=|<=|!=|==|[()!+*<>=-]|[A-Za-z_][A-Za-z_0-9]*|\d+)/.exec(
          line.slice(pos),
        );
      if (!m) {
        if (!line.slice(pos).trim()) break;
        throw Error(
          `Unsupported syntax on line ${lineIndex + 1}. Use the documented operators.`,
        );
      }
      tokens.push(m[1]);
      pos += m[0].length;
      if (tokens.length > 160)
        throw Error("Each constraint is limited to 160 tokens.");
    }
    let i = 0;
    const names = new Set<string>();
    function parse(min = 0, depth = 0): Expr {
      if (depth > 24 || ++nodeCount > 1000)
        throw Error("Expression nesting or size limit exceeded.");
      const token = tokens[i++];
      let left: Expr;
      if (token === "(") {
        left = parse(0, depth + 1);
        if (tokens[i++] !== ")")
          throw Error(`Unbalanced parentheses on line ${lineIndex + 1}.`);
      } else if (token === "!" || token === "-")
        left = {
          op: token === "!" ? "not" : "neg",
          args: [parse(7, depth + 1)],
        };
      else if (token === "true" || token === "false")
        left = { op: "bool", value: token, args: [] };
      else if (token && /^\d+$/.test(token)) {
        if (token.length > 15)
          throw Error("Integer constants are limited to 15 digits.");
        left = { op: "int", value: BigInt(token).toString(), args: [] };
      } else if (token && /^[A-Za-z_][A-Za-z_0-9]*$/.test(token)) {
        if (token.length > 64)
          throw Error("Variable names are limited to 64 characters.");
        variables.add(token);
        names.add(token);
        left = { op: "id", value: token, args: [] };
      } else
        throw Error(
          `Expected a variable, integer or Boolean on line ${lineIndex + 1}.`,
        );
      while (i < tokens.length && (precedence[tokens[i]] ?? -1) >= min) {
        const op = tokens[i++],
          right = parse(precedence[op] + (op === "=>" ? 0 : 1), depth + 1);
        if (op === "*" && !isConstant(left) && !isConstant(right))
          throw Error(
            "Only multiplication by an integer constant is supported.",
          );
        left = { op, args: [left, right] };
      }
      return left;
    }
    const expression = parse();
    if (i !== tokens.length)
      throw Error(`Unexpected token on line ${lineIndex + 1}.`);
    unify(sort(expression), "Bool");
    constraintVariables.push([...names]);
    return expression;
  });
  if (variables.size > 40) throw Error("At most 40 variables are supported.");
  const sorts = Object.fromEntries(
    [...variables].map((v) => {
      const r = root(`v:${v}`);
      return [
        v,
        r === "Bool"
          ? "Bool"
          : r === "Int"
            ? "Int"
            : type === "boolean"
              ? "Bool"
              : "Int",
      ];
    }),
  ) as Record<string, "Bool" | "Int">;
  // Prefix and quote identifiers so reserved SMT-LIB words cannot alter syntax.
  const identifier = (v: string) => `|v_${v}|`;
  const emit = (n: Expr): string =>
    n.op === "id"
      ? identifier(n.value!)
      : n.op === "int" || n.op === "bool"
        ? n.value!
        : `(${({ "==": "=", "!=": "distinct", "&&": "and", "||": "or", neg: "-" } as Record<string, string>)[n.op] || n.op} ${n.args.map(emit).join(" ")})`;
  const smt = [...variables]
    .map((v) => `(declare-const ${identifier(v)} ${sorts[v]})`)
    .concat(ast.map((n) => `(assert ${emit(n)})`))
    .join("\n");
  return {
    variables: [...variables],
    constraints,
    question: "can_all_constraints_be_true",
    type,
    sorts,
    smt,
    constraintVariables,
  };
}
function isConstant(n: Expr): boolean {
  return n.op === "int" || (n.op === "neg" && n.args[0].op === "int");
}
export function decomposeProblem(p: ConstraintProblem): ConstraintProblem[] {
  const groups: { lines: string[]; vars: Set<string> }[] = [];
  p.constraints.forEach((line, i) => {
    const vars = new Set(p.constraintVariables[i]);
    const matches = groups.filter((g) => [...vars].some((v) => g.vars.has(v)));
    const group = { lines: [line], vars };
    for (const old of matches) {
      group.lines.unshift(...old.lines);
      old.vars.forEach((v) => vars.add(v));
      groups.splice(groups.indexOf(old), 1);
    }
    groups.push(group);
  });
  // Reparse only truly independent connected components. Preserve full inferred sorts.
  return groups.map((g) => {
    const parsed = parseConstraints(g.lines.join("\n"), p.type);
    return {
      ...parsed,
      sorts: Object.fromEntries(parsed.variables.map((v) => [v, p.sorts[v]])),
    };
  });
}
