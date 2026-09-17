import { readBoundedBody } from "../../../../lib/api";
import { requireLocalBrowser } from "../../../../lib/localBrowser";
import { executeNativeSession } from "../../../../lib/nativeBrowser/session";
import { nativeMetrics } from "../../../../lib/nativeBrowser/protocol";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function POST(request: Request) {
  try {
    requireLocalBrowser(request);
    const input = JSON.parse(await readBoundedBody(request.body, 512));
    if (typeof input.id !== "string" || input.id.length > 100)
      throw Error("Native session ID required.");
    const report = await executeNativeSession(
      input.id,
      request.signal,
      request.headers.get("x-typesafe-api-key"),
    );
    return Response.json(
      { report, metrics: nativeMetrics(report.traces) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Native run failed." },
      { status: 400 },
    );
  }
}
