import { readBoundedBody } from "../../../lib/api";
import {
  requireLocalBrowser,
  getLocalBrowser,
} from "../../../lib/localBrowser";
import {
  createNativeSession,
  getNativeSession,
  closeNativeSession,
} from "../../../lib/nativeBrowser/session";
import { nativeMetrics } from "../../../lib/nativeBrowser/protocol";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    requireLocalBrowser(request);
    const input = JSON.parse(await readBoundedBody(request.body, 8192));
    const session = createNativeSession(input, new URL(request.url).origin);
    return Response.json(
      { id: session.id, goal: session.goal, expected: session.expected },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Invalid native task.",
      },
      { status: 400 },
    );
  }
}
export function GET(request: Request) {
  try {
    requireLocalBrowser(request);
    const id = new URL(request.url).searchParams.get("id") ?? "",
      session = getNativeSession(id),
      browser = getLocalBrowser(id);
    return Response.json(
      {
        task: session.task,
        goal: session.goal,
        expected: session.expected,
        report: session.report,
        metrics: session.report ? nativeMetrics(session.report.traces) : null,
        busy: session.busy,
        error: session.error,
        screenshot: browser.screenshot,
        url: browser.url,
        phase: browser.phase,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Native session unavailable.",
      },
      { status: 400 },
    );
  }
}
export function DELETE(request: Request) {
  try {
    requireLocalBrowser(request);
    closeNativeSession(new URL(request.url).searchParams.get("id") ?? "");
    return Response.json({ closed: true });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not close native session.",
      },
      { status: 400 },
    );
  }
}
