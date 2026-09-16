import { parsePullRequest } from "../src/pr-review/parse";
import type { PullRequestInput } from "../src/pr-review/types";
/** Parse data only. No checkout, compiler, package installation, or code execution. */
export function parseDiff(input: PullRequestInput) {
  return parsePullRequest(input);
}
