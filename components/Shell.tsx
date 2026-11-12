'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { applyTheme } from '@/lib/theme';
import { seedFromImage } from '@/lib/color';
import * as P from '@/lib/player';
import { actions, getState, useStore } from '@/lib/store';
import type { Item } from '@/lib/types';
import { hrefOf, isTrack } from '@/lib/types';
import { Art, playItem } from './cards';
import { MiniPlayer, NowPlaying } from './NowPlaying';
import { Icon, MenuProvider, SnackProvider, useSnack } from './ui';

const NAV = [
  { href: '/', icon: 'home', label: 'ホーム' },
  { href: '/explore', icon: 'explore', label: '探索' },
  { href: '/library', icon: 'library_music', label: 'ライブラリ' },
  { href: '/advanced', icon: 'auto_awesome', label: 'AI 検索' },
];

function Search({ mobileOpen, setMobileOpen }: { mobileOpen: boolean; setMobileOpen: (v: boolean) => void }) {
  const router = useRouter();
  const path = usePathname();
  const [q, setQ] = useState('');
  const [focus, setFocus] = useState(false);
  const [sug, setSug] = useState<{ words: string[]; items: Item[] }>({ words: [], items: [] });
  const [act, setAct] = useState(-1);
  const searches = useStore((s) => s.searches);
  const inp = useRef<HTMLInputElement>(null);
  useEffect(() => { if (path === '/search') { const u = new URLSearchParams(location.search).get('q'); if (u) setQ(u); } }, [path]);
  useEffect(() => {
    if (!focus) return;
    if (!q.trim()) { setSug({ words: [], items: [] }); return; }
    const t = setTimeout(() => api<{ words: string[]; items: Item[] }>({ fn: 'suggest', q }).then(setSug).catch(() => {}), 160);
    return () => clearTimeout(t);
  }, [q, focus]);
  useEffect(() => { if (mobileOpen) setTimeout(() => inp.current?.focus(), 50); }, [mobileOpen]);
  const go = (text: string) => {
    const t = text.trim();
    if (!t) return;
    actions.addSearch(t);
    setQ(t); setFocus(false); setMobileOpen(false); inp.current?.blur();
    router.push(`/search?q=${encodeURIComponent(t)}`);
  };
  const words = q.trim() ? sug.words : searches.slice(0, 8);
  const rows = words.length + (q.trim() ? sug.items.length : 0);
  const open = focus && rows > 0;
  return (
    <div className={`search-wrap ${mobileOpen ? 'm-open' : ''}`}>
      <div className={`search ${open ? 'open' : ''}`}>
        <button className="icon-btn m-only" onClick={() => setMobileOpen(false)} aria-label="戻る"><Icon n="arrow_back" /></button>
        <Icon n="search" className="s-ic d-only" />
        <input ref={inp} value={q} placeholder="曲、アルバム、アーティスト、ポッドキャストを検索" onFocus={() => setFocus(true)} onBlur={() => setTimeout(() => setFocus(false), 150)}
          onChange={(e) => { setQ(e.target.value); setAct(-1); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setAct((a) => Math.min(rows - 1, a + 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setAct((a) => Math.max(-1, a - 1)); }
            else if (e.key === 'Enter') {
              if (act >= 0 && act < words.length) go(words[act]);
              else if (act >= words.length) { const it = sug.items[act - words.length]; setFocus(false); isTrack(it) ? playItem(it) : router.push(hrefOf(it)); }
              else go(q);
            } else if (e.key === 'Escape') { inp.current?.blur(); setMobileOpen(false); }
          }} />
        {q && <button className="icon-btn" onClick={() => { setQ(''); inp.current?.focus(); }} aria-label="クリア"><Icon n="close" /></button>}
        <button className="icon-btn ai-ib" title="AI 検索" aria-label="AI 検索" onMouseDown={(e) => e.preventDefault()} onClick={() => { setFocus(false); setMobileOpen(false); router.push(`/advanced${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`); }}><Icon n="auto_awesome" /></button>
        {open && (
          <div className="suggest">
            {words.map((w, i) => (
              <div key={w} className={`row ${act === i ? 'active' : ''}`} onMouseDown={(e) => { e.preventDefault(); go(w); }}>
                <Icon n={q.trim() ? 'search' : 'history'} />{w}
                {!q.trim() && <span className="x" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); actions.removeSearch(w); }}>削除</span>}
              </div>
            ))}
            {q.trim() && sug.items.map((it, j) => (
              <div key={it.id} className={`row item ${act === words.length + j ? 'active' : ''}`} onMouseDown={(e) => { e.preventDefault(); setFocus(false); setMobileOpen(false); isTrack(it) ? playItem(it) : router.push(hrefOf(it)); }}>
                <Art src={it.thumb} round={it.kind === 'artist'} className="sug-art" />
                <div style={{ minWidth: 0 }}><div className="clamp1" style={{ fontWeight: 600 }}>{it.title}</div><div className="muted small clamp1">{it.subtitle}</div></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SaveDialog() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [name, setName] = useState('');
  const local = useStore((s) => s.local);
  const snack = useSnack();
  useEffect(() => {
    const h = (e: any) => { setItems(e.detail); setName(''); };
    window.addEventListener('m3:save', h);
    return () => window.removeEventListener('m3:save', h);
  }, []);
  if (!items) return null;
  return (
    <div className="dialog-scrim" onClick={() => setItems(null)}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h3>プレイリストに保存</h3>
        <div className="list">
          {local.map((p) => (
            <button key={p.id} className="song sl" style={{ width: '100%' }} onClick={() => { actions.addToLocal(p.id, items); snack({ msg: `「${p.name}」に保存しました` }); setItems(null); }}>
              <Art src={p.items[0]?.thumb} /><div className="song-txt"><div className="t">{p.name}</div><div className="s">{p.items.length} 曲</div></div>
            </button>
          ))}
        </div>
        <div className="ai-input" style={{ background: 'var(--md-surface-container-highest)', marginTop: 12 }}>
          <input placeholder="新しいプレイリスト名" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && name.trim() && (actions.createLocal(name.trim(), items), snack({ msg: `「${name.trim()}」を作成しました` }), setItems(null))} />
          <button className="btn filled" disabled={!name.trim()} onClick={() => { actions.createLocal(name.trim(), items); snack({ msg: `「${name.trim()}」を作成しました` }); setItems(null); }}><Icon n="add" />作成</button>
        </div>
      </div>
    </div>
  );
}

function Engine() {
  const host = useRef<HTMLDivElement>(null);
  const snack = useSnack();
  useEffect(() => { P.setSnack((m) => snack({ msg: m })); if (host.current) P.mountEngine(host.current); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <><div id="yt-host" ref={host} className="yt-host" /><div className="yt-cover" aria-hidden /></>;
}

function Keys() {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable || e.metaKey || e.ctrlKey || e.altKey) return;
      const p = P.getP();
      switch (e.key) {
        case ' ': case 'k': e.preventDefault(); P.toggle(); break;
        case 'j': P.seek(Math.max(0, p.time - 10)); break;
        case 'l': P.seek(p.time + 10); break;
        case 'ArrowLeft': if (e.shiftKey) P.prev(); break;
        case 'ArrowRight': if (e.shiftKey) P.next(); break;
        case 'N': P.next(); break;
        case 'P': P.prev(); break;
        case 'm': P.toggleMute(); break;
        case 's': P.toggleShuffle(); break;
        case 'r': P.cycleRepeat(); break;
        case '=': case '+': P.setVolume(p.volume + 10); break;
        case '-': P.setVolume(p.volume - 10); break;
        case 'f': P.setExpanded(!p.expanded); break;
        case '/': e.preventDefault(); (document.querySelector('.search input') as HTMLInputElement)?.focus(); break;
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
  return null;
}

function Theme() {
  const settings = useStore((s) => s.settings);
  const thumb = P.usePlayer((p) => p.queue[p.index]?.thumb);
  useEffect(() => {
    let alive = true;
    const run = async () => {
      let seed = settings.seed;
      if (settings.dynamicColor && thumb) { try { seed = (await seedFromImage(thumb)) || seed; } catch {} }
      if (alive) applyTheme(seed, settings.theme);
    };
    run();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const h = () => run();
    mq.addEventListener('change', h);
    return () => { alive = false; mq.removeEventListener('change', h); };
  }, [settings.seed, settings.theme, settings.dynamicColor, thumb]);
  return null;
}

export default function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [mSearch, setMSearch] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const hasCur = P.usePlayer((p) => p.index >= 0 && !!p.queue[p.index]);
  const expanded = P.usePlayer((p) => p.expanded);
  useEffect(() => { const h = () => setScrolled(window.scrollY > 4); window.addEventListener('scroll', h, { passive: true }); return () => window.removeEventListener('scroll', h); }, []);
  useEffect(() => { P.setExpanded(false); window.scrollTo(0, 0); }, [path]);
  useEffect(() => { document.body.style.overflow = expanded ? 'hidden' : ''; }, [expanded]);
  useEffect(() => { getState(); }, []);
  const isOn = (h: string) => (h === '/' ? path === '/' : path.startsWith(h));
  return (
    <SnackProvider>
      <MenuProvider>
        <Theme />
        <Keys />
        <header className={`topbar ${scrolled ? 'scrolled' : ''}`}>
          <Link href="/" className="logo" aria-label="M3 Music ホーム">
            <span className="logo-mark"><Icon n="play_arrow" fill /></span>
            <span>M3 Music</span>
          </Link>
          <Search mobileOpen={mSearch} setMobileOpen={setMSearch} />
          <span className="spacer m-only" />
          <button className="icon-btn m-only" onClick={() => setMSearch(true)} aria-label="検索"><Icon n="search" /></button>
          <Link href="/settings" className="icon-btn sl" aria-label="設定"><Icon n="settings" /></Link>
        </header>
        <nav className="rail">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={`rail-item ${isOn(n.href) ? 'on' : ''}`}>
              <span className="pill"><Icon n={n.icon} fill={isOn(n.href)} /></span>
              <span className="lbl">{n.label}</span>
            </Link>
          ))}
        </nav>
        <main className={`main ${hasCur ? 'has-mini' : ''}`}>{children}</main>
        <MiniPlayer />
        <nav className={`bottom-nav ${hasCur ? 'has-mini' : ''}`}>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={`bn-item ${isOn(n.href) ? 'on' : ''}`}>
              <span className="pill"><Icon n={n.icon} fill={isOn(n.href)} /></span>
              <span className="lbl">{n.label}</span>
            </Link>
          ))}
        </nav>
        <NowPlaying />
        <Engine />
        <SaveDialog />
      </MenuProvider>
    </SnackProvider>
  );
}
