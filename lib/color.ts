'use client';
import { QuantizerCelebi, Score, hexFromArgb, argbFromRgb } from '@material/material-color-utilities';

const memo = new Map<string, string>();
export async function seedFromImage(url?: string): Promise<string | null> {
  if (!url) return null;
  const small = url.replace(/=w\d+-h\d+[^&?#]*/, '=w96-h96-l90-rj').replace(/\/(hq720|maxresdefault|sddefault|hqdefault)\.jpg.*/, '/mqdefault.jpg');
  if (memo.has(small)) return memo.get(small)!;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = '/api/img?u=' + encodeURIComponent(small);
  await img.decode();
  const c = document.createElement('canvas');
  const W = 64, H = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * 64));
  c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, W, H);
  const d = ctx.getImageData(0, 0, W, H).data;
  const px: number[] = [];
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) px.push(argbFromRgb(d[i], d[i + 1], d[i + 2]));
  const q = QuantizerCelebi.quantize(px, 128);
  const ranked = Score.score(q, { desired: 1, fallbackColorARGB: 0xffd0103a, filter: true });
  const hex = hexFromArgb(ranked[0]);
  memo.set(small, hex);
  return hex;
}
