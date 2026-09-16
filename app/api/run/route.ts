import { serverJevTransport, JevProviderError } from "../../../lib/serverJev";
import { readBoundedBody, validatePayload } from "../../../lib/api";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  let sameOrigin = true;
  try {
    if (origin)
      sameOrigin =
        new URL(origin).host ===
          (request.headers.get("host") || new URL(request.url).host) &&
        ["http:", "https:"].includes(new URL(origin).protocol);
  } catch {
    sameOrigin = false;
  }
  if (!sameOrigin || request.headers.get("sec-fetch-site") === "cross-site")
    return Response.json(
      { error: "Cross-origin requests are not allowed." },
      { status: 403 },
    );
  if (!request.headers.get("content-type")?.includes("application/json"))
    return Response.json({ error: "Use application/json." }, { status: 415 });
  let payload;
  try {
    payload = validatePayload(
      JSON.parse(await readBoundedBody(request.body, 512 * 1024)),
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid request." },
      { status: 400 },
    );
  }
  try {
    return Response.json(await serverJevTransport(payload, request.signal), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof JevProviderError
            ? error.message
            : "TypeSafe could not complete this request. Please try again.",
      },
      { status: error instanceof JevProviderError ? error.status : 502 },
    );
  }
}
