import { NextRequest } from 'next/server';
export const runtime = 'nodejs';
/** Image proxy (CORS) used only for extracting artwork colors. */
export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get('u') || '';
  if (!/^https:\/\/([a-z0-9-]+\.)*(ytimg\.com|googleusercontent\.com|ggpht\.com)\//.test(u)) return new Response('bad', { status: 400 });
  const r = await fetch(u);
  return new Response(r.body, { status: r.status, headers: { 'Content-Type': r.headers.get('content-type') || 'image/jpeg', 'Cache-Control': 'public, max-age=86400, s-maxage=604800', 'Access-Control-Allow-Origin': '*' } });
}
