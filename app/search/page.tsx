'use client';
import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApi } from '@/lib/api';
import type { Item, Section } from '@/lib/types';
import { hrefOf, isTrack } from '@/lib/types';
import { Art, playItem, Shelf, SongRow, Tile, useItemMenu } from '@/components/cards';
import { Icon, Loader } from '@/components/ui';

const TABS = [['all', 'すべて'], ['song', '曲'], ['video', '動画'], ['album', 'アルバム'], ['artist', 'アーティスト'], ['playlist', 'プレイリスト']] as const;

function Top({ it }: { it: Item }) {
  const router = useRouter();
  const menu = useItemMenu();
  return (
    <div className="top-result" onContextMenu={(e) => menu(e, it)}>
      <Art src={it.thumb} round={it.kind === 'artist'} className="top-art" />
      <div style={{ minWidth: 0 }}>
        <div className="top-t" onClick={() => (isTrack(it) ? playItem(it) : router.push(hrefOf(it)))}>{it.title}</div>
        <div className="muted">{it.subtitle}</div>
        <div className="row-flex" style={{ marginTop: 14, flexWrap: 'wrap' }}>
          {it.kind === 'artist' ? (
            <>
              <button className="btn filled" onClick={() => playItem(it, { shuffle: true })}><Icon n="shuffle" />シャッフル</button>
              <button className="btn surface" onClick={() => playItem(it)}><Icon n="radio" />ラジオ</button>
              <Link className="btn outlined" href={hrefOf(it)}>アーティストページ</Link>
            </>
          ) : (
            <>
              <button className="btn filled" onClick={() => playItem(it)}><Icon n="play_arrow" fill />再生</button>
              {!isTrack(it) && <Link className="btn outlined" href={hrefOf(it)}>開く</Link>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function S() {
  const sp = useSearchParams();
  const router = useRouter();
  const q = sp.get('q') || '';
  const type = sp.get('type') || 'all';
  const { data, loading, error } = useApi<{ sections: Section[] }>(q ? { fn: 'search', q, type } : null);
  const setType = (t: string) => router.replace(`/search?q=${encodeURIComponent(q)}${t !== 'all' ? `&type=${t}` : ''}`);
  const all = data?.sections || [];
  const top = type === 'all' ? all.find((s) => s.title === '上位の検索結果')?.items[0] : undefined;
  const rest = all.filter((s) => s.title !== '上位の検索結果');
  const flat = rest.flatMap((s) => s.items);
  const groups = type === 'all' ? ([['song', '曲'], ['video', '動画'], ['album', 'アルバム'], ['single', 'シングル'], ['artist', 'アーティスト'], ['playlist', 'プレイリスト'], ['podcast', 'ポッドキャスト'], ['episode', 'エピソード']] as const).map(([k, l]) => ({ k, l, items: flat.filter((x) => x.kind === k) })).filter((g) => g.items.length) : [];
  return (
    <div className="page">
      <div className="chips sticky-chips">
        {TABS.map(([k, l]) => <button key={k} className={`chip sl ${type === k ? 'on' : ''}`} onClick={() => setType(k)}>{l}</button>)}
        <Link className="chip sl sparkle" href={`/advanced?q=${encodeURIComponent(q)}`}><Icon n="auto_awesome" size={18} />AIで探す</Link>
      </div>
      {loading && <Loader />}
      {error && <div className="empty"><div className="big"><Icon n="error" /></div>{error}</div>}
      {top && <Top it={top} />}
      {type === 'all' ? groups.map((g) => (
        g.k === 'song' || g.k === 'video' || g.k === 'episode' ? (
          <section key={g.k} className="shelf"><div className="shelf-h"><h2>{g.l}</h2><span className="spacer" /><button className="btn outlined sm" onClick={() => setType(g.k === 'episode' ? 'all' : g.k)}>もっと見る</button></div>
            <div className="list">{g.items.slice(0, 6).map((it, i) => <SongRow key={it.id} it={it} list={g.items} index={i} ctx={{ type: 'search', title: `「${q}」の検索結果` }} plays />)}</div></section>
        ) : <Shelf key={g.k} sec={{ title: g.l, layout: 'carousel', items: g.items }} />
      )) : (
        type === 'song' || type === 'video' ? (
          <div className="list">{flat.map((it, i) => <SongRow key={it.id + i} it={it} list={flat} index={i} ctx={{ type: 'search', title: `「${q}」の検索結果` }} plays />)}</div>
        ) : <div className="tile-grid">{flat.map((it, i) => <Tile key={it.id + i} it={it} />)}</div>
      )}
      {data && !flat.length && !top && <div className="empty"><div className="big"><Icon n="search_off" /></div>結果が見つかりませんでした</div>}
    </div>
  );
}
export default function Page() { return <Suspense><S /></Suspense>; }
