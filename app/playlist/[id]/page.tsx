'use client';
import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApi } from '@/lib/api';
import type { Item } from '@/lib/types';
import { CollectionHeader, TrackList } from '@/components/Collection';
import { Icon, Loader } from '@/components/ui';
import { actions, useStore } from '@/lib/store';

type PL = { id: string; title: string; subtitle: string; description: string; thumb: string; tracks: Item[] };

function Local({ id }: { id: string }) {
  const liked = useStore((s) => s.liked);
  const pl = useStore((s) => s.local.find((p) => p.id === id));
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  if (id !== 'LM' && !pl) return <div className="empty"><div className="big"><Icon n="playlist_remove" /></div>プレイリストが見つかりません</div>;
  const tracks = id === 'LM' ? liked : pl!.items;
  const title = id === 'LM' ? '高く評価した曲' : pl!.name;
  const ctx = { type: 'playlist', id, title };
  return (
    <div className="page">
      <CollectionHeader thumb={tracks[0]?.thumb} title={title} kind={id === 'LM' ? '自動プレイリスト' : 'プレイリスト（この端末）'} meta="あなた" tracks={tracks} ctx={ctx}
        extraMenu={id === 'LM' ? [] : [
          { icon: 'edit', label: '名前を変更', fn: () => { const n = prompt('プレイリスト名', pl!.name); if (n?.trim()) actions.renameLocal(id, n.trim()); } },
          { icon: 'delete', label: 'プレイリストを削除', fn: () => { if (confirm(`「${pl!.name}」を削除しますか？`)) { actions.deleteLocal(id); router.push('/library'); } } },
        ]}>
        {id !== 'LM' && <button className={`btn ${edit ? 'filled' : 'outlined'}`} onClick={() => setEdit(!edit)}><Icon n="edit" />編集</button>}
      </CollectionHeader>
      {!tracks.length && <div className="empty"><div className="big"><Icon n="music_off" /></div>まだ曲がありません</div>}
      <TrackList tracks={tracks} ctx={ctx} extraMenu={(t) => [id === 'LM'
        ? { icon: 'thumb_down', label: '高評価を取り消す', fn: () => actions.toggleLike(t) }
        : { icon: 'playlist_remove', label: 'このプレイリストから削除', fn: () => actions.removeFromLocal(id, t.id) }]} />
      {edit && <div className="muted small" style={{ padding: 12 }}>各曲の「︙」メニューから削除できます。</div>}
    </div>
  );
}

function Remote({ id }: { id: string }) {
  const { data, loading, error } = useApi<PL>({ fn: 'playlist', id });
  const saved = useStore((s) => s.playlists.some((x) => x.id === id));
  if (loading) return <Loader />;
  if (error || !data) return <div className="empty"><div className="big"><Icon n="error" /></div>{error}</div>;
  const ctx = { type: 'playlist', id, title: data.title };
  return (
    <div className="page">
      <CollectionHeader thumb={data.thumb} title={data.title} kind="プレイリスト" meta={data.subtitle} description={data.description} tracks={data.tracks} ctx={ctx} saved={saved}
        onSave={() => actions.togglePlaylist({ kind: 'playlist', id, title: data.title, thumb: data.thumb, subtitle: data.subtitle })} />
      <TrackList tracks={data.tracks} ctx={ctx} />
    </div>
  );
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const d = decodeURIComponent(id);
  return d === 'LM' || d.startsWith('local-') ? <Local id={d} /> : <Remote id={d} />;
}
