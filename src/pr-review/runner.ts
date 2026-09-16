import { buildHunkCandidates } from "./candidates";
import { classifyHunkWithJev, unclassified } from "./classify";
import type {
  Classification,
  JevTransport,
  ParsedPullRequest,
  RepoRule,
} from "./types";
/** Three concurrent hunks; failures are explicit and cancellation never approves unfinished work. */
export async function reviewPullRequest(
  pr: ParsedPullRequest,
  rules: RepoRule[],
  options: {
    signal: AbortSignal;
    onResult: (result: Classification) => void;
    transport?: JevTransport;
  },
) {
  const hunks = pr.files.flatMap((file) => file.hunks);
  const results: Classification[] = new Array(hunks.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(3, hunks.length) }, async () => {
      while (next < hunks.length && !options.signal.aborted) {
        const index = next++;
        const hunk = hunks[index];
        const candidates = buildHunkCandidates(hunk, rules);
        try {
          results[index] = await classifyHunkWithJev(
            hunk,
            candidates,
            { pr, rules },
            options.transport,
            options.signal,
          );
        } catch (error) {
          results[index] = unclassified(
            hunk,
            candidates,
            options.signal.aborted
              ? "Review stopped; this hunk was not classified."
              : error instanceof Error
                ? error.message
                : "Classification failed.",
          );
        }
        options.onResult(results[index]);
      }
    }),
  );
  for (let i = 0; i < hunks.length; i++)
    if (!results[i]) {
      results[i] = unclassified(
        hunks[i],
        buildHunkCandidates(hunks[i], rules),
        "Not classified; review was stopped.",
      );
      options.onResult(results[i]);
    }
  return results;
}
