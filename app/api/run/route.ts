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
  const key = process.env.TYPESAFE_API_KEY?.trim();
  if (!key)
    return Response.json(
      { error: "Set TYPESAFE_API_KEY on the server to run Jev." },
      { status: 503 },
    );
  try {
    const upstream = await fetch("https://api.typesafe.ai/v1/systemone", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(45000)]),
      cache: "no-store",
    });
    if (!upstream.ok) {
      await upstream.body?.cancel();
      return Response.json(
        {
          error: `TypeSafe returned HTTP ${upstream.status}. Check your API configuration or try again.`,
        },
        { status: upstream.status === 429 ? 429 : 502 },
      );
    }
    const data = JSON.parse(
      await readBoundedBody(upstream.body, 2 * 1024 * 1024),
    );
    if (
      !data ||
      typeof data !== "object" ||
      Array.isArray(data) ||
      !data.answers ||
      typeof data.answers !== "object" ||
      Array.isArray(data.answers)
    )
      throw Error("Invalid upstream response.");
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json(
      { error: "TypeSafe could not complete this request. Please try again." },
      { status: 502 },
    );
  }
}
