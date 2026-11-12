'use client';
import { useSyncExternalStore } from 'react';
import type { Item } from './types';

export type LocalPlaylist = { id: string; name: string; items: Item[]; created: number };
export type Settings = {
  theme: 'system' | 'light' | 'dark';
  seed: string;
  dynamicColor: boolean;
  syncedLyrics: boolean;
  radioAuto: boolean;
  aiProvider: 'openrouter' | 'groq';
  aiKey: string;
  aiModel: string;
};
type State = {
  liked: Item[];
  history: (Item & { at: number })[];
  albums: Item[];
  playlists: Item[];
  artists: Item[];
  local: LocalPlaylist[];
  searches: string[];
  settings: Settings;
};
export const DEFAULT_SETTINGS: Settings = { theme: 'system', seed: '#d0103a', dynamicColor: true, syncedLyrics: true, radioAuto: true, aiProvider: 'openrouter', aiKey: '', aiModel: '' };
const KEY = 'm3music:v1';
const empty: State = { liked: [], history: [], albums: [], playlists: [], artists: [], local: [], searches: [], settings: DEFAULT_SETTINGS };
let state: State = empty;
let loaded = false;
const ls = new Set<() => void>();
function load() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try { const raw = localStorage.getItem(KEY); if (raw) { const p = JSON.parse(raw); state = { ...empty, ...p, settings: { ...DEFAULT_SETTINGS, ...(p.settings || {}) } }; } } catch {}
}
let t: any;
function set(fn: (s: State) => State) {
  load();
  state = fn(state);
  ls.forEach((l) => l());
  clearTimeout(t);
  t = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} }, 200);
}
export function getState() { load(); return state; }
export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore((l) => { ls.add(l); return () => ls.delete(l); }, () => sel(getState()), () => sel(empty));
}
const slim = (i: Item): Item => ({ kind: i.kind, id: i.id, title: i.title, subtitle: i.subtitle, artists: i.artists, album: i.album, thumb: i.thumb, duration: i.duration, sec: i.sec, playlistId: i.playlistId });
const toggleIn = (arr: Item[], i: Item) => (arr.some((x) => x.id === i.id) ? arr.filter((x) => x.id !== i.id) : [slim(i), ...arr]);
export const actions = {
  toggleLike: (i: Item) => set((s) => ({ ...s, liked: toggleIn(s.liked, i) })),
  toggleAlbum: (i: Item) => set((s) => ({ ...s, albums: toggleIn(s.albums, i) })),
  togglePlaylist: (i: Item) => set((s) => ({ ...s, playlists: toggleIn(s.playlists, i) })),
  toggleArtist: (i: Item) => set((s) => ({ ...s, artists: toggleIn(s.artists, i) })),
  addHistory: (i: Item) => set((s) => ({ ...s, history: [{ ...slim(i), at: Date.now() }, ...s.history.filter((x) => x.id !== i.id)].slice(0, 300) })),
  clearHistory: () => set((s) => ({ ...s, history: [] })),
  addSearch: (q: string) => set((s) => ({ ...s, searches: [q, ...s.searches.filter((x) => x !== q)].slice(0, 30) })),
  removeSearch: (q: string) => set((s) => ({ ...s, searches: s.searches.filter((x) => x !== q) })),
  createLocal: (name: string, items: Item[] = []) => { const id = 'local-' + Date.now().toString(36); set((s) => ({ ...s, local: [{ id, name, items: items.map(slim), created: Date.now() }, ...s.local] })); return id; },
  addToLocal: (id: string, items: Item[]) => set((s) => ({ ...s, local: s.local.map((p) => (p.id === id ? { ...p, items: [...p.items, ...items.map(slim).filter((x) => !p.items.some((y) => y.id === x.id))] } : p)) })),
  removeFromLocal: (id: string, vid: string) => set((s) => ({ ...s, local: s.local.map((p) => (p.id === id ? { ...p, items: p.items.filter((x) => x.id !== vid) } : p)) })),
  renameLocal: (id: string, name: string) => set((s) => ({ ...s, local: s.local.map((p) => (p.id === id ? { ...p, name } : p)) })),
  deleteLocal: (id: string) => set((s) => ({ ...s, local: s.local.filter((p) => p.id !== id) })),
  setSettings: (p: Partial<Settings>) => set((s) => ({ ...s, settings: { ...s.settings, ...p } })),
  exportData: () => { const s = getState(); return JSON.stringify({ ...s, settings: { ...s.settings, aiKey: '' } }, null, 2); },
  importData: (txt: string) => { const p = JSON.parse(txt); set(() => ({ ...empty, ...p, settings: { ...DEFAULT_SETTINGS, ...(p.settings || {}), aiKey: getState().settings.aiKey } })); },
};
