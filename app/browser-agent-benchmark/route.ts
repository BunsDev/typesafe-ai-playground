import {
  nativeBenchmarks,
  nativeBenchmarkHtml,
} from "../../lib/nativeBrowser/benchmarks";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("task");
  if (id !== "pc" && id !== "profile")
    return new Response("Unknown benchmark", { status: 400 });
  return new Response(nativeBenchmarkHtml(nativeBenchmarks[id]), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy":
        "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; form-action 'none'; frame-ancestors 'self'",
    },
  });
}
