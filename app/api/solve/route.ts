import { readBoundedBody } from "../../../lib/api";
import { parseConstraints } from "../../../lib/smt/parser";
import { solveExact } from "../../../lib/smt/exact";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  try {
    if (
      request.headers.get("sec-fetch-site") === "cross-site" ||
      (origin &&
        new URL(origin).host !==
          (request.headers.get("host") || new URL(request.url).host))
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
  let problem;
  try {
    const body = JSON.parse(await readBoundedBody(request.body, 16000));
    problem = parseConstraints(body.text, body.type);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Invalid constraints." },
      { status: 400 },
    );
  }
  return Response.json(await solveExact(problem), {
    headers: { "Cache-Control": "no-store" },
  });
}
