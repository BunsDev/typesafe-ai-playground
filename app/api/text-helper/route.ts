import { readBoundedBody } from "../../../lib/api";
import { TEXT_VALUE } from "../../../lib/textHelper";
export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";
/**
 * The small-LLM text helper for TYPE_TEXT. Credentials stay server-side; the
 * client receives the raw completion and must parse it as a small JSON object
 * before typing. Not configured → 503, and the lab falls back to Jev spans.
 */
const config = () => ({
  key: process.env.TEXT_MODEL_API_KEY?.trim() || "",
  base: (
    process.env.TEXT_MODEL_BASE_URL?.trim() || "https://openrouter.ai/api/v1"
  ).replace(/\/+$/, ""),
  model: process.env.TEXT_MODEL?.trim() || "inception/mercury-2.5",
  reasoning: process.env.TEXT_MODEL_REASONING?.trim() || "none",
});
export function GET() {
  const { key, model } = config();
  return Response.json(
    { configured: !!key, model: key ? model : null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  try {
    if (origin) {
      const url = new URL(origin);
      if (
        url.host !==
          (request.headers.get("host") || new URL(request.url).host) ||
        !["http:", "https:"].includes(url.protocol)
      )
        return false;
    }
  } catch {
    return false;
  }
  return request.headers.get("sec-fetch-site") !== "cross-site";
}
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json(
      { error: "Cross-origin requests are not allowed." },
      { status: 403 },
    );
  if (!request.headers.get("content-type")?.includes("application/json"))
    return Response.json({ error: "Use application/json." }, { status: 415 });
  const { key, base, model, reasoning } = config();
  if (!key)
    return Response.json(
      {
        error:
          "TYPE_TEXT needs TEXT_MODEL_API_KEY on the server; no text is guessed by the executor.",
      },
      { status: 503 },
    );
  let context: unknown;
  try {
    const body = JSON.parse(await readBoundedBody(request.body, 64 * 1024));
    context = body?.context;
    if (
      !context ||
      typeof context !== "object" ||
      typeof (context as { goal?: unknown }).goal !== "string"
    )
      throw Error("Send a text-helper context with a goal.");
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid request." },
      { status: 400 },
    );
  }
  try {
    const upstream = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 256,
        temperature: 0,
        response_format: { type: "json_object" },
        ...(reasoning === "none"
          ? { reasoning: { enabled: false } }
          : { reasoning: { effort: reasoning } }),
        messages: [
          { role: "system", content: TEXT_VALUE },
          { role: "user", content: JSON.stringify(context) },
        ],
      }),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(25000)]),
      cache: "no-store",
    });
    if (!upstream.ok) {
      await upstream.body?.cancel();
      return Response.json(
        {
          error: `Text model provider returned HTTP ${upstream.status}; nothing typed.`,
        },
        { status: 502 },
      );
    }
    const data = JSON.parse(await readBoundedBody(upstream.body, 256 * 1024));
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string")
      return Response.json(
        { error: "Text model returned no content; nothing typed." },
        { status: 502 },
      );
    return Response.json(
      { content, model: data?.model ?? model, usage: data?.usage ?? null },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Text model connection failed; nothing typed." },
      { status: 502 },
    );
  }
}
