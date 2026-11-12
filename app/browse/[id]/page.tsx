'use client';
import { Suspense, use } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApi } from '@/lib/api';
import type { Section } from '@/lib/types';
import { Shelf } from '@/components/cards';
import { Icon, Loader } from '@/components/ui';

const TITLES: Record<string, string> = { FEmusic_new_releases: '新着', FEmusic_charts: 'チャート', FEmusic_moods_and_genres: 'ムードとジャンル' };
function B({ id }: { id: string }) {
  const sp = useSearchParams();
  const { data, loading, error } = useApi<{ title: string; sections: Section[] }>({ fn: 'browse', id, params: sp.get('params') || undefined });
  return (
    <div className="page">
      <h1 className="h1">{data?.title || TITLES[id] || ''}</h1>
      {loading && <Loader />}
      {error && <div className="empty"><div className="big"><Icon n="error" /></div>{error}</div>}
      {data?.sections.map((s, i) => <Shelf key={i} sec={s} />)}
    </div>
  );
}
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <Suspense><B id={decodeURIComponent(id)} /></Suspense>;
}
