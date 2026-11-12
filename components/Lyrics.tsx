'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Item } from '@/lib/types';
import { api } from '@/lib/api';
import { seek, usePlayer } from '@/lib/player';
import { useStore } from '@/lib/store';
import { chat } from '@/lib/ai';
import { Icon, Loader } from './ui';

type Line = { t: number; text: string };
type Lyr = { synced?: Line[]; plain?: string; source?: string };

const cache = new Map<string, Lyr>();
function parseLrc(lrc: string): Line[] {
  const out: Line[] = [];
  for (const raw of lrc.split('\n')) {
    const tags = [...raw.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
    if (!tags.length) continue;
    const text = raw.replace(/\[[^\]]*\]/g, '').trim();
    for (const m of tags) out.push({ t: Number(m[1]) * 60 + Number(m[2]), text });
  }
  return out.sort((a, b) => a.t - b.t);
}
const clean = (s: string) => s.replace(/\s*[\(（\[【].*?(official|MV|Music Video|Lyric|歌詞|Audio|ver|Ver|feat).*?[\)）\]】]/gi, '').replace(/\s*-\s*(Official|MV).*/i, '').trim();

async function fetchLyrics(it: Item): Promise<Lyr> {
  if (cache.has(it.id)) return cache.get(it.id)!;
  const artist = it.artists?.[0]?.name || '';
  const title = clean(it.title);
  let res: Lyr = {};
  try {
    const q = new URLSearchParams({ track_name: title, artist_name: artist, ...(it.album?.name ? { album_name: it.album.name } : {}), ...(it.sec ? { duration: String(it.sec) } : {}) });
    let r = await fetch('https://lrclib.net/api/get?' + q);
    let j: any = r.ok ? await r.json() : null;
    if (!j?.syncedLyrics && !j?.plainLyrics) {
      r = await fetch('https://lrclib.net/api/search?' + new URLSearchParams({ track_name: title, artist_name: artist }));
      const arr: any[] = r.ok ? await r.json() : [];
      j = arr.find((x) => x.syncedLyrics && (!it.sec || Math.abs(x.duration - it.sec) < 6)) || arr.find((x) => x.syncedLyrics) || arr[0];
    }
    if (j?.syncedLyrics) res = { synced: parseLrc(j.syncedLyrics), plain: j.plainLyrics, source: 'LRCLIB' };
    else if (j?.plainLyrics) res = { plain: j.plainLyrics, source: 'LRCLIB' };
  } catch {}
  if (!res.synced) {
    try {
      const y = await api<{ text: string; source: string }>({ fn: 'lyrics', id: it.id });
      if (y.text) res = { ...res, plain: y.text, source: y.source || 'YouTube Music' };
    } catch {}
  }
  cache.set(it.id, res);
  return res;
}

export default function Lyrics({ item, big }: { item?: Item; big?: boolean }) {
  const [lyr, setLyr] = useState<Lyr | null>(null);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [ai, setAi] = useState<{ mode: string; text: string } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const time = usePlayer((p) => p.time);
  const syncedPref = useStore((s) => s.settings.syncedLyrics);
  const hasKey = useStore((s) => !!s.settings.aiKey);
  const box = useRef<HTMLDivElement>(null);
  const userScroll = useRef(0);

  useEffect(() => {
    setLyr(null); setAi(null); setOffset(0);
    if (!item) return;
    let alive = true;
    setLoading(true);
    fetchLyrics(item).then((l) => alive && setLyr(l)).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const synced = syncedPref ? lyr?.synced : undefined;
  const active = useMemo(() => {
    if (!synced) return -1;
    const t = time + offset + 0.25;
    let lo = -1;
    for (let i = 0; i < synced.length; i++) { if (synced[i].t <= t) lo = i; else break; }
    return lo;
  }, [synced, time, offset]);

  useEffect(() => {
    if (active < 0 || !box.current || Date.now() - userScroll.current < 3000) return;
    const el = box.current.querySelector<HTMLElement>(`[data-i="${active}"]`);
    if (el) box.current.scrollTo({ top: el.offsetTop - box.current.clientHeight * 0.35, behavior: 'smooth' });
  }, [active]);

  const runAi = async (mode: 'translate' | 'explain') => {
    if (!lyr || aiBusy) return;
    const text = synced ? synced.map((l) => l.text).join('\n') : lyr.plain || '';
    setAiBusy(true);
    setAi({ mode, text: '' });
    try {
      const prompt = mode === 'translate'
        ? `次の歌詞を自然な日本語に翻訳してください（すでに日本語の行は英語に翻訳）。行ごとに対応させ、訳だけを出力してください。\n\n${text.slice(0, 6000)}`
        : `曲「${item?.title}」（${item?.artists?.map((a) => a.name).join(', ')}）の歌詞を日本語で解説してください。テーマ、印象的なフレーズ、背景の解釈を簡潔に。断定できない点は推測と明記。\n\n${text.slice(0, 6000)}`;
      await chat([{ role: 'user', content: prompt }], { onToken: (full) => setAi({ mode, text: full }) });
    } catch (e: any) { setAi({ mode, text: '⚠️ ' + (e.message || e) }); }
    setAiBusy(false);
  };

  if (!item) return <div className="empty">再生中の曲はありません</div>;
  if (loading) return <Loader />;
  if (!lyr || (!lyr.synced && !lyr.plain)) return <div className="empty"><div className="big"><Icon n="lyrics" /></div>歌詞が見つかりませんでした</div>;

  const transLines = ai?.mode === 'translate' ? ai.text.split('\n') : null;
  return (
    <div className={`lyrics ${big ? 'big' : ''}`}>
      <div className="lyr-tools">
        {synced && (
          <div className="bgroup">
            <button className="btn sm" onClick={() => setOffset((o) => o - 0.5)} aria-label="歌詞を遅らせる"><Icon n="remove" /></button>
            <button className="btn sm" onClick={() => setOffset(0)}>{offset === 0 ? '同期' : `${offset > 0 ? '+' : ''}${offset.toFixed(1)}s`}</button>
            <button className="btn sm" onClick={() => setOffset((o) => o + 0.5)} aria-label="歌詞を早める"><Icon n="add" /></button>
          </div>
        )}
        <span className="spacer" />
        {hasKey && (
          <>
            <button className={`btn sm ${ai?.mode === 'translate' ? 'tonal' : 'surface'}`} disabled={aiBusy} onClick={() => (ai?.mode === 'translate' ? setAi(null) : runAi('translate'))}><Icon n="translate" />翻訳</button>
            <button className={`btn sm ${ai?.mode === 'explain' ? 'tonal' : 'surface'}`} disabled={aiBusy} onClick={() => (ai?.mode === 'explain' ? setAi(null) : runAi('explain'))}><Icon n="auto_awesome" />解説</button>
          </>
        )}
      </div>
      {ai?.mode === 'explain' && <div className="ai-msg bot" style={{ maxWidth: '100%', margin: '8px 0' }}>{ai.text || '考えています…'}</div>}
      <div className="lyr-body" ref={box} onWheel={() => (userScroll.current = Date.now())} onTouchMove={() => (userScroll.current = Date.now())}>
        {synced ? synced.map((l, i) => (
          <button key={i} data-i={i} className={`lyr-line ${i === active ? 'on' : i < active ? 'past' : ''}`} onClick={() => { userScroll.current = 0; seek(Math.max(0, l.t - offset)); }}>
            {l.text || '♪'}
            {transLines?.[i] && l.text && <small>{transLines[i]}</small>}
          </button>
        )) : (
          <div className="lyr-plain">{transLines ? lyr.plain!.split('\n').map((l, i) => <div key={i}>{l}{transLines[i] && l.trim() && <small>{transLines[i]}</small>}</div>) : lyr.plain}</div>
        )}
        <div className="lyr-src">提供元: {lyr.source}{synced ? '（同期歌詞）' : ''}</div>
      </div>
    </div>
  );
}
