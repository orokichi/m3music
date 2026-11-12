'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { fmt, useApi } from '@/lib/api';
import * as P from '@/lib/player';
import { actions, useStore } from '@/lib/store';
import type { Section } from '@/lib/types';
import { Art, Artists, Shelf, SongRow, useItemMenu } from './cards';
import Lyrics from './Lyrics';
import { Icon, Loader, useMenu } from './ui';

/** M3 Expressive wavy seek slider. */
export function Seek({ compact }: { compact?: boolean }) {
  const time = P.usePlayer((p) => p.time);
  const dur = P.usePlayer((p) => p.duration);
  const playing = P.usePlayer((p) => p.playing);
  const [drag, setDrag] = useState<number | null>(null);
  const bar = useRef<HTMLDivElement>(null);
  const pct = dur ? ((drag ?? time) / dur) * 100 : 0;
  const posFrom = (x: number) => { const r = bar.current!.getBoundingClientRect(); return Math.max(0, Math.min(1, (x - r.left) / r.width)) * dur; };
  const down = (e: React.PointerEvent) => {
    if (!dur) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDrag(posFrom(e.clientX));
  };
  const moveP = (e: React.PointerEvent) => { if (drag != null) setDrag(posFrom(e.clientX)); };
  const up = () => { if (drag != null) { P.seek(drag); setDrag(null); } };
  return (
    <div className={`seek ${compact ? 'compact' : ''}`}>
      <div className={`seek-bar ${playing && !compact ? 'playing' : ''} ${drag != null ? 'drag' : ''}`} ref={bar} onPointerDown={down} onPointerMove={moveP} onPointerUp={up} onPointerCancel={up}
        role="slider" aria-label="再生位置" aria-valuemin={0} aria-valuemax={Math.round(dur)} aria-valuenow={Math.round(time)} tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'ArrowRight') P.seek(time + 5); if (e.key === 'ArrowLeft') P.seek(Math.max(0, time - 5)); }}>
        <div className="seek-played" style={{ width: `calc(${pct}% - 4px)` }} />
        <div className="seek-handle" style={{ left: `${pct}%` }} />
        <div className="seek-rest" style={{ left: `calc(${pct}% + 6px)` }} />
      </div>
      {!compact && <div className="seek-t"><span>{fmt(drag ?? time)}</span><span>{fmt(dur)}</span></div>}
    </div>
  );
}

export function PlayBtn({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const playing = P.usePlayer((p) => p.playing);
  const buffering = P.usePlayer((p) => p.buffering);
  return (
    <button className={`play-btn ${size} ${playing ? 'on' : ''}`} onClick={(e) => { e.stopPropagation(); P.toggle(); }} aria-label={playing ? '一時停止' : '再生'}>
      {buffering && <span className="spin" />}
      <Icon n={playing ? 'pause' : 'play_arrow'} fill size={size === 'lg' ? 40 : size === 'md' ? 30 : 26} />
    </button>
  );
}

function SleepBtn() {
  const menu = useMenu();
  const sleepAt = P.usePlayer((p) => p.sleepAt);
  const [, force] = useState(0);
  useEffect(() => { if (!sleepAt) return; const t = setInterval(() => force((x) => x + 1), 15000); return () => clearInterval(t); }, [sleepAt]);
  return (
    <button className={`icon-btn ${sleepAt ? 'sel' : ''}`} title="スリープタイマー" aria-label="スリープタイマー" onClick={(e) => {
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      menu({ x: r.right, y: r.bottom, items: [
        ...[5, 15, 30, 45, 60, 90].map((m) => ({ icon: 'bedtime', label: `${m}分`, fn: () => P.setSleep(m) })),
        ...(sleepAt ? [{ icon: 'close', label: `タイマー解除（残り${Math.ceil((sleepAt - Date.now()) / 60000)}分）`, fn: () => P.setSleep(null) }] : []),
      ] });
    }}><Icon n="bedtime" /></button>
  );
}

function Volume() {
  const vol = P.usePlayer((p) => p.volume);
  const muted = P.usePlayer((p) => p.muted);
  return (
    <div className="vol">
      <button className="icon-btn" onClick={P.toggleMute} aria-label="ミュート"><Icon n={muted || vol === 0 ? 'volume_off' : vol < 50 ? 'volume_down' : 'volume_up'} /></button>
      <input type="range" min={0} max={100} value={muted ? 0 : vol} onChange={(e) => P.setVolume(Number(e.target.value))} aria-label="音量" style={{ ['--v' as any]: `${muted ? 0 : vol}%` }} />
    </div>
  );
}

export function Controls({ big }: { big?: boolean }) {
  const shuffle = P.usePlayer((p) => p.shuffle);
  const repeat = P.usePlayer((p) => p.repeat);
  return (
    <div className={`controls ${big ? 'big' : ''}`}>
      <button className={`icon-btn ${shuffle ? 'sel' : ''}`} onClick={P.toggleShuffle} aria-label="シャッフル"><Icon n="shuffle" /></button>
      <button className="icon-btn skip" onClick={P.prev} aria-label="前の曲"><Icon n="skip_previous" fill size={big ? 34 : 28} /></button>
      <PlayBtn size={big ? 'lg' : 'md'} />
      <button className="icon-btn skip" onClick={() => P.next()} aria-label="次の曲"><Icon n="skip_next" fill size={big ? 34 : 28} /></button>
      <button className={`icon-btn ${repeat !== 'off' ? 'sel' : ''}`} onClick={P.cycleRepeat} aria-label="リピート"><Icon n={repeat === 'one' ? 'repeat_one' : 'repeat'} /></button>
    </div>
  );
}

function Queue() {
  const queue = P.usePlayer((p) => p.queue);
  const index = P.usePlayer((p) => p.index);
  const ctx = P.usePlayer((p) => p.ctx);
  const loading = P.usePlayer((p) => p.radioLoading);
  const radioAuto = useStore((s) => s.settings.radioAuto);
  const [dragI, setDragI] = useState<number | null>(null);
  const [overI, setOverI] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current?.querySelector('.qrow.cur') as HTMLElement | null;
    if (el && ref.current) ref.current.scrollTo({ top: el.offsetTop - 60, behavior: 'smooth' });
  }, [index]);
  return (
    <div className="queue" ref={ref}>
      <div className="q-head">
        <div style={{ minWidth: 0 }}><div className="muted small">再生元</div><b className="clamp1">{ctx?.title || 'キュー'}</b></div>
        <span className="spacer" />
        <button className={`chip sl ${radioAuto ? 'on' : ''}`} onClick={() => actions.setSettings({ radioAuto: !radioAuto })}><Icon n="all_inclusive" size={18} />自動再生</button>
        <button className="icon-btn" onClick={P.clearQueue} title="キューをクリア" aria-label="キューをクリア"><Icon n="clear_all" /></button>
      </div>
      {queue.map((it, i) => (
        <div key={it.id + i} className={`qrow ${i === index ? 'cur' : ''} ${overI === i ? 'over' : ''} ${i < index ? 'past' : ''}`}
          draggable onDragStart={() => setDragI(i)} onDragOver={(e) => { e.preventDefault(); setOverI(i); }} onDragEnd={() => { setDragI(null); setOverI(null); }}
          onDrop={() => { if (dragI != null) P.move(dragI, i); setDragI(null); setOverI(null); }}>
          <span className="drag"><Icon n="drag_indicator" size={20} /></span>
          <SongRow it={it} showArt onPlay={() => P.playAt(i)} extraMenu={i !== index ? [{ icon: 'remove_circle', label: 'キューから削除', fn: () => P.removeAt(i) }] : []} />
        </div>
      ))}
      {loading && <Loader small />}
    </div>
  );
}

function Related({ id }: { id: string }) {
  const { data, loading, error } = useApi<{ sections: Section[] }>({ fn: 'related', id });
  if (loading) return <Loader />;
  if (error || !data?.sections.length) return <div className="empty">関連コンテンツはありません</div>;
  return <div className="related">{data.sections.map((s, i) => <Shelf key={i} sec={s} />)}</div>;
}

export function MiniPlayer() {
  const cur = P.usePlayer((p) => p.queue[p.index]);
  const liked = useStore((s) => (cur ? s.liked.some((x) => x.id === cur.id) : false));
  const time = P.usePlayer((p) => p.time);
  const dur = P.usePlayer((p) => p.duration);
  const expanded = P.usePlayer((p) => p.expanded);
  const openMenu = useItemMenu();
  if (!cur) return null;
  return (
    <div className={`mini ${expanded ? 'hidden' : ''}`} onClick={() => P.setExpanded(true)}>
      <div className="mini-progress" onClick={(e) => e.stopPropagation()}><Seek compact /></div>
      <div className="mini-left">
        <button className="icon-btn d-only" onClick={(e) => { e.stopPropagation(); P.prev(); }} aria-label="前の曲"><Icon n="skip_previous" fill /></button>
        <PlayBtn size="sm" />
        <button className="icon-btn" onClick={(e) => { e.stopPropagation(); P.next(); }} aria-label="次の曲"><Icon n="skip_next" fill /></button>
        <span className="mini-time d-only">{fmt(time)} / {fmt(dur)}</span>
      </div>
      <div className="mini-mid">
        <Art src={cur.thumb} className="mini-art" />
        <div className="mini-txt">
          <div className="t">{cur.title}</div>
          <div className="s" onClick={(e) => e.stopPropagation()}><Artists item={cur} />{cur.album?.name && <span className="d-only"> • {cur.album.name}</span>}</div>
        </div>
        <button className={`icon-btn like ${liked ? 'on' : ''}`} onClick={(e) => { e.stopPropagation(); actions.toggleLike(cur); }} aria-label="高く評価"><Icon n="thumb_up" fill={liked} /></button>
        <button className="icon-btn d-only" onClick={(e) => openMenu(e, cur)} aria-label="その他"><Icon n="more_vert" /></button>
      </div>
      <div className="mini-right d-only" onClick={(e) => e.stopPropagation()}>
        <Volume />
        <Controls />
        <button className="icon-btn" onClick={() => P.setExpanded(true)} aria-label="開く"><Icon n="expand_less" /></button>
      </div>
    </div>
  );
}

export function NowPlaying() {
  const expanded = P.usePlayer((p) => p.expanded);
  const cur = P.usePlayer((p) => p.queue[p.index]);
  const videoMode = P.usePlayer((p) => p.videoMode);
  const liked = useStore((s) => (cur ? s.liked.some((x) => x.id === cur.id) : false));
  const [tab, setTab] = useState<'queue' | 'lyrics' | 'related'>('queue');
  const [mTab, setMTab] = useState(false);
  const openMenu = useItemMenu();
  const stage = useRef<HTMLDivElement>(null);
  const touch = useRef<number | null>(null);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') P.setExpanded(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  // position the (always mounted) video host over the stage when in video mode
  useEffect(() => {
    const host = document.getElementById('yt-host');
    if (!host) return;
    let raf = 0;
    const place = () => {
      const el = stage.current;
      if (expanded && videoMode && el) {
        const r = el.getBoundingClientRect();
        Object.assign(host.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', opacity: '1', zIndex: '62', pointerEvents: 'none', borderRadius: '28px' });
      } else Object.assign(host.style, { left: '0px', top: '0px', width: '200px', height: '200px', opacity: '1', zIndex: '-1', pointerEvents: 'none' });
      raf = requestAnimationFrame(place);
    };
    place();
    return () => cancelAnimationFrame(raf);
  }, [expanded, videoMode]);

  if (!cur) return null;
  return (
    <div className={`np ${expanded ? 'open' : ''}`} aria-hidden={!expanded}
      onTouchStart={(e) => (touch.current = e.touches[0].clientY)}
      onTouchEnd={(e) => { if (touch.current != null && e.changedTouches[0].clientY - touch.current > 120 && (e.target as HTMLElement).closest('.np-stage-col')) P.setExpanded(false); touch.current = null; }}>
      <div className="np-bg" style={{ backgroundImage: cur.thumb ? `url("${cur.thumb}")` : undefined }} />
      <div className="np-top">
        <button className="icon-btn" onClick={() => P.setExpanded(false)} aria-label="閉じる"><Icon n="keyboard_arrow_down" size={30} /></button>
        <div className="bgroup np-toggle">
          <button className={`btn sm ${!videoMode ? 'on' : ''}`} onClick={() => P.setVideoMode(false)}>曲</button>
          <button className={`btn sm ${videoMode ? 'on' : ''}`} onClick={() => P.setVideoMode(true)}>動画</button>
        </div>
        <button className="icon-btn" onClick={(e) => openMenu(e, cur)} aria-label="その他"><Icon n="more_vert" /></button>
      </div>
      <div className="np-body">
        <div className="np-stage-col">
          <div className={`np-stage ${videoMode ? 'video' : ''}`} ref={stage}>
            {!videoMode && <Art src={cur.thumb?.replace(/=w\d+-h\d+/, '=w1200-h1200')} className="np-art" />}
          </div>
          <div className="np-meta">
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="np-title">{cur.title}</div>
              <div className="np-artist"><Artists item={cur} /></div>
            </div>
            <button className={`icon-btn like ${liked ? 'on' : ''}`} onClick={() => actions.toggleLike(cur)} aria-label="高く評価"><Icon n="thumb_up" fill={liked} /></button>
          </div>
          <Seek />
          <Controls big />
          <div className="np-extra">
            <Volume />
            <SleepBtn />
            <button className="icon-btn m-only" onClick={() => { setMTab(true); setTab('queue'); }} aria-label="次の曲"><Icon n="queue_music" /></button>
            <button className="icon-btn m-only" onClick={() => { setMTab(true); setTab('lyrics'); }} aria-label="歌詞"><Icon n="lyrics" /></button>
          </div>
        </div>
        <div className={`np-side ${mTab ? 'm-open' : ''}`}>
          <div className="np-tabs">
            <button className="icon-btn m-only" onClick={() => setMTab(false)} aria-label="閉じる"><Icon n="keyboard_arrow_down" /></button>
            {([['queue', '次の曲'], ['lyrics', '歌詞'], ['related', '関連']] as const).map(([k, l]) => (
              <button key={k} className={`np-tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{l}</button>
            ))}
          </div>
          <div className="np-pane">
            {tab === 'queue' && <Queue />}
            {tab === 'lyrics' && <Lyrics item={cur} big />}
            {tab === 'related' && <Related id={cur.id} />}
          </div>
          {cur.album?.id && tab !== 'related' && <Link className="np-album-link d-only" href={`/album/${cur.album.id}`} onClick={() => P.setExpanded(false)}><Icon n="album" size={18} />{cur.album.name}</Link>}
        </div>
      </div>
    </div>
  );
}
