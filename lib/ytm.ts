import 'server-only';
import { Innertube, Log, UniversalCache } from 'youtubei.js';

Log.setLevel(Log.Level.NONE);

let ytP: Promise<Innertube> | null = null;
let created = 0;
export function yt() {
  if (!ytP || Date.now() - created > 1000 * 60 * 60 * 3) {
    created = Date.now();
    ytP = Innertube.create({ retrieve_player: false, lang: 'ja', location: 'JP', cache: new UniversalCache(false) }).catch((e) => { ytP = null; throw e; });
  }
  return ytP;
}

export type Artist = { id?: string; name: string };
export type Item = {
  kind: 'song' | 'video' | 'album' | 'single' | 'artist' | 'playlist' | 'podcast' | 'episode' | 'mood';
  id: string;
  title: string;
  subtitle?: string;
  artists?: Artist[];
  album?: { id?: string; name: string };
  thumb?: string;
  duration?: string;
  sec?: number;
  playlistId?: string;
  params?: string;
  color?: string;
  explicit?: boolean;
};
export type Section = { title?: string; subtitle?: string; layout: 'list' | 'carousel'; items: Item[]; more?: { id: string; params?: string }; thumb?: string };

const J = (x: any) => JSON.parse(JSON.stringify(x ?? null));
const txt = (t: any): string => (t == null ? '' : typeof t === 'string' ? t : t.text ?? (t.runs ? t.runs.map((r: any) => r.text).join('') : ''));
const runs = (t: any): any[] => (t?.runs?.length ? t.runs : t?.text ? [{ text: t.text }] : []);
const pageType = (ep: any): string => ep?.payload?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType || '';
const vType = (ep: any): string => ep?.payload?.watchEndpointMusicSupportedConfigs?.watchEndpointMusicConfig?.musicVideoType || '';
const toSec = (s: string) => s.split(':').reduce((a, v) => a * 60 + Number(v), 0);

export function upThumb(url?: string, size = 544) {
  if (!url) return url;
  if (url.startsWith('//')) url = 'https:' + url;
  if (/googleusercontent\.com|ggpht\.com/.test(url)) return url.replace(/=w\d+-h\d+[^&?#]*/, `=w${size}-h${size}-l90-rj`).replace(/=s\d+[^&?#]*/, `=s${size}`);
  return url;
}
function bestThumb(n: any): string | undefined {
  let best: any = null;
  const seen = new Set<any>();
  const walk = (o: any, depth: number) => {
    if (!o || typeof o !== 'object' || depth > 6 || seen.has(o)) return;
    seen.add(o);
    if (Array.isArray(o)) {
      if (o.length && o[0] && typeof o[0].url === 'string') { for (const t of o) if (!best || (t.width || 0) > (best.width || 0)) best = t; return; }
      o.forEach((x) => walk(x, depth + 1));
      return;
    }
    if (typeof o.url === 'string' && /ytimg|googleusercontent|ggpht/.test(o.url)) { if (!best || (o.width || 0) > (best.width || 0)) best = o; return; }
    for (const k of ['thumbnail', 'thumbnails', 'contents', 'image', 'thumbnail_renderer', 'foreground_thumbnail', 'background', 'sources']) if (o[k]) walk(o[k], depth + 1);
  };
  walk(n, 0);
  return upThumb(best?.url);
}

function fromEndpoint(ep: any): Pick<Item, 'kind' | 'id' | 'playlistId' | 'params'> | null {
  const p = ep?.payload;
  if (!p) return null;
  if (p.videoId) {
    const vt = vType(ep);
    return { kind: vt === 'MUSIC_VIDEO_TYPE_ATV' ? 'song' : vt.includes('PODCAST') ? 'episode' : 'video', id: p.videoId, playlistId: p.playlistId };
  }
  if (p.browseId) {
    const pt = pageType(ep);
    if (pt.includes('ALBUM')) return { kind: 'album', id: p.browseId };
    if (pt.includes('ARTIST') || pt.includes('USER_CHANNEL')) return { kind: 'artist', id: p.browseId };
    if (pt.includes('PODCAST_SHOW')) return { kind: 'podcast', id: p.browseId };
    if (pt.includes('PLAYLIST')) return { kind: 'playlist', id: p.browseId.replace(/^VL/, '') };
    if (pt.includes('NON_MUSIC') || p.params) return { kind: 'mood', id: p.browseId, params: p.params };
    if (p.browseId.startsWith('MPRE')) return { kind: 'album', id: p.browseId };
    if (p.browseId.startsWith('UC')) return { kind: 'artist', id: p.browseId };
    if (p.browseId.startsWith('VL')) return { kind: 'playlist', id: p.browseId.slice(2) };
    return { kind: 'mood', id: p.browseId, params: p.params };
  }
  if (p.playlistId) return { kind: 'playlist', id: p.playlistId.replace(/^VL/, ''), playlistId: p.playlistId };
  return null;
}

function metaFromRuns(rs: any[], it: Item) {
  const artists: Artist[] = [];
  const plain: string[] = [];
  for (const r of rs) {
    const t = (r.text || '').trim();
    if (!t || t === '•' || t === '&' || t === ',' || t === '、') continue;
    const pt = pageType(r.endpoint);
    if (pt.includes('ARTIST') || pt.includes('USER_CHANNEL')) artists.push({ id: r.endpoint.payload.browseId, name: t });
    else if (pt.includes('ALBUM')) it.album = { id: r.endpoint.payload.browseId, name: t };
    else if (/^\d+:\d{2}(:\d{2})?$/.test(t)) { it.duration = t; it.sec = toSec(t); }
    else plain.push(t);
  }
  if (artists.length) it.artists = artists;
  return plain;
}

const KIND_WORDS: Record<string, Item['kind']> = { '曲': 'song', '動画': 'video', 'アルバム': 'album', 'シングル': 'single', 'EP': 'single', 'アーティスト': 'artist', 'プレイリスト': 'playlist', '再生リスト': 'playlist', 'ポッドキャスト': 'podcast', 'エピソード': 'episode', Song: 'song', Video: 'video', Album: 'album', Single: 'single', Artist: 'artist', Playlist: 'playlist' };

export function norm(n: any): Item | null {
  if (!n) return null;
  const t = n.type;
  try {
    if (t === 'PlaylistPanelVideo') {
      const it: Item = { kind: 'song', id: n.video_id, title: txt(n.title), thumb: bestThumb(n) };
      if (n.duration?.seconds) { it.sec = n.duration.seconds; it.duration = n.duration.text; }
      const ar = (n.artists || []).map((a: any) => ({ id: a.channel_id, name: a.name })).filter((a: any) => a.name);
      if (ar.length) it.artists = ar;
      else if (n.author) it.artists = [{ name: typeof n.author === 'string' ? n.author : txt(n.author) }];
      if (n.album?.name) it.album = { id: n.album.id, name: n.album.name };
      it.subtitle = [it.artists?.map((a) => a.name).join(', '), it.album?.name].filter(Boolean).join(' • ');
      const vt = vType(n.endpoint);
      if (vt && vt !== 'MUSIC_VIDEO_TYPE_ATV') it.kind = 'video';
      return it.id ? it : null;
    }
    if (t === 'PlaylistPanelVideoWrapper') return norm(n.primary);
    if (t === 'MusicResponsiveListItem') {
      const cols = (n.flex_columns || []).map((c: any) => c.title);
      const titleRuns = runs(cols[0]);
      const ep = titleRuns.find((r: any) => r.endpoint)?.endpoint || n.endpoint || n.overlay?.content?.endpoint;
      let base = fromEndpoint(ep) || fromEndpoint(n.endpoint) || fromEndpoint(n.overlay?.content?.endpoint);
      if (!base && n.id) base = { kind: (n.item_type === 'song' ? 'song' : n.item_type) as any, id: n.id };
      if (!base && n.playlist_item_data?.video_id) base = { kind: 'song', id: n.playlist_item_data.video_id };
      if (!base) return null;
      const it: Item = { ...base, title: txt(cols[0]) || txt(n.title), thumb: bestThumb(n) } as Item;
      const sub = cols.slice(1).flatMap((c: any) => [...runs(c), { text: '•' }]);
      const fixed = (n.fixed_columns || []).flatMap((c: any) => runs(c.title));
      const plain = metaFromRuns([...sub, ...fixed], it);
      if (plain[0] && KIND_WORDS[plain[0]]) { const k = KIND_WORDS[plain[0]]; if (it.kind !== 'song' || k === 'video') it.kind = it.kind === 'mood' ? k : it.kind; plain.shift(); }
      if (n.item_type === 'video' && it.kind === 'song') it.kind = 'video';
      if (!it.artists && n.artists?.length) it.artists = n.artists.map((a: any) => ({ id: a.channel_id, name: a.name }));
      if (!it.duration && n.duration?.seconds) { it.sec = n.duration.seconds; it.duration = n.duration.text; }
      if (!it.artists?.length && (it.kind === 'song' || it.kind === 'video') && plain[0] && !/再生|視聴|回$|^\d/.test(plain[0])) it.artists = [{ name: plain.shift()! }];
      it.subtitle = [...(it.artists?.map((a) => a.name) ? [it.artists!.map((a) => a.name).join(', ')] : []), it.album?.name, ...plain].filter(Boolean).join(' • ');
      it.explicit = !!(n.badges || []).length;
      return it;
    }
    if (t === 'MusicTwoRowItem') {
      const base = fromEndpoint(n.endpoint) || fromEndpoint(runs(n.title)[0]?.endpoint);
      if (!base) return null;
      const it: Item = { ...base, title: txt(n.title), thumb: bestThumb(n) } as Item;
      const plain = metaFromRuns(runs(n.subtitle), it);
      if (plain[0] && KIND_WORDS[plain[0]] && it.kind === 'album') { if (KIND_WORDS[plain[0]] === 'single') it.kind = 'single'; }
      it.subtitle = txt(n.subtitle);
      return it;
    }
    if (t === 'MusicNavigationButton') {
      const base = fromEndpoint(n.endpoint);
      if (!base) return null;
      const c = n.color;
      return { kind: 'mood', id: base.id, params: base.params, title: txt(n.button_text), color: typeof c === 'number' ? '#' + (c >>> 0).toString(16).padStart(8, '0').slice(2) : undefined };
    }
    if (t === 'MusicCardShelf') {
      const base = fromEndpoint(n.on_tap) || fromEndpoint(runs(n.title)[0]?.endpoint);
      if (!base) return null;
      const it: Item = { ...base, title: txt(n.title), thumb: bestThumb(n) } as Item;
      const plain = metaFromRuns(runs(n.subtitle), it);
      if (plain[0] && KIND_WORDS[plain[0]]) plain.shift();
      it.subtitle = txt(n.subtitle);
      return it;
    }
  } catch {}
  return null;
}

const ITEM_TYPES = new Set(['MusicResponsiveListItem', 'MusicTwoRowItem', 'MusicNavigationButton', 'PlaylistPanelVideo', 'PlaylistPanelVideoWrapper']);
const SHELF_TYPES = new Set(['MusicCarouselShelf', 'MusicShelf', 'MusicImmersiveCarouselShelf', 'Grid', 'GridView', 'MusicPlaylistShelf', 'MusicCardShelf', 'ItemSection']);

/** Walk any parsed response into sections. */
export function sections(root: any): Section[] {
  const out: Section[] = [];
  const seen = new Set<any>();
  const pushItems = (title: string | undefined, nodes: any[], layout: Section['layout'], more?: any, subtitle?: string) => {
    const items = nodes.map(norm).filter(Boolean) as Item[];
    if (!items.length) return;
    const last = out[out.length - 1];
    if (!title && last && !last.title && last.layout === layout) { last.items.push(...items); return; }
    out.push({ title, subtitle, layout, items, more });
  };
  const walk = (o: any, depth: number) => {
    if (!o || typeof o !== 'object' || depth > 14 || seen.has(o)) return;
    seen.add(o);
    if (Array.isArray(o)) {
      const direct = o.filter((x) => x && ITEM_TYPES.has(x.type));
      if (direct.length && direct.length >= o.length / 2) { pushItems(undefined, direct, direct[0].type === 'MusicTwoRowItem' ? 'carousel' : 'list'); return; }
      o.forEach((x) => walk(x, depth + 1));
      return;
    }
    const t = o.type;
    if (t === 'MusicCardShelf') {
      const top = norm(o);
      if (top) out.push({ title: '上位の検索結果', layout: 'carousel', items: [top], thumb: top.thumb });
      const inner = (o.contents || []).filter((x: any) => ITEM_TYPES.has(x?.type));
      if (inner.length) pushItems(undefined, inner, 'list');
      return;
    }
    if (t && SHELF_TYPES.has(t)) {
      const nodes = (o.contents || o.items || []).filter((x: any) => x && ITEM_TYPES.has(x.type));
      if (nodes.length) {
        const h = o.header;
        const title = txt(h?.title) || txt(o.title) || undefined;
        const subtitle = txt(h?.strapline) || txt(h?.subtitle) || undefined;
        const moreEp = h?.more_content?.endpoint || h?.endpoint || o.bottom_endpoint || o.endpoint;
        const more = moreEp?.payload?.browseId ? { id: moreEp.payload.browseId, params: moreEp.payload.params } : undefined;
        const isList = t === 'MusicShelf' || t === 'MusicPlaylistShelf' || (t === 'ItemSection') || nodes[0].type === 'MusicResponsiveListItem' && t !== 'MusicCarouselShelf';
        pushItems(title, nodes, isList ? 'list' : 'carousel', more, subtitle);
        if (t !== 'ItemSection') return;
      }
    }
    for (const k of Object.keys(o)) if (k !== 'header' || !t) walk(o[k], depth + 1);
  };
  walk(J(root), 0);
  return out;
}

// ---------------- API functions ----------------

export async function home(chip?: string) {
  const y = await yt();
  let feed: any = await y.music.getHomeFeed();
  const chips = (feed.header?.chips || []).map((c: any) => txt(c.text)).filter(Boolean);
  if (chip) { try { feed = await feed.applyFilter(chip); } catch {} }
  const secs: Section[] = sections(feed.sections);
  for (let i = 0; i < 4 && feed.has_continuation; i++) {
    try { feed = await feed.getContinuation(); secs.push(...sections(feed.sections)); } catch { break; }
  }
  if (!chip && secs.length < 6) {
    try { const e = await explore(); secs.push(...e.sections.filter((s) => s.items[0]?.kind !== 'mood')); } catch {}
  }
  return { chips, sections: secs.filter((s) => s.items.length) };
}

export async function browse(id: string, params?: string) {
  const y = await yt();
  const r: any = await y.actions.execute('/browse', { browseId: id, params, client: 'YTMUSIC', parse: true });
  const header = J(r.header);
  const title = txt(header?.title) || txt(r.header?.title) || '';
  return { title, sections: sections(r.contents_memo ? Array.from((r.contents_memo as any).values()).flat().filter((x: any) => SHELF_TYPES.has(x?.type)) : r.contents) };
}

export async function explore() {
  const y = await yt();
  const e: any = await y.music.getExplore();
  return { sections: sections(e.sections) };
}

export async function search(q: string, type?: string) {
  const y = await yt();
  if (!type || type === 'all') {
    const r: any = await y.music.search(q);
    return { sections: sections(r.contents) };
  }
  const r: any = await y.music.search(q, { type: type as any });
  let secs = sections(r.contents);
  try {
    if (r.has_continuation) { const c: any = await r.getContinuation(); secs = [...secs, ...sections(c.contents)]; }
  } catch {}
  const items = secs.flatMap((s) => s.items);
  return { sections: [{ layout: 'list', items }] as Section[] };
}

export async function suggest(q: string) {
  const y = await yt();
  const s: any = J(await y.music.getSearchSuggestions(q));
  const words: string[] = [];
  const items: Item[] = [];
  for (const sec of s || []) for (const c of sec.contents || []) {
    if (c.type === 'SearchSuggestion') words.push(txt(c.suggestion));
    else { const it = norm(c); if (it) items.push(it); }
  }
  return { words, items: items.slice(0, 4) };
}

export async function artist(id: string) {
  const y = await yt();
  const a: any = await y.music.getArtist(id);
  const h = J(a.header);
  const shuffle = h?.buttons?.find?.((b: any) => b.endpoint?.payload?.playlistId)?.endpoint?.payload?.playlistId;
  const radio = h?.start_radio_button?.endpoint?.payload?.playlistId || h?.buttons?.[1]?.endpoint?.payload?.playlistId;
  return {
    id,
    name: txt(h?.title),
    description: txt(h?.description),
    subscribers: txt(h?.subscription_button?.subscriber_count) || txt(h?.subscription_button?.subscriber_count_text) || txt(h?.monthly_listener_count),
    thumb: upThumb(bestThumb(h), 1200),
    shufflePlaylist: shuffle,
    radioPlaylist: radio,
    sections: sections(a.sections),
  };
}

export async function album(id: string) {
  const y = await yt();
  const a: any = await y.music.getAlbum(id);
  const h = J(a.header);
  const tracks = sections(a.contents).flatMap((s) => s.items);
  const art = upThumb(bestThumb(h), 800);
  const artists = runs(h?.strapline_text_one).length ? metaArtists(runs(h.strapline_text_one)) : metaArtists(runs(h?.subtitle));
  for (const t of tracks) {
    t.thumb = t.thumb || art;
    if (!t.album) t.album = { id, name: txt(h?.title) };
    if (!t.artists?.length) t.artists = artists;
    if (!t.subtitle) t.subtitle = artists.map((x) => x.name).join(', ');
  }
  return {
    id,
    title: txt(h?.title),
    subtitle: txt(h?.subtitle),
    second: txt(h?.second_subtitle),
    description: txt(h?.description) || txt(h?.description_shelf?.description),
    artists,
    thumb: art,
    playlistId: a.url ? new URL(a.url).searchParams.get('list') || undefined : J(a.header)?.buttons?.find?.((b: any) => b.endpoint?.payload?.playlistId)?.endpoint?.payload?.playlistId,
    tracks,
    sections: sections(a.sections),
  };
}
function metaArtists(rs: any[]): Artist[] {
  const ar: Artist[] = [];
  for (const r of rs) { const pt = pageType(r.endpoint); if (pt.includes('ARTIST') || pt.includes('USER_CHANNEL')) ar.push({ id: r.endpoint.payload.browseId, name: r.text }); }
  if (!ar.length) { const t = rs.map((r) => r.text).join('').split('•').map((s) => s.trim()).filter(Boolean); if (t.length > 1) ar.push({ name: t[1] }); else if (t[0]) ar.push({ name: t[0] }); }
  return ar;
}

export async function playlist(id: string) {
  const y = await yt();
  let p: any = await y.music.getPlaylist(id);
  const h = J(p.header);
  let tracks = sections(p.items || p.contents).flatMap((s) => s.items);
  for (let i = 0; i < 4 && p.has_continuation && tracks.length < 400; i++) {
    try { p = await p.getContinuation(); tracks = tracks.concat(sections(p.items || p.contents).flatMap((s) => s.items)); } catch { break; }
  }
  return {
    id,
    title: txt(h?.title),
    subtitle: [txt(h?.subtitle), txt(h?.second_subtitle)].filter(Boolean).join(' • '),
    description: txt(h?.description) || txt(h?.description?.description),
    thumb: upThumb(bestThumb(h), 800),
    tracks: tracks.filter((t) => t.kind === 'song' || t.kind === 'video' || t.kind === 'episode'),
  };
}

export async function upnext(videoId: string, playlistId?: string) {
  const y = await yt();
  const u: any = await y.music.getUpNext(videoId, true);
  let items = (J(u.contents) || []).map(norm).filter(Boolean) as Item[];
  if (playlistId && playlistId !== u.playlist_id) {
    try {
      const r: any = await y.actions.execute('/next', { videoId, playlistId, client: 'YTMUSIC', parse: true });
      const s = sections(r).flatMap((x) => x.items).filter((x) => x.kind === 'song' || x.kind === 'video');
      if (s.length) items = s;
    } catch {}
  }
  return { playlistId: u.playlist_id, items };
}

export async function related(videoId: string) {
  const y = await yt();
  const r: any = await y.music.getRelated(videoId);
  return { sections: sections(r) };
}

export async function lyrics(videoId: string) {
  const y = await yt();
  try {
    const l: any = await y.music.getLyrics(videoId);
    return { text: txt(l?.description), source: txt(l?.footer) };
  } catch { return { text: '', source: '' }; }
}

export async function info(videoId: string) {
  const r = await upnext(videoId);
  return r.items.find((x) => x.id === videoId) || r.items[0] || null;
}
