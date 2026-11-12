'use client';
import { use } from 'react';
import { useApi } from '@/lib/api';
import type { Section, Item, Artist } from '@/lib/types';
import { Shelf } from '@/components/cards';
import { CollectionHeader, TrackList } from '@/components/Collection';
import { Icon, Loader } from '@/components/ui';
import { actions, useStore } from '@/lib/store';

type A = { id: string; title: string; subtitle: string; second: string; description: string; artists: Artist[]; thumb: string; tracks: Item[]; sections: Section[] };
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, loading, error } = useApi<A>({ fn: 'album', id });
  const saved = useStore((s) => s.albums.some((x) => x.id === id));
  if (loading) return <Loader />;
  if (error || !data) return <div className="empty"><div className="big"><Icon n="error" /></div>{error}</div>;
  const ctx = { type: 'album', id, title: data.title };
  const item: Item = { kind: 'album', id, title: data.title, thumb: data.thumb, subtitle: data.artists.map((a) => a.name).join(', '), artists: data.artists };
  return (
    <div className="page">
      <CollectionHeader thumb={data.thumb} title={data.title} kind={data.subtitle} artists={data.artists} meta={data.second} description={data.description} tracks={data.tracks} ctx={ctx} saved={saved} onSave={() => actions.toggleAlbum(item)} />
      <TrackList tracks={data.tracks} ctx={ctx} numbered />
      {data.sections.map((s, i) => <Shelf key={i} sec={s} />)}
    </div>
  );
}
