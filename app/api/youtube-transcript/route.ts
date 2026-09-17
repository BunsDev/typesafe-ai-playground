import { readBoundedBody } from "../../../lib/api";
import { videoId } from "../../../lib/youtubeExtract";
import { fetchTranscript } from "../../../lib/youtubeTranscript";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  // Next canonicalizes request.url to localhost while the browser may use
  // 127.0.0.1; compare the actual authority, matching /api/run.
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
  let url: string;
  try {
    const body = JSON.parse(await readBoundedBody(request.body, 2048));
    if (typeof body.url !== "string") throw Error();
    url = body.url;
    videoId(url);
  } catch {
    return Response.json(
      { error: "Use a valid HTTPS YouTube video URL." },
      { status: 400 },
    );
  }
  try {
    return Response.json(await fetchTranscript(url, request.signal), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      {
        error:
          "No usable public captions. YouTube may have blocked the request, the video may be restricted, or the track exceeds prototype limits (60,000 characters / 200 natural chunks). No transcription or translation is performed.",
      },
      { status: 502 },
    );
  }
}
