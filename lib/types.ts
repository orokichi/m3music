export type Artist = { id?: string; name: string };
export type Item = {
  kind: 'song' | 'video' | 'album' | 'single' | 'artist' | 'playlist' | 'podcast' | 'episode' | 'mood';
  id: string; title: string; subtitle?: string; artists?: Artist[]; album?: { id?: string; name: string };
  thumb?: string; duration?: string; sec?: number; playlistId?: string; params?: string; color?: string; explicit?: boolean;
};
export type Section = { title?: string; subtitle?: string; layout: 'list' | 'carousel'; items: Item[]; more?: { id: string; params?: string }; thumb?: string };
export const isTrack = (i: Item) => i.kind === 'song' || i.kind === 'video' || i.kind === 'episode';
export const artistsText = (i: Item) => i.artists?.map((a) => a.name).join(', ') || i.subtitle || '';
export function hrefOf(i: Item): string {
  switch (i.kind) {
    case 'album': case 'single': return `/album/${i.id}`;
    case 'artist': return `/artist/${i.id}`;
    case 'playlist': return `/playlist/${i.id}`;
    case 'podcast': return `/playlist/${i.id}`;
    case 'mood': return `/browse/${encodeURIComponent(i.id)}${i.params ? `?params=${encodeURIComponent(i.params)}` : ''}`;
    default: return '';
  }
}
