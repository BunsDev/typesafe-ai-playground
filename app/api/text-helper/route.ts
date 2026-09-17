/** Retired: the browser workspace chooses goal spans with Jev instead of generating text. */
export const dynamic = "force-dynamic";
export function GET() {
  return Response.json(
    { configured: false, model: null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export function POST() {
  return Response.json(
    {
      error:
        "Text generation is disabled for this browser example. Use Jev goal spans.",
    },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
