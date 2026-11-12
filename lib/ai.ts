'use client';
import { getState } from './store';

export const DEFAULT_MODELS: Record<string, string> = { openrouter: 'openrouter/auto', groq: 'openai/gpt-oss-120b' };
export type Msg = { role: 'system' | 'user' | 'assistant'; content: string };

export function aiReady() { return !!getState().settings.aiKey; }
export function aiModel() { const s = getState().settings; return s.aiModel || DEFAULT_MODELS[s.aiProvider]; }

export async function chat(messages: Msg[], opts: { onToken?: (full: string) => void; json?: boolean; temperature?: number; signal?: AbortSignal } = {}) {
  const s = getState().settings;
  if (!s.aiKey) throw new Error('設定で OpenRouter または Groq の API キーを登録してください');
  const stream = !!opts.onToken;
  const r = await fetch('/api/ai', {
    method: 'POST',
    signal: opts.signal,
    headers: { 'Content-Type': 'application/json', 'x-ai-provider': s.aiProvider, 'x-ai-key': s.aiKey },
    body: JSON.stringify({ model: aiModel(), messages, stream, temperature: opts.temperature ?? 0.4, ...(opts.json ? { response_format: { type: 'json_object' } } : {}) }),
  });
  if (!r.ok) {
    const t = await r.text();
    let m = t;
    try { const j = JSON.parse(t); m = j.error?.message || j.error || t; } catch {}
    throw new Error(`AIエラー (${r.status}): ${String(m).slice(0, 200)}`);
  }
  if (!stream) {
    const j = await r.json();
    return (j.choices?.[0]?.message?.content || '') as string;
  }
  const reader = r.body!.getReader();
  const dec = new TextDecoder();
  let buf = '', full = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      const l = line.trim();
      if (!l.startsWith('data:')) continue;
      const d = l.slice(5).trim();
      if (d === '[DONE]') continue;
      try {
        const j = JSON.parse(d);
        const delta = j.choices?.[0]?.delta?.content;
        if (delta) { full += delta; opts.onToken!(full); }
      } catch {}
    }
  }
  return full;
}

export function parseJson<T = any>(t: string): T | null {
  try { return JSON.parse(t); } catch {}
  const m = t.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}
