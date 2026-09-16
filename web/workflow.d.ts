export interface Rule {
  id: string;
  name: string;
  condition: string;
  action: string;
}
export interface Turn {
  role: "user" | "assistant";
  content: string;
}
export interface Decision {
  kind: "recommendation" | "question";
  ruleId?: string;
  name?: string;
  action?: string;
  text: string;
  probability?: number;
}
export function defaults(): Rule[];
export function validateRules(rules: Rule[]): Rule[];
export function buildRequest(
  turns: Turn[],
  rules: Rule[],
  followupQuestion?: string,
): unknown;
export function resolve(
  response: unknown,
  rules: Rule[],
  followupQuestion?: string,
): Decision;
