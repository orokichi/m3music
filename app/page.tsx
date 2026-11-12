'use client';
import { useState } from 'react';
import { useApi } from '@/lib/api';
import type { Section } from '@/lib/types';
import { Shelf, Tile } from '@/components/cards';
import { Icon, Loader } from '@/components/ui';
import { useStore } from '@/lib/store';

export default function Home() {
  const [chip, setChip] = useState<string | null>(null);
  const { data, loading, error } = useApi<{ chips: string[]; sections: Section[] }>({ fn: 'home', chip: chip || undefined });
  const base = useApi<{ chips: string[] }>(chip ? { fn: 'home' } : null);
  const history = useStore((s) => s.history);
  const chips = base.data?.chips || data?.chips || [];
  const recent = history.slice(0, 20);
  return (
    <div className="page">
      <div className="chips home-chips">
        {chips.map((c) => <button key={c} className={`chip sl ${chip === c ? 'on' : ''}`} onClick={() => setChip(chip === c ? null : c)}>{c}</button>)}
      </div>
      {!chip && recent.length > 0 && (
        <section className="shelf">
          <div className="shelf-h"><div><div className="strap">あなたの履歴</div><h2>もう一度聴く</h2></div></div>
          <div className="carousel">{recent.map((it) => <Tile key={it.id} it={it} />)}</div>
        </section>
      )}
      {loading && <Loader />}
      {error && <div className="empty"><div className="big"><Icon n="cloud_off" /></div>読み込めませんでした<br /><small>{error}</small></div>}
      {data?.sections.map((s, i) => <Shelf key={(chip || '') + i} sec={s} />)}
    </div>
  );
}
