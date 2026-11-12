'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import type { Item, Section } from '@/lib/types';
import { artistsText, hrefOf, isTrack } from '@/lib/types';
import { addToQueue, playList, playNext, playRadio, usePlayer } from '@/lib/player';
import { actions, getState, useStore } from '@/lib/store';
import { api } from '@/lib/api';
import { Icon, useMenu, useSnack, MenuItem } from './ui';

export function Art({ src, round, className = '', alt = '' }: { src?: string; round?: boolean; className?: string; alt?: string }) {
  const [err, setErr] = useState(false);
  return (
    <div className={`art ${round ? 'round' : ''} ${className}`}>
      {src && !err ? <img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setErr(true)} /> : <Icon n="music_note" />}
    </div>
  );
}

export function Artists({ item, links = true }: { item: Item; links?: boolean }) {
  if (!item.artists?.length) return <>{item.subtitle}</>;
  return (
    <>
      {item.artists.map((a, i) => (
        <span key={i}>
          {i > 0 && ', '}
          {links && a.id ? <Link className="ul" href={`/artist/${a.id}`} onClick={(e) => e.stopPropagation()}>{a.name}</Link> : a.name}
        </span>
      ))}
    </>
  );
}

/** Play anything: track → radio, collection → fetch & play. */
export async function playItem(it: Item, opts: { shuffle?: boolean } = {}) {
  if (isTrack(it)) return playRadio(it);
  try {
    if (it.kind === 'album' || it.kind === 'single') {
      const a = await api<any>({ fn: 'album', id: it.id });
      playList(a.tracks, 0, { type: 'album', id: it.id, title: a.title }, opts);
    } else if (it.kind === 'playlist' || it.kind === 'podcast') {
      if (it.id.startsWith('local-') || it.id === 'LM') return playLocal(it.id, opts);
      const p = await api<any>({ fn: 'playlist', id: it.id });
      playList(p.tracks, 0, { type: 'playlist', id: it.id, title: p.title }, opts);
    } else if (it.kind === 'artist') {
      const a = await api<any>({ fn: 'artist', id: it.id });
      const top = a.sections.find((s: Section) => s.layout === 'list')?.items || [];
      if (top[0]) playRadio(top[0], { type: 'artist', id: it.id, title: a.name });
    }
  } catch {}
}
export function playLocal(id: string, opts: { shuffle?: boolean } = {}) {
  const st = getState();
  if (id === 'LM') return playList(st.liked, 0, { type: 'playlist', id: 'LM', title: '高く評価した曲' }, opts);
  const p = st.local.find((x) => x.id === id);
  if (p) playList(p.items, 0, { type: 'playlist', id, title: p.name }, opts);
}

export function useItemMenu() {
  const menu = useMenu();
  const snack = useSnack();
  const router = useRouter();
  return (e: React.MouseEvent, it: Item, extra: MenuItem[] = []) => {
    e.preventDefault();
    e.stopPropagation();
    const st = getState();
    const items: MenuItem[] = [];
    if (isTrack(it)) {
      items.push({ icon: 'radio', label: 'ラジオを開始', fn: () => playRadio(it) });
      items.push({ icon: 'playlist_play', label: '次に再生', fn: () => playNext([it]) });
      items.push({ icon: 'queue_music', label: 'キューに追加', fn: () => addToQueue([it]) });
      const liked = st.liked.some((x) => x.id === it.id);
      items.push({ icon: liked ? 'thumb_down' : 'thumb_up', label: liked ? '高評価を取り消す' : '高く評価', fn: () => { actions.toggleLike(it); snack({ msg: liked ? '高評価を取り消しました' : '高く評価した曲に追加しました' }); } });
      items.push({ icon: 'playlist_add', label: 'プレイリストに保存', fn: () => window.dispatchEvent(new CustomEvent('m3:save', { detail: [it] })) });
      if (it.album?.id) items.push({ icon: 'album', label: 'アルバムに移動', fn: () => router.push(`/album/${it.album!.id}`) });
      const a = it.artists?.find((x) => x.id);
      if (a) items.push({ icon: 'person', label: 'アーティストに移動', fn: () => router.push(`/artist/${a.id}`) });
    } else {
      items.push({ icon: 'shuffle', label: 'シャッフル再生', fn: () => playItem(it, { shuffle: true }) });
      if (it.kind === 'album' || it.kind === 'single') {
        const saved = st.albums.some((x) => x.id === it.id);
        items.push({ icon: saved ? 'library_add_check' : 'library_add', label: saved ? 'ライブラリから削除' : 'ライブラリに保存', fn: () => actions.toggleAlbum(it) });
      }
      if (it.kind === 'playlist' && !it.id.startsWith('local-')) {
        const saved = st.playlists.some((x) => x.id === it.id);
        items.push({ icon: saved ? 'library_add_check' : 'library_add', label: saved ? 'ライブラリから削除' : 'ライブラリに保存', fn: () => actions.togglePlaylist(it) });
      }
      if (it.kind === 'artist') {
        const sub = st.artists.some((x) => x.id === it.id);
        items.push({ icon: sub ? 'person_remove' : 'person_add', label: sub ? '登録を解除' : 'アーティストを登録', fn: () => actions.toggleArtist(it) });
      }
    }
    items.push({ icon: 'share', label: '共有', fn: () => { const url = isTrack(it) ? `https://music.youtube.com/watch?v=${it.id}` : location.origin + hrefOf(it); navigator.share?.({ title: it.title, url }).catch(() => {}) ?? navigator.clipboard.writeText(url).then(() => snack({ msg: 'リンクをコピーしました' })); } });
    menu({ x: e.clientX || (e.currentTarget as HTMLElement).getBoundingClientRect().right, y: e.clientY || (e.currentTarget as HTMLElement).getBoundingClientRect().bottom, items: [...extra, ...items] });
  };
}

function Equalizer() { return <span className="eq"><i /><i /><i /></span>; }

export function SongRow({ it, list, index, ctx, showArt = true, num, extraMenu, plays, onPlay }: { onPlay?: () => void; it: Item; list?: Item[]; index?: number; ctx?: { type: string; id?: string; title?: string }; showArt?: boolean; num?: number; extraMenu?: MenuItem[]; plays?: boolean }) {
  const curId = usePlayer((p) => p.queue[p.index]?.id);
  const playing = usePlayer((p) => p.playing);
  const liked = useStore((s) => s.liked.some((x) => x.id === it.id));
  const openMenu = useItemMenu();
  const isCur = curId === it.id;
  const router = useRouter();
  const onClick = () => {
    if (onPlay) return onPlay();
    if (!isTrack(it)) { const h = hrefOf(it); if (h) router.push(h); return; }
    if (list && index != null) playList(list, index, ctx || null);
    else playRadio(it);
  };
  return (
    <div className={`song sl ${isCur ? 'cur' : ''}`} onClick={onClick} onContextMenu={(e) => openMenu(e, it, extraMenu)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onClick()}>
      {num != null && <div className="num">{isCur ? <Equalizer /> : num}</div>}
      {showArt && (
        <div className="song-art">
          <Art src={it.thumb} round={it.kind === 'artist'} />
          <span className="ov">{isCur && playing ? <Equalizer /> : <Icon n="play_arrow" fill />}</span>
        </div>
      )}
      <div className="song-txt">
        <div className="t">{it.explicit && <span className="ex">E</span>}{it.title}</div>
        <div className="s">{it.kind === 'artist' ? it.subtitle : <><Artists item={it} />{it.album?.name && <> • {it.album.id ? <Link className="ul" href={`/album/${it.album.id}`} onClick={(e) => e.stopPropagation()}>{it.album.name}</Link> : it.album.name}</>}{plays && it.subtitle && /再生/.test(it.subtitle) && <> • {it.subtitle.split(' • ').find((x) => /再生/.test(x))}</>}</>}</div>
      </div>
      {isTrack(it) && <button className={`icon-btn like ${liked ? 'on' : ''}`} onClick={(e) => { e.stopPropagation(); actions.toggleLike(it); }} aria-label="高く評価"><Icon n="thumb_up" fill={liked} size={20} /></button>}
      {it.duration && <div className="dur">{it.duration}</div>}
      <button className="icon-btn more" onClick={(e) => openMenu(e, it, extraMenu)} aria-label="その他"><Icon n="more_vert" /></button>
    </div>
  );
}

export function Tile({ it, big }: { it: Item; big?: boolean }) {
  const openMenu = useItemMenu();
  const router = useRouter();
  const curId = usePlayer((p) => p.queue[p.index]?.id);
  const round = it.kind === 'artist';
  const video = it.kind === 'video';
  const href = hrefOf(it);
  const go = () => { if (href) router.push(href); else playItem(it); };
  return (
    <div className={`tile ${round ? 'round' : ''} ${video ? 'video' : ''} ${big ? 'big' : ''}`} onContextMenu={(e) => openMenu(e, it)}>
      <div className="tile-art sl" onClick={go}>
        <Art src={it.thumb} round={round} />
        {!round && (
          <button className="play-fab" aria-label="再生" onClick={(e) => { e.stopPropagation(); playItem(it); }}>
            <Icon n={curId === it.id ? 'graphic_eq' : 'play_arrow'} fill />
          </button>
        )}
        <button className="icon-btn tile-more" onClick={(e) => openMenu(e, it)} aria-label="その他"><Icon n="more_vert" /></button>
      </div>
      <div className="tile-t" onClick={go}>{it.title}</div>
      <div className="tile-s">{it.kind === 'album' || it.kind === 'single' || it.kind === 'playlist' || it.kind === 'artist' ? it.subtitle : <Artists item={it} />}</div>
    </div>
  );
}

export function MoodTile({ it }: { it: Item }) {
  return (
    <Link href={hrefOf(it)} className="mood sl" style={{ ['--c' as any]: it.color || 'var(--md-primary)' }}>
      <span>{it.title}</span>
    </Link>
  );
}

export function Shelf({ sec, ctx }: { sec: Section; ctx?: any }) {
  const row = useRef<HTMLDivElement>(null);
  const scroll = (d: number) => row.current?.scrollBy({ left: d * row.current.clientWidth * 0.85, behavior: 'smooth' });
  const tracks = sec.items.filter(isTrack);
  const isQuick = sec.layout === 'list' || (tracks.length === sec.items.length && sec.items.every((x) => x.kind === 'song') && sec.items.length > 8);
  const moods = sec.items.every((x) => x.kind === 'mood' && !x.thumb);
  const more = sec.more ? `/browse/${encodeURIComponent(sec.more.id)}${sec.more.params ? `?params=${encodeURIComponent(sec.more.params)}` : ''}` : null;
  return (
    <section className="shelf">
      <div className="shelf-h">
        <div style={{ minWidth: 0 }}>
          {sec.subtitle && <div className="strap">{sec.subtitle}</div>}
          <h2>{sec.title}</h2>
        </div>
        <span className="spacer" />
        {tracks.length > 1 && <button className="btn outlined sm" onClick={() => playList(tracks, 0, { type: 'shelf', title: sec.title })}>すべて再生</button>}
        {more && <Link className="btn outlined sm" href={more}>もっと見る</Link>}
        {!isQuick && (
          <>
            <button className="icon-btn outlined-ib" onClick={() => scroll(-1)} aria-label="前へ"><Icon n="chevron_left" /></button>
            <button className="icon-btn outlined-ib" onClick={() => scroll(1)} aria-label="次へ"><Icon n="chevron_right" /></button>
          </>
        )}
      </div>
      {moods ? (
        <div className="mood-grid">{sec.items.map((it, i) => <MoodTile key={i} it={it} />)}</div>
      ) : isQuick ? (
        <div className="quick" ref={row}>
          {sec.items.map((it, i) => <SongRow key={it.id + i} it={it} list={tracks} index={tracks.indexOf(it)} ctx={{ type: 'shelf', title: sec.title }} />)}
        </div>
      ) : (
        <div className="carousel" ref={row}>
          {sec.items.map((it, i) => <Tile key={it.id + i} it={it} />)}
        </div>
      )}
    </section>
  );
}
