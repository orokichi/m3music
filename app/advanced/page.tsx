'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { chat, parseJson } from '@/lib/ai';
import { useStore, actions } from '@/lib/store';
import { playList } from '@/lib/player';
import type { Item, Section } from '@/lib/types';
import { isTrack } from '@/lib/types';
import { SongRow, Tile } from '@/components/cards';
import { Icon, Loader, useSnack } from '@/components/ui';

type Q = { q: string; type: 'song' | 'video' | 'album' | 'artist' | 'playlist' };
type Plan = { intent?: string; title?: string; queries: Q[]; count?: number };
type R = Item & { reason?: string };

const PLAN = `あなたは音楽キュレーターで、YouTube Music の検索の専門家です。ユーザーの要望（気分、シーン、似た曲、年代、ジャンル、歌詞のテーマなど）を、YouTube Music で良い結果が出る検索の組み合わせに変換してください。
必ず次の JSON だけを返します:
{"intent":"要望の解釈を1文で","title":"結果に付けるプレイリスト名（短く）","count":曲数(10〜40、指定がなければ25),"queries":[{"q":"検索語","type":"song|video|album|artist|playlist"}]}
- queries は 3〜6 個。具体的なアーティスト名・曲名・ジャンル名を積極的に使う（例: 「雨の日に聴きたい邦楽」→ "雨 邦楽 バラード", "ヨルシカ", "雨の歌 J-POP" など）。
- 「〜みたいな曲」は、そのアーティストと似たアーティスト名で song 検索を作る。
- 基本は song。アルバムやアーティストを探す要望の場合のみ album / artist / playlist を使う。`;
const RANK = `あなたは音楽キュレーターです。ユーザーの要望に合う曲を候補から選び、流れの良い再生順に並べてください。同じ曲の重複（別バージョン含む）は1つにします。
必ず次の JSON だけを返します: {"results":[{"i":候補番号,"why":"選んだ理由（日本語20〜35字）"}]}`;

function Adv() {
  const sp = useSearchParams();
  const router = useRouter();
  const snack = useSnack();
  const key = useStore((s) => s.settings.aiKey);
  const [q, setQ] = useState(sp.get('q') || '');
  const [stage, setStage] = useState<'idle' | 'plan' | 'search' | 'rank' | 'done' | 'error'>('idle');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [tracks, setTracks] = useState<R[]>([]);
  const [others, setOthers] = useState<Item[]>([]);
  const [err, setErr] = useState('');
  const run = useRef(0);

  const go = async (text: string) => {
    if (!text.trim()) return;
    const my = ++run.current;
    setErr(''); setTracks([]); setOthers([]); setPlan(null); setStage('plan');
    try {
      const pl = parseJson<Plan>(await chat([{ role: 'system', content: PLAN }, { role: 'user', content: text }], { json: true, temperature: 0.3 }));
      if (!pl?.queries?.length) throw new Error('検索プランを作れませんでした');
      if (my !== run.current) return;
      setPlan(pl); setStage('search');
      const res = await Promise.allSettled(pl.queries.slice(0, 6).map((x) => api<{ sections: Section[] }>({ fn: 'search', q: x.q, type: x.type || 'song' })));
      const lists = res.map((r) => (r.status === 'fulfilled' ? r.value.sections.flatMap((s) => s.items) : []));
      const seen = new Set<string>();
      const pool: Item[] = [], other: Item[] = [];
      for (let i = 0; i < 25; i++) for (const l of lists) { const v = l[i]; if (!v || seen.has(v.id)) continue; seen.add(v.id); (isTrack(v) ? pool : other).push(v); }
      if (my !== run.current) return;
      setOthers(other.slice(0, 12));
      if (!pool.length) { setStage('done'); return; }
      setTracks(pool.slice(0, 20)); setStage('rank');
      const cand = pool.slice(0, 70);
      const list = cand.map((v, i) => `${i}. ${v.title} / ${v.artists?.map((a) => a.name).join(', ') || v.subtitle || ''}${v.album ? ' / ' + v.album.name : ''}${v.duration ? ' / ' + v.duration : ''}`).join('\n');
      const rj = parseJson<{ results: { i: number; why: string }[] }>(await chat([{ role: 'system', content: RANK }, { role: 'user', content: `要望: ${text}\n曲数: ${pl.count || 25}\n\n候補:\n${list}` }], { json: true, temperature: 0.3 }));
      if (my !== run.current) return;
      const ranked = (rj?.results || []).map((r) => cand[r.i] && { ...cand[r.i], reason: r.why }).filter(Boolean) as R[];
      setTracks(ranked.length ? ranked : pool.slice(0, 25));
      setStage('done');
    } catch (e: any) {
      if (my !== run.current) return;
      setErr(String(e.message || e)); setStage('error');
    }
  };
  useEffect(() => { const q0 = sp.get('q'); if (q0 && key) go(q0); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [key]);
  const submit = (t = q) => { setQ(t); router.replace(`/advanced?q=${encodeURIComponent(t)}`); go(t); };
  const busy = stage === 'plan' || stage === 'search' || stage === 'rank';
  const title = plan?.title || q;
  const ctx = { type: 'ai', title: `AI: ${title}` };
  return (
    <div className="page" style={{ maxWidth: 1100 }}>
      <div className="ai-hero">
        <div className="h1 row-flex" style={{ margin: 0 }}><span className="icon-btn sparkle" style={{ borderRadius: 14 }}><Icon n="auto_awesome" fill /></span>AI 検索</div>
        <div className="muted" style={{ margin: '8px 0 16px' }}>気分やシーン、「〇〇みたいな曲」など、聴きたい音楽を言葉で伝えてください。AI が検索を組み立て、要望に合う曲を選んで並べます。</div>
        {!key && <div className="ai-card"><div className="hd"><Icon n="key" />API キーが必要です</div><div style={{ margin: '8px 0 12px' }}>設定で OpenRouter または Groq の API キーを登録してください。</div><Link className="btn filled" href="/settings#ai">設定を開く</Link></div>}
        <div className="ai-input" style={{ background: 'var(--md-surface-container-high)' }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && submit()} placeholder="例: 夜のドライブに合うシティポップ、80年代と最近のを混ぜて" />
          <button className="btn filled" disabled={busy || !key} onClick={() => submit()}><Icon n="auto_awesome" />探す</button>
        </div>
        <div className="chips" style={{ marginTop: 12, flexWrap: 'wrap' }}>
          {['雨の日に聴きたい落ち着く邦楽', 'YOASOBI みたいな曲', '集中できる歌なしのローファイ', '朝の通勤で元気が出る洋楽', '失恋した夜に聴くバラード'].map((x) => <button key={x} className="chip sl" disabled={!key} onClick={() => submit(x)}>{x}</button>)}
        </div>
      </div>
      {plan && (
        <div className="ai-card">
          <div className="hd"><Icon n="psychology" />{plan.intent || '検索プラン'}</div>
          <div className="chips" style={{ marginTop: 8, flexWrap: 'wrap' }}>{plan.queries.map((x, i) => <Link key={i} href={`/search?q=${encodeURIComponent(x.q)}&type=${x.type}`} className="chip"><Icon n="search" size={16} />{x.q}</Link>)}</div>
        </div>
      )}
      {busy && <div className="row-flex muted" style={{ justifyContent: 'center' }}><Loader small />{stage === 'plan' ? '要望を解析中…' : stage === 'search' ? '曲を集めています…' : 'AI が選曲・並べ替え中…'}</div>}
      {err && <div className="empty"><div className="big"><Icon n="error" /></div>{err}</div>}
      {tracks.length > 0 && (
        <section className="shelf">
          <div className="shelf-h" style={{ flexWrap: 'wrap' }}>
            <div><div className="strap">AI が選んだ {tracks.length} 曲</div><h2>{title}</h2></div>
            <span className="spacer" />
            <button className="btn filled" onClick={() => playList(tracks, 0, ctx)}><Icon n="play_arrow" fill />再生</button>
            <button className="btn tonal" onClick={() => playList(tracks, 0, ctx, { shuffle: true })}><Icon n="shuffle" />シャッフル</button>
            <button className="btn outlined" onClick={() => { actions.createLocal(title, tracks); snack({ msg: `「${title}」をライブラリに保存しました` }); }}><Icon n="playlist_add" />保存</button>
          </div>
          <div className="list" style={{ opacity: stage === 'rank' ? 0.55 : 1, transition: 'opacity .3s' }}>
            {tracks.map((t, i) => (
              <div key={t.id}>
                <SongRow it={t} list={tracks} index={i} ctx={ctx} />
                {t.reason && <div className="ai-reason" style={{ margin: '-4px 0 8px 72px' }}><Icon n="auto_awesome" />{t.reason}</div>}
              </div>
            ))}
          </div>
        </section>
      )}
      {others.length > 0 && stage !== 'plan' && (
        <section className="shelf"><div className="shelf-h"><h2>関連するアルバム・アーティスト・プレイリスト</h2></div><div className="carousel">{others.map((o) => <Tile key={o.id} it={o} />)}</div></section>
      )}
    </div>
  );
}
export default function Page() { return <Suspense><Adv /></Suspense>; }
