'use client';
import Link from 'next/link';
import { useApi } from '@/lib/api';
import type { Section } from '@/lib/types';
import { Shelf } from '@/components/cards';
import { Icon, Loader } from '@/components/ui';

export default function Explore() {
  const { data, loading } = useApi<{ sections: Section[] }>({ fn: 'explore' });
  return (
    <div className="page">
      <div className="explore-btns">
        <Link href="/browse/FEmusic_new_releases" className="xbtn sl"><Icon n="new_releases" fill />新着</Link>
        <Link href="/browse/FEmusic_charts" className="xbtn sl"><Icon n="trending_up" />チャート</Link>
        <Link href="/browse/FEmusic_moods_and_genres" className="xbtn sl"><Icon n="sentiment_satisfied" />ムードとジャンル</Link>
        <Link href="/advanced" className="xbtn sl sparkle"><Icon n="auto_awesome" />AI 検索</Link>
      </div>
      {loading && <Loader />}
      {data?.sections.map((s, i) => <Shelf key={i} sec={s} />)}
    </div>
  );
}
