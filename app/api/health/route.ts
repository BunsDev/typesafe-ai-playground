export const dynamic = 'force-dynamic';
export function GET() { return Response.json({ok:true,configured:!!process.env.TYPESAFE_API_KEY},{headers:{'Cache-Control':'no-store'}}); }
