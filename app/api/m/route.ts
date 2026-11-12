import { NextRequest } from 'next/server';
import * as M from '@/lib/ytm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const fn = p.get('fn');
  let maxAge = 600;
  try {
    let data: any;
    switch (fn) {
      case 'home': data = await M.home(p.get('chip') || undefined); maxAge = 900; break;
      case 'explore': data = await M.explore(); maxAge = 1800; break;
      case 'browse': data = await M.browse(p.get('id')!, p.get('params') || undefined); maxAge = 1800; break;
      case 'search': data = await M.search(p.get('q') || '', p.get('type') || 'all'); break;
      case 'suggest': data = await M.suggest(p.get('q') || ''); maxAge = 3600; break;
      case 'artist': data = await M.artist(p.get('id')!); maxAge = 1800; break;
      case 'album': data = await M.album(p.get('id')!); maxAge = 3600; break;
      case 'playlist': data = await M.playlist(p.get('id')!); maxAge = 900; break;
      case 'upnext': data = await M.upnext(p.get('id')!, p.get('list') || undefined); maxAge = 600; break;
      case 'related': data = await M.related(p.get('id')!); maxAge = 3600; break;
      case 'lyrics': data = await M.lyrics(p.get('id')!); maxAge = 86400; break;
      default: return Response.json({ error: 'unknown fn' }, { status: 400 });
    }
    return Response.json(data, { headers: { 'Cache-Control': `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 4}` } });
  } catch (e: any) {
    return Response.json({ error: String(e?.message || e).slice(0, 300) }, { status: 500 });
  }
}
