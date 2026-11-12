'use client';
import { useSyncExternalStore } from 'react';
import type { Item } from './types';
import { api } from './api';
import { actions as lib, getState } from './store';

declare global { interface Window { YT: any; onYouTubeIframeAPIReady?: () => void } }

export type Repeat = 'off' | 'all' | 'one';
export type Ctx = { type: string; id?: string; title?: string } | null;
type PState = {
  queue: Item[];
  index: number;
  playing: boolean;
  buffering: boolean;
  time: number;
  duration: number;
  shuffle: boolean;
  repeat: Repeat;
  volume: number;
  muted: boolean;
  ctx: Ctx;
  expanded: boolean;
  videoMode: boolean;
  sleepAt: number | null;
  error: string | null;
  radioLoading: boolean;
};
const P_KEY = 'm3music:player';
let s: PState = { queue: [], index: -1, playing: false, buffering: false, time: 0, duration: 0, shuffle: false, repeat: 'off', volume: 100, muted: false, ctx: null, expanded: false, videoMode: false, sleepAt: null, error: null, radioLoading: false };
const ls = new Set<() => void>();
let restored = false;
function restore() {
  if (restored || typeof window === 'undefined') return;
  restored = true;
  try { const p = JSON.parse(localStorage.getItem(P_KEY) || 'null'); if (p) s = { ...s, queue: p.queue || [], index: p.index ?? -1, time: p.time || 0, shuffle: !!p.shuffle, repeat: p.repeat || 'off', volume: p.volume ?? 100, ctx: p.ctx || null }; } catch {}
}
let saveT: any;
function emit(patch: Partial<PState>) {
  s = { ...s, ...patch };
  ls.forEach((l) => l());
  clearTimeout(saveT);
  saveT = setTimeout(() => { try { localStorage.setItem(P_KEY, JSON.stringify({ queue: s.queue.slice(0, 300), index: s.index, time: s.time, shuffle: s.shuffle, repeat: s.repeat, volume: s.volume, ctx: s.ctx })); } catch {} }, 800);
}
export const getP = () => { restore(); return s; };
export function usePlayer<T>(sel: (p: PState) => T): T {
  return useSyncExternalStore((l) => { ls.add(l); return () => ls.delete(l); }, () => sel(getP()), () => sel(s));
}
export const current = () => getP().queue[getP().index];

// ---------------- YouTube IFrame engine ----------------
let yt: any = null;
let ready = false;
let loadedId: string | null = null;
let pendingAutoplay = false;
let apiP: Promise<any> | null = null;
function loadApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiP) return apiP;
  apiP = new Promise((res) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); res(window.YT); };
    const sc = document.createElement('script');
    sc.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(sc);
  });
  return apiP;
}

let tick: any;
let snackFn: (m: string) => void = () => {};
export function setSnack(fn: (m: string) => void) { snackFn = fn; }

export function mountEngine(host: HTMLElement) {
  restore();
  if (yt) return;
  const f = document.createElement('iframe');
  const cur = current();
  const q = new URLSearchParams({ enablejsapi: '1', autoplay: '0', controls: '0', rel: '0', playsinline: '1', iv_load_policy: '3', disablekb: '1', fs: '0', modestbranding: '1', origin: location.origin, hl: 'ja' });
  f.src = `https://www.youtube-nocookie.com/embed/${cur?.id || ''}?${q}`;
  f.allow = 'autoplay; encrypted-media; picture-in-picture';
  f.referrerPolicy = 'strict-origin-when-cross-origin';
  f.title = 'player';
  f.style.cssText = 'width:100%;height:100%;border:0;display:block';
  host.appendChild(f);
  loadedId = cur?.id || null;
  loadApi().then((YT) => {
    yt = new YT.Player(f, {
      events: {
        onReady: () => {
          ready = true;
          yt.setVolume(s.volume);
          if (s.muted) yt.mute();
          if (cur && s.time > 3) yt.cueVideoById({ videoId: cur.id, startSeconds: Math.floor(s.time) });
          if (pendingAutoplay) { const c = current(); if (c) load(c, true); }
        },
        onStateChange: (e: any) => {
          const st = e.data;
          if (st === 1) { emit({ playing: true, buffering: false, error: null }); }
          else if (st === 2) emit({ playing: false, buffering: false });
          else if (st === 3) emit({ buffering: true });
          else if (st === 0) onEnded();
          updateMediaState();
        },
        onError: (e: any) => {
          const c = Number(e.data);
          const msg = c === 101 || c === 150 ? 'この曲は外部再生が許可されていないため、スキップしました' : c === 100 ? '曲が見つからないため、スキップしました' : `再生エラー (${c})。スキップしました`;
          snackFn(msg);
          emit({ error: msg });
          setTimeout(() => next(true), 600);
        },
      },
    });
    clearInterval(tick);
    tick = setInterval(() => {
      if (!ready || !yt?.getCurrentTime) return;
      const t = yt.getCurrentTime() || 0;
      const d = yt.getDuration() || current()?.sec || 0;
      if (Math.abs(t - s.time) > 0.2 || d !== s.duration) emit({ time: t, duration: d });
      if (s.sleepAt && Date.now() >= s.sleepAt) { yt.pauseVideo(); emit({ sleepAt: null }); snackFn('スリープタイマーで停止しました'); }
      if ('mediaSession' in navigator && d) { try { navigator.mediaSession.setPositionState({ duration: d, position: Math.min(t, d), playbackRate: 1 }); } catch {} }
    }, 250);
  });
}

function load(item: Item, autoplay = true) {
  emit({ time: 0, duration: item.sec || 0, error: null });
  lib.addHistory(item);
  setMedia(item);
  if (!ready) { pendingAutoplay = autoplay; return; }
  pendingAutoplay = false;
  loadedId = item.id;
  if (autoplay) yt.loadVideoById({ videoId: item.id });
  else yt.cueVideoById({ videoId: item.id });
  maybeExtend();
}

function onEnded() {
  if (s.repeat === 'one') { yt.seekTo(0, true); yt.playVideo(); return; }
  next(true);
}

// ---------------- queue actions ----------------
function shuffled<T>(a: T[]) { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

export function playList(items: Item[], start = 0, ctx: Ctx = null, opts: { shuffle?: boolean } = {}) {
  restore();
  const tracks = items.filter((i) => i.kind === 'song' || i.kind === 'video' || i.kind === 'episode');
  if (!tracks.length) return;
  let q = tracks;
  let idx = Math.max(0, Math.min(start, tracks.length - 1));
  if (opts.shuffle) { const first = opts.shuffle && start === 0 ? undefined : tracks[idx]; q = shuffled(tracks); if (first) { q = [first, ...q.filter((x) => x !== first)]; } idx = 0; }
  emit({ queue: q, index: idx, ctx, shuffle: !!opts.shuffle });
  load(q[idx]);
}

/** Play a single track and fill the queue with its radio. */
export async function playRadio(item: Item, ctx?: Ctx) {
  restore();
  emit({ queue: [item], index: 0, ctx: ctx || { type: 'radio', title: `ラジオ: ${item.title}` } });
  load(item);
  emit({ radioLoading: true });
  try {
    const r = await api<{ items: Item[] }>({ fn: 'upnext', id: item.id, list: item.playlistId });
    const rest = r.items.filter((x) => x.id !== item.id);
    if (current()?.id === item.id) emit({ queue: [s.queue[0], ...rest] });
  } catch {}
  emit({ radioLoading: false });
}

export function playAt(i: number) { if (i < 0 || i >= s.queue.length) return; emit({ index: i }); load(s.queue[i]); }
export function next(auto = false) {
  if (!s.queue.length) return;
  let i = s.index + 1;
  if (i >= s.queue.length) {
    if (s.repeat === 'all') i = 0;
    else { if (auto) { emit({ playing: false }); maybeExtend(true); } return; }
  }
  playAt(i);
}
export function prev() {
  if (ready && yt.getCurrentTime() > 4) { yt.seekTo(0, true); return; }
  if (s.index > 0) playAt(s.index - 1);
  else if (ready) yt.seekTo(0, true);
}
export function toggle() {
  if (!ready) { const c = current(); if (c) load(c); return; }
  if (loadedId !== current()?.id) { const c = current(); if (c) load(c); return; }
  const st = yt.getPlayerState();
  if (st === 1 || st === 3) yt.pauseVideo();
  else if (st === 5 || st === -1) { yt.playVideo(); }
  else yt.playVideo();
}
export function play() { if (ready) yt.playVideo(); }
export function pause() { if (ready) yt.pauseVideo(); }
export function seek(t: number) { if (!ready) return; yt.seekTo(t, true); emit({ time: t }); }
export function setVolume(v: number) { v = Math.max(0, Math.min(100, Math.round(v))); if (ready) { yt.setVolume(v); if (v > 0) yt.unMute(); } emit({ volume: v, muted: v === 0 }); }
export function toggleMute() { if (!ready) return; if (s.muted) { yt.unMute(); emit({ muted: false }); } else { yt.mute(); emit({ muted: true }); } }
export function toggleShuffle() {
  if (!s.shuffle) {
    const cur = s.queue[s.index];
    const rest = shuffled(s.queue.filter((_, i) => i !== s.index));
    emit({ shuffle: true, queue: cur ? [cur, ...rest] : rest, index: 0 });
  } else emit({ shuffle: false });
}
export function cycleRepeat() { emit({ repeat: s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off' }); }
export function playNext(items: Item[]) {
  const t = items.filter((i) => i.kind === 'song' || i.kind === 'video' || i.kind === 'episode');
  if (!s.queue.length) return playList(t);
  const q = [...s.queue];
  q.splice(s.index + 1, 0, ...t);
  emit({ queue: q });
  snackFn(t.length > 1 ? `${t.length}曲を次に再生します` : '次に再生します');
}
export function addToQueue(items: Item[]) {
  const t = items.filter((i) => i.kind === 'song' || i.kind === 'video' || i.kind === 'episode');
  if (!s.queue.length) return playList(t);
  emit({ queue: [...s.queue, ...t] });
  snackFn(t.length > 1 ? `${t.length}曲をキューに追加しました` : 'キューに追加しました');
}
export function removeAt(i: number) {
  if (i === s.index) return;
  const q = s.queue.filter((_, j) => j !== i);
  emit({ queue: q, index: i < s.index ? s.index - 1 : s.index });
}
export function move(from: number, to: number) {
  if (from === to) return;
  const q = [...s.queue];
  const [x] = q.splice(from, 1);
  q.splice(to, 0, x);
  let idx = s.index;
  if (from === s.index) idx = to;
  else if (from < s.index && to >= s.index) idx--;
  else if (from > s.index && to <= s.index) idx++;
  emit({ queue: q, index: idx });
}
export function clearQueue() { const c = current(); emit({ queue: c ? [c] : [], index: c ? 0 : -1 }); }
export function setExpanded(v: boolean) { emit({ expanded: v }); }
export function setVideoMode(v: boolean) { emit({ videoMode: v }); }
export function setSleep(min: number | null) { emit({ sleepAt: min ? Date.now() + min * 60000 : null }); if (min) snackFn(`${min}分後に停止します`); }

let extending = false;
async function maybeExtend(force = false) {
  if (extending || !getState().settings.radioAuto || s.repeat !== 'off') return;
  if (!force && s.queue.length - s.index > 3) return;
  const last = s.queue[s.queue.length - 1];
  if (!last) return;
  extending = true;
  try {
    const r = await api<{ items: Item[] }>({ fn: 'upnext', id: last.id });
    const have = new Set(s.queue.map((x) => x.id));
    const add = r.items.filter((x) => !have.has(x.id)).slice(0, 25);
    if (add.length) { emit({ queue: [...s.queue, ...add] }); if (force && !s.playing) next(); }
  } catch {}
  extending = false;
}

// ---------------- Media Session ----------------
function setMedia(item: Item) {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: item.title,
      artist: item.artists?.map((a) => a.name).join(', ') || item.subtitle || '',
      album: item.album?.name || '',
      artwork: item.thumb ? [{ src: item.thumb, sizes: '544x544', type: 'image/jpeg' }] : [],
    });
    const ms = navigator.mediaSession;
    ms.setActionHandler('play', () => play());
    ms.setActionHandler('pause', () => pause());
    ms.setActionHandler('nexttrack', () => next());
    ms.setActionHandler('previoustrack', () => prev());
    ms.setActionHandler('seekto', (d: any) => d.seekTime != null && seek(d.seekTime));
    ms.setActionHandler('seekbackward', () => seek(Math.max(0, s.time - 10)));
    ms.setActionHandler('seekforward', () => seek(s.time + 10));
  } catch {}
  document.title = `${item.title} - M3 Music`;
}
function updateMediaState() { if ('mediaSession' in navigator) navigator.mediaSession.playbackState = s.playing ? 'playing' : 'paused'; }
