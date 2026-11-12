'use client';
import { useEffect, useRef, useState, createContext, useContext, ReactNode } from 'react';

export const Icon = ({ n, fill, size, className = '' }: { n: string; fill?: boolean; size?: number; className?: string }) => (
  <span className={`ms ${fill ? 'fill' : ''} ${className}`} style={size ? { fontSize: size } : undefined} aria-hidden>{n}</span>
);

export const Loader = ({ small }: { small?: boolean }) => <div className={`loader ${small ? 'sm' : ''}`}><i /></div>;

export function Sentinel({ onHit, active }: { onHit: () => void; active: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onHit);
  cb.current = onHit;
  useEffect(() => {
    if (!active || !ref.current) return;
    const io = new IntersectionObserver((e) => e[0].isIntersecting && cb.current(), { rootMargin: '1200px' });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [active]);
  return <div ref={ref} style={{ height: 1 }} />;
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return <button role="switch" aria-checked={on} aria-label={label} className={`switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)} />;
}

// ---- snackbar ----
type Snack = { msg: string; action?: { label: string; fn: () => void } } | null;
const SnackCtx = createContext<(s: Snack) => void>(() => {});
export const useSnack = () => useContext(SnackCtx);
export function SnackProvider({ children }: { children: ReactNode }) {
  const [s, set] = useState<Snack>(null);
  const t = useRef<any>(null);
  const show = (x: Snack) => { set(null); clearTimeout(t.current); setTimeout(() => set(x), 10); t.current = setTimeout(() => set(null), 4000); };
  return (
    <SnackCtx.Provider value={show}>
      {children}
      {s && <div className="snack" role="status">{s.msg}{s.action && <button onClick={() => { s.action!.fn(); set(null); }}>{s.action.label}</button>}</div>}
    </SnackCtx.Provider>
  );
}

// ---- popup menu ----
export type MenuItem = { icon: string; label: string; fn: () => void };
const MenuCtx = createContext<(e: { x: number; y: number; items: MenuItem[] } | null) => void>(() => {});
export const useMenu = () => useContext(MenuCtx);
export function MenuProvider({ children }: { children: ReactNode }) {
  const [m, set] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);
  useEffect(() => {
    if (!m) return;
    const close = () => set(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); };
  }, [m]);
  return (
    <MenuCtx.Provider value={set}>
      {children}
      {m && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 89 }} onClick={() => set(null)} onContextMenu={(e) => { e.preventDefault(); set(null); }} />
          <div className="menu" style={{ top: Math.min(m.y, window.innerHeight - m.items.length * 44 - 24), left: Math.max(8, Math.min(m.x - 220, window.innerWidth - 240)) }}>
            {m.items.map((it) => (
              <button key={it.label} onClick={() => { set(null); it.fn(); }}><span className="ms">{it.icon}</span>{it.label}</button>
            ))}
          </div>
        </>
      )}
    </MenuCtx.Provider>
  );
}

export function Avatar({ src, name, className = '' }: { src?: string; name?: string; className?: string }) {
  const [err, setErr] = useState(false);
  if (!src || err) return <div className={`avatar ph ${className}`}>{(name || '?').replace('@', '').slice(0, 1).toUpperCase()}</div>;
  return <img className={`avatar ${className}`} src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setErr(true)} />;
}
