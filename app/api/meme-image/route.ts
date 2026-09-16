import { readBoundedBody } from "../../../lib/api";
import { fetchMemeImage } from "../../../lib/meme-image";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (
      (origin &&
        new URL(origin).host !==
          (request.headers.get("host") || new URL(request.url).host)) ||
      request.headers.get("sec-fetch-site") === "cross-site"
    )
      return Response.json(
        { error: "Cross-origin requests are not allowed." },
        { status: 403 },
      );
    if (!request.headers.get("content-type")?.includes("application/json"))
      return Response.json({ error: "Use application/json." }, { status: 415 });
    const body = JSON.parse(await readBoundedBody(request.body, 4096));
    if (typeof body.url !== "string") throw Error("Paste an image URL.");
    const image = await fetchMemeImage(body.url, request.signal);
    return new Response(new Uint8Array(image), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const safe =
      /^(Use |Paste |Choose |Image URLs |The image |The processed |Unsupported |Could not )/.test(
        message,
      )
        ? message
        : "Could not load this image. Check the link or try another image.";
    return Response.json({ error: safe }, { status: 400 });
  }
}
