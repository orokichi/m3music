'use client';
import Link from 'next/link';
import { ReactNode, useState } from 'react';
import type { Artist, Item } from '@/lib/types';
import { playList, playNext, addToQueue } from '@/lib/player';
import { Art, SongRow } from './cards';
import { Icon, MenuItem, useMenu } from './ui';
import { fmt } from '@/lib/api';

export function CollectionHeader({ thumb, title, kind, artists, meta, description, tracks, ctx, saved, onSave, extraMenu, children }: {
  thumb?: string; title: string; kind: string; artists?: Artist[]; meta?: string; description?: string; tracks: Item[];
  ctx: { type: string; id?: string; title?: string }; saved?: boolean; onSave?: () => void; extraMenu?: MenuItem[]; children?: ReactNode;
}) {
  const [more, setMore] = useState(false);
  const menu = useMenu();
  const total = tracks.reduce((a, t) => a + (t.sec || 0), 0);
  return (
    <div className="coll-head">
      <div className="coll-bg" style={{ backgroundImage: thumb ? `url("${thumb}")` : undefined }} />
      <Art src={thumb} className="coll-art" />
      <div className="coll-info">
        <div className="coll-kind">{kind}</div>
        <h1 className="coll-title">{title}</h1>
        {artists && artists.length > 0 && <div className="coll-artists">{artists.map((a, i) => <span key={i}>{i > 0 && ', '}{a.id ? <Link className="ul" href={`/artist/${a.id}`}>{a.name}</Link> : a.name}</span>)}</div>}
        <div className="muted small">{[meta, tracks.length ? `${tracks.length} 曲` : '', total ? fmt(total) : ''].filter(Boolean).join(' • ')}</div>
        {description && <p className={`coll-desc ${more ? 'open' : ''}`} onClick={() => setMore(!more)}>{description}</p>}
        <div className="coll-actions">
          <button className="btn filled lg" disabled={!tracks.length} onClick={() => playList(tracks, 0, ctx)}><Icon n="play_arrow" fill />再生</button>
          <button className="icon-btn tonal big-ib" disabled={!tracks.length} onClick={() => playList(tracks, 0, ctx, { shuffle: true })} aria-label="シャッフル"><Icon n="shuffle" /></button>
          {onSave && <button className={`icon-btn ${saved ? 'filled' : 'tonal'} big-ib`} onClick={onSave} aria-label="ライブラリに保存"><Icon n={saved ? 'library_add_check' : 'library_add'} /></button>}
          <button className="icon-btn tonal big-ib" aria-label="その他" onClick={(e) => {
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            menu({ x: r.right, y: r.bottom, items: [
              { icon: 'playlist_play', label: '次に再生', fn: () => playNext(tracks) },
              { icon: 'queue_music', label: 'キューに追加', fn: () => addToQueue(tracks) },
              { icon: 'playlist_add', label: 'プレイリストに保存', fn: () => window.dispatchEvent(new CustomEvent('m3:save', { detail: tracks })) },
              ...(extraMenu || []),
            ] });
          }}><Icon n="more_vert" /></button>
          {children}
        </div>
      </div>
    </div>
  );
}

export function TrackList({ tracks, ctx, numbered, extraMenu }: { tracks: Item[]; ctx: any; numbered?: boolean; extraMenu?: (it: Item) => MenuItem[] }) {
  return (
    <div className="list tracklist">
      {tracks.map((t, i) => <SongRow key={t.id + i} it={t} list={tracks} index={i} ctx={ctx} num={numbered ? i + 1 : undefined} showArt={!numbered} plays extraMenu={extraMenu?.(t)} />)}
    </div>
  );
}
