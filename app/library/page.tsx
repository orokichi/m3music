'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useStore, actions } from '@/lib/store';
import type { Item } from '@/lib/types';
import { Art, SongRow, Tile, playLocal } from '@/components/cards';
import { Icon } from '@/components/ui';

const TABS = [['playlists', 'プレイリスト'], ['songs', '曲'], ['albums', 'アルバム'], ['artists', 'アーティスト'], ['history', '履歴']] as const;

export default function Library() {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('playlists');
  const s = useStore((x) => x);
  const newPl = () => { const n = prompt('新しいプレイリストの名前'); if (n?.trim()) actions.createLocal(n.trim()); };
  const day = (t: number) => { const d = new Date(t); const today = new Date(); const y = new Date(Date.now() - 864e5); return d.toDateString() === today.toDateString() ? '今日' : d.toDateString() === y.toDateString() ? '昨日' : `${d.getMonth() + 1}月${d.getDate()}日`; };
  return (
    <div className="page">
      <h1 className="h1">ライブラリ</h1>
      <div className="chips sticky-chips">{TABS.map(([k, l]) => <button key={k} className={`chip sl ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'playlists' && (
        <div className="tile-grid">
          <div className="tile"><button className="tile-art new-pl sl" onClick={newPl}><Icon n="add" size={48} /></button><div className="tile-t">新しいプレイリスト</div></div>
          <div className="tile">
            <Link href="/playlist/LM" className="tile-art liked-art sl"><Icon n="thumb_up" fill size={56} />
              <button className="play-fab" aria-label="再生" onClick={(e) => { e.preventDefault(); playLocal('LM'); }}><Icon n="play_arrow" fill /></button></Link>
            <Link href="/playlist/LM" className="tile-t">高く評価した曲</Link><div className="tile-s">自動プレイリスト • {s.liked.length} 曲</div>
          </div>
          {s.local.map((p) => (
            <div className="tile" key={p.id}>
              <Link href={`/playlist/${p.id}`} className="tile-art sl"><Art src={p.items[0]?.thumb} />
                <button className="play-fab" aria-label="再生" onClick={(e) => { e.preventDefault(); playLocal(p.id); }}><Icon n="play_arrow" fill /></button></Link>
              <Link href={`/playlist/${p.id}`} className="tile-t">{p.name}</Link><div className="tile-s">プレイリスト • {p.items.length} 曲</div>
            </div>
          ))}
          {s.playlists.map((p) => <Tile key={p.id} it={p} />)}
        </div>
      )}
      {tab === 'songs' && (s.liked.length ? <div className="list">{s.liked.map((it, i) => <SongRow key={it.id} it={it} list={s.liked} index={i} ctx={{ type: 'playlist', id: 'LM', title: '高く評価した曲' }} />)}</div> : <Empty icon="thumb_up" t="高く評価した曲がここに表示されます" />)}
      {tab === 'albums' && (s.albums.length ? <div className="tile-grid">{s.albums.map((it) => <Tile key={it.id} it={it} />)}</div> : <Empty icon="album" t="保存したアルバムがここに表示されます" />)}
      {tab === 'artists' && (s.artists.length ? <div className="tile-grid">{s.artists.map((it) => <Tile key={it.id} it={it} />)}</div> : <Empty icon="person" t="登録したアーティストがここに表示されます" />)}
      {tab === 'history' && (s.history.length ? (
        <>
          <div className="row-flex" style={{ justifyContent: 'flex-end' }}><button className="btn text" onClick={() => confirm('再生履歴を削除しますか？') && actions.clearHistory()}>履歴を削除</button></div>
          {Object.entries(s.history.reduce((m: Record<string, Item[]>, h) => { (m[day(h.at)] ||= []).push(h); return m; }, {})).map(([d, items]) => (
            <section key={d}><h2 className="h2">{d}</h2><div className="list">{items.map((it, i) => <SongRow key={it.id} it={it} list={items} index={i} ctx={{ type: 'history', title: '再生履歴' }} />)}</div></section>
          ))}
        </>
      ) : <Empty icon="history" t="再生した曲がここに表示されます" />)}
    </div>
  );
}
function Empty({ icon, t }: { icon: string; t: string }) { return <div className="empty"><div className="big"><Icon n={icon} /></div>{t}</div>; }
