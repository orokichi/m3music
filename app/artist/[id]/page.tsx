'use client';
import { use, useState } from 'react';
import { useApi } from '@/lib/api';
import type { Section, Item } from '@/lib/types';
import { Shelf, SongRow, playItem } from '@/components/cards';
import { Icon, Loader } from '@/components/ui';
import { actions, useStore } from '@/lib/store';
import { playList, playRadio } from '@/lib/player';
import { api } from '@/lib/api';

type A = { id: string; name: string; description: string; subscribers: string; thumb: string; shufflePlaylist?: string; radioPlaylist?: string; sections: Section[] };
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, loading, error } = useApi<A>({ fn: 'artist', id });
  const subbed = useStore((s) => s.artists.some((x) => x.id === id));
  const [more, setMore] = useState(false);
  if (loading) return <Loader />;
  if (error || !data) return <div className="empty"><div className="big"><Icon n="error" /></div>{error}</div>;
  const top = data.sections.find((s) => s.layout === 'list');
  const songs = top?.items || [];
  const ctx = { type: 'artist', id, title: data.name };
  const item: Item = { kind: 'artist', id, title: data.name, thumb: data.thumb, subtitle: data.subscribers };
  const shuffle = async () => {
    if (data.shufflePlaylist) { try { const p = await api<any>({ fn: 'playlist', id: data.shufflePlaylist }); return playList(p.tracks, 0, ctx, { shuffle: true }); } catch {} }
    playList(songs, 0, ctx, { shuffle: true });
  };
  return (
    <div className="artist-page">
      <div className="artist-hero" style={{ backgroundImage: data.thumb ? `url("${data.thumb}")` : undefined }}>
        <div className="artist-hero-in">
          <h1>{data.name}</h1>
          {data.description && <p className={`coll-desc ${more ? 'open' : ''}`} onClick={() => setMore(!more)}>{data.description}</p>}
          <div className="coll-actions">
            <button className="btn filled lg" onClick={shuffle}><Icon n="shuffle" />シャッフル</button>
            <button className="btn surface lg" onClick={() => songs[0] && playRadio(songs[0], { type: 'radio', title: `${data.name} ラジオ` })}><Icon n="radio" />ラジオ</button>
            <button className={`btn lg ${subbed ? 'surface' : 'inverse'}`} onClick={() => actions.toggleArtist(item)}>{subbed ? '登録済み' : '登録'}</button>
          </div>
        </div>
      </div>
      <div className="page">
        {top && (
          <section className="shelf">
            <div className="shelf-h"><h2>{top.title || '人気曲'}</h2><span className="spacer" />{top.more && <button className="btn outlined sm" onClick={() => playItem({ kind: 'playlist', id: top.more!.id.replace(/^VL/, ''), title: '' })}>すべて再生</button>}</div>
            <div className="list">{songs.map((it, i) => <SongRow key={it.id} it={it} list={songs} index={i} ctx={ctx} plays />)}</div>
          </section>
        )}
        {data.sections.filter((s) => s !== top).map((s, i) => <Shelf key={i} sec={s} />)}
      </div>
    </div>
  );
}
