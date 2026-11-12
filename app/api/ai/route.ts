import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ENDPOINTS: Record<string, string> = {
  openrouter: 'https://openrouter.ai/api/v1',
  groq: 'https://api.groq.com/openai/v1',
};

/** Thin proxy: forwards the user's own key to OpenRouter / Groq (key is never stored). */
export async function POST(req: NextRequest) {
  const provider = req.headers.get('x-ai-provider') || 'openrouter';
  const key = req.headers.get('x-ai-key') || '';
  const base = ENDPOINTS[provider];
  if (!base || !key) return Response.json({ error: 'APIキーが設定されていません' }, { status: 400 });
  const body = await req.text();
  const r = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(provider === 'openrouter' ? { 'HTTP-Referer': 'https://m3tube.vercel.app', 'X-Title': 'M3Tube' } : {}),
    },
    body,
  });
  return new Response(r.body, { status: r.status, headers: { 'Content-Type': r.headers.get('content-type') || 'application/json', 'Cache-Control': 'no-store' } });
}

export async function GET(req: NextRequest) {
  const provider = req.nextUrl.searchParams.get('provider') || 'openrouter';
  const key = req.headers.get('x-ai-key') || '';
  const base = ENDPOINTS[provider];
  if (!base) return Response.json({ error: 'provider' }, { status: 400 });
  const r = await fetch(`${base}/models`, { headers: key ? { Authorization: `Bearer ${key}` } : {} });
  const j = await r.json().catch(() => ({}));
  const ids: string[] = (j.data || []).map((m: any) => m.id).sort();
  return Response.json({ ok: r.ok, models: ids, error: r.ok ? undefined : j?.error?.message || `HTTP ${r.status}` }, { status: r.ok ? 200 : r.status });
}
