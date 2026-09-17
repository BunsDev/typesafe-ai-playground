import { readBoundedBody } from "../../../lib/api";
import {
  createLocalBrowser,
  getLocalBrowser,
  closeLocalBrowser,
  requireLocalBrowser,
} from "../../../lib/localBrowser";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    requireLocalBrowser(request);
    const input = request.body
      ? JSON.parse(await readBoundedBody(request.body, 1024))
      : {};
    const size = (
      value: unknown,
      fallback: number,
      min: number,
      max: number,
    ) =>
      typeof value === "number" && Number.isFinite(value)
        ? Math.max(min, Math.min(max, Math.round(value)))
        : fallback;
    const viewport = {
      width: size(input.width, 1440, 360, 2560),
      height: size(input.height, 900, 240, 1600),
    };
    return Response.json(
      { sessionId: createLocalBrowser(viewport) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 400 });
  }
}
export async function GET(request: Request) {
  try {
    requireLocalBrowser(request);
    const session = getLocalBrowser(
      new URL(request.url).searchParams.get("id") || "",
    );
    return Response.json(
      {
        screenshot: session.screenshot,
        url: session.url,
        error: session.error,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 400 });
  }
}
export async function DELETE(request: Request) {
  try {
    requireLocalBrowser(request);
    closeLocalBrowser(new URL(request.url).searchParams.get("id") || "");
    return Response.json({ closed: true });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 400 });
  }
}
