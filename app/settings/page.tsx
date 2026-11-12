'use client';
import { useRef, useState } from 'react';
import { actions, useStore } from '@/lib/store';
import { chat, DEFAULT_MODELS } from '@/lib/ai';
import { Icon, Switch, useSnack } from '@/components/ui';

const SEEDS = ['#d0103a', '#e8590c', '#f2b705', '#2f9e44', '#0c8599', '#1971c2', '#5f3dc4', '#c2255c', '#6b5e57'];

export default function Settings() {
  const st = useStore((s) => s.settings);
  const snack = useSnack();
  const file = useRef<HTMLInputElement>(null);
  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <h1 className="h1">設定</h1>
      <div className="h2">デザイン</div>
      <div className="card">
        <div className="setting"><Icon n="contrast" /><div className="txt"><b>テーマ</b><span className="muted small">ブラウザ（システム）の設定に追従できます</span></div>
          <div className="bgroup">{([['system', '自動'], ['light', 'ライト'], ['dark', 'ダーク']] as const).map(([k, l]) => <button key={k} className={`btn sm ${st.theme === k ? 'on' : ''}`} onClick={() => actions.setSettings({ theme: k })}>{l}</button>)}</div></div>
        <div className="setting"><Icon n="palette" /><div className="txt"><b>アートワークから配色</b><span className="muted small">再生中の曲のジャケットから Material You の配色を作ります</span></div><Switch on={st.dynamicColor} onChange={(v) => actions.setSettings({ dynamicColor: v })} /></div>
        <div className="setting" style={{ flexWrap: 'wrap' }}><Icon n="format_color_fill" /><div className="txt"><b>基本カラー</b></div>
          <div className="swatches">{SEEDS.map((c) => <button key={c} className={`swatch ${st.seed === c ? 'on' : ''}`} style={{ background: c }} onClick={() => actions.setSettings({ seed: c })} aria-label={c} />)}<input type="color" value={st.seed} onChange={(e) => actions.setSettings({ seed: e.target.value })} className="swatch" /></div></div>
      </div>
      <div className="h2">再生</div>
      <div className="card">
        <div className="setting"><Icon n="all_inclusive" /><div className="txt"><b>自動再生</b><span className="muted small">キューの最後に近づくと似た曲を自動で追加します</span></div><Switch on={st.radioAuto} onChange={(v) => actions.setSettings({ radioAuto: v })} /></div>
        <div className="setting"><Icon n="lyrics" /><div className="txt"><b>同期歌詞</b><span className="muted small">LRCLIB の時間同期歌詞を優先して表示します</span></div><Switch on={st.syncedLyrics} onChange={(v) => actions.setSettings({ syncedLyrics: v })} /></div>
        <div className="setting"><Icon n="keyboard" /><div className="txt"><b>キーボードショートカット</b><span className="muted small">Space/K 再生・停止、J/L 10秒移動、Shift+N/P 次/前、Shift+←/→ 次/前、S シャッフル、R リピート、M ミュート、+/- 音量、F 再生画面、/ 検索</span></div></div>
      </div>
      <div className="h2" id="ai">AI（AI 検索・歌詞の翻訳と解説）</div>
      <AiSettings />
      <div className="h2">データ</div>
      <div className="card">
        <div className="setting" style={{ flexWrap: 'wrap' }}><Icon n="database" /><div className="txt"><b>ライブラリのバックアップ</b><span className="muted small">高評価・プレイリスト・履歴はこの端末に保存されています（API キーは書き出されません）</span></div>
          <button className="btn tonal sm" onClick={() => { const b = new Blob([actions.exportData()], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'm3music-backup.json'; a.click(); }}><Icon n="download" />書き出し</button>
          <button className="btn outlined sm" onClick={() => file.current?.click()}><Icon n="upload" />読み込み</button>
          <input ref={file} type="file" accept="application/json" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { actions.importData(await f.text()); snack({ msg: '読み込みました' }); } catch { snack({ msg: '読み込めませんでした' }); } }} />
        </div>
      </div>
      <p className="muted small" style={{ padding: '8px 4px 40px' }}>M3 Music は YouTube Music の非公式クライアントです。再生には YouTube 公式の埋め込みプレーヤーを使用します。歌詞: LRCLIB / Musixmatch。</p>
    </div>
  );
}

function AiSettings() {
  const st = useStore((s) => s.settings);
  const [show, setShow] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  const loadModels = async () => {
    setStatus('モデル一覧を取得中…');
    try { const r = await fetch(`/api/ai?provider=${st.aiProvider}`, { headers: { 'x-ai-key': st.aiKey } }); const j = await r.json(); if (!r.ok) throw new Error(j.error || r.status); setModels(j.models); setStatus(`${j.models.length} 件のモデルを取得しました`); }
    catch (e: any) { setStatus('取得できませんでした: ' + (e.message || e)); }
  };
  const test = async () => { setStatus('接続テスト中…'); try { const t = await chat([{ role: 'user', content: '「接続OK」とだけ返して' }]); setStatus('✅ ' + t.slice(0, 60)); } catch (e: any) { setStatus('❌ ' + (e.message || e)); } };
  return (
    <div className="card">
      <div className="setting"><Icon n="hub" /><div className="txt"><b>プロバイダー</b><span className="muted small">キーはこのブラウザ内にのみ保存されます</span></div>
        <div className="bgroup">{([['openrouter', 'OpenRouter'], ['groq', 'Groq']] as const).map(([k, l]) => <button key={k} className={`btn sm ${st.aiProvider === k ? 'on' : ''}`} onClick={() => { actions.setSettings({ aiProvider: k, aiModel: '' }); setModels([]); setStatus(''); }}>{l}</button>)}</div></div>
      <div className="field"><label>API キー（{st.aiProvider === 'groq' ? 'console.groq.com → API Keys' : 'openrouter.ai → Keys'}）</label>
        <div className="row-flex"><input style={{ flex: 1, minWidth: 0 }} type={show ? 'text' : 'password'} autoComplete="off" placeholder={st.aiProvider === 'groq' ? 'gsk_...' : 'sk-or-...'} value={st.aiKey} onChange={(e) => actions.setSettings({ aiKey: e.target.value.trim() })} />
          <button className="icon-btn sl" onClick={() => setShow(!show)} aria-label="表示切替"><Icon n={show ? 'visibility_off' : 'visibility'} /></button></div></div>
      <div className="field"><label>モデル（空欄なら {DEFAULT_MODELS[st.aiProvider]}）</label>
        <input list="ai-models" placeholder={DEFAULT_MODELS[st.aiProvider]} value={st.aiModel} onChange={(e) => actions.setSettings({ aiModel: e.target.value.trim() })} />
        <datalist id="ai-models">{models.map((m) => <option key={m} value={m} />)}</datalist></div>
      <div className="setting" style={{ flexWrap: 'wrap' }}>
        <button className="btn tonal sm" onClick={loadModels}><Icon n="list" />モデル一覧</button>
        <button className="btn filled sm" disabled={!st.aiKey} onClick={test}><Icon n="bolt" />接続テスト</button>
        {st.aiKey && <button className="btn outlined sm" onClick={() => actions.setSettings({ aiKey: '' })}><Icon n="delete" />キーを削除</button>}
        <span className="muted small">{status}</span>
      </div>
    </div>
  );
}
