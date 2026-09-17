/** The old public text-model synthesis endpoint is retired. Research runs in the local browser. */
export const dynamic = "force-dynamic";
export function POST() {
  return Response.json(
    {
      error: "Use the local browser research workspace at /jev-browser-agent.",
    },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
