import { readBoundedBody } from "../../../lib/api";
import {
  loadGitHubPullRequest,
  parseGitHubPrUrl,
} from "../../../src/pr-review/github";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  try {
    if (
      request.headers.get("sec-fetch-site") === "cross-site" ||
      (origin &&
        (new URL(origin).host !==
          (request.headers.get("host") || new URL(request.url).host) ||
          !["http:", "https:"].includes(new URL(origin).protocol)))
    )
      return Response.json(
        { error: "Cross-origin requests are not allowed." },
        { status: 403 },
      );
  } catch {
    return Response.json({ error: "Invalid origin." }, { status: 403 });
  }
  if (!request.headers.get("content-type")?.includes("application/json"))
    return Response.json({ error: "Use application/json." }, { status: 415 });
  let url: string;
  try {
    const input = JSON.parse(await readBoundedBody(request.body, 4096));
    url = input.url;
    parseGitHubPrUrl(url);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid PR URL." },
      { status: 400 },
    );
  }
  try {
    return Response.json(await loadGitHubPullRequest(url, request.signal), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Could not load this PR.",
      },
      { status: 502 },
    );
  }
}
