'use client';
import { useEffect, useState } from 'react';

const cache = new Map<string, any>();
export async function api<T = any>(params: Record<string, string | undefined>): Promise<T> {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '') as [string, string][]).toString();
  if (cache.has(qs)) return cache.get(qs);
  const r = await fetch('/api/m?' + qs);
  const j = await r.json();
  if (!r.ok || j?.error) throw new Error(j?.error || 'error');
  if (cache.size > 150) cache.delete(cache.keys().next().value!);
  cache.set(qs, j);
  return j;
}
export function useApi<T = any>(params: Record<string, string | undefined> | null) {
  const key = params ? JSON.stringify(params) : '';
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: !!params });
  useEffect(() => {
    if (!params) return;
    let alive = true;
    setState({ loading: true });
    api<T>(params).then((d) => alive && setState({ data: d, loading: false })).catch((e) => alive && setState({ error: String(e.message || e), loading: false }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}
export const fmt = (s: number) => {
  if (!isFinite(s) || s < 0) s = 0;
  s = Math.floor(s);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`;
};
