import type { MapRoof } from '../../shared/geom.ts';
import { setLight } from '../lighting.ts';
import type { GeoInfo } from '../geoart.ts';
import { C, FONT, LAYOUT, TAU, bake, box, disc, text, type Sprite } from './rangekit.ts';
import { paintRangeFloor } from './rangefloor.ts';
import { RANGE_WALLS } from './rangewalls.ts';
import { registerTheme, type ThemeView } from './registry.ts';

/**
 * The shooting range as an army training range: registers the theme. The ground and its small stories are rangefloor.ts, the
 * walls (blockwork, sandbags, benches, the ammo table, the control tower, the ammo hut, the shoot-house and the berms)
 * rangewalls.ts. Here: the covered firing line's canopy (baked once, its bay numbers painted on it so they read from the field),
 * and what moves: red range flags on the berms and the tower, the tower's wind sock, and the RANGE HOT lamps. Every motion is
 * slow and holds still under `prefers-reduced-motion`.
 */
type G = CanvasRenderingContext2D;
const calm = (() => { try { return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } })();
const clock = (now: number) => (calm ? 2000 : now);
const inView = (v: ThemeView, x: number, y: number, r: number) => x + r >= v.x0 && x - r <= v.x1 && y + r >= v.y0 && y - r <= v.y1;

/* ------------------------------------------------------------ the canopy */

let canopy: { id: string; sprite: Sprite } | null = null;

function paintCanopy(g: G, r: MapRoof) {
  const xs = r.points.map((p) => p.x), ys = r.points.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), w = x1 - x0, h = y1 - y0;
  // its front face, and the eave's shadow on the slab past its east edge
  g.fillStyle = 'rgba(20, 16, 10, 0.25)'; g.fillRect(x1, y0 + 8, 10, h);
  box(g, x0, y1, w, 12, '#4c5246', 2);
  // corrugated sheets running across, lapped every 160 px
  g.fillStyle = '#7d8474'; g.fillRect(x0, y0, w, h);
  for (let x = x0; x < x1; x += 9) { g.fillStyle = 'rgba(255, 252, 240, 0.12)'; g.fillRect(x, y0, 3, h); g.fillStyle = 'rgba(20, 24, 16, 0.16)'; g.fillRect(x + 5, y0, 2, h); }
  g.strokeStyle = 'rgba(30, 34, 26, 0.55)'; g.lineWidth = 2;
  for (let y = y0 + 160; y < y1; y += 160) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); }
  // skylights, a ridge cap down the middle and a gutter along the low east edge
  for (let y = y0 + 60; y < y1 - 80; y += 320) { g.fillStyle = 'rgba(200, 220, 210, 0.38)'; g.fillRect(x0 + 24, y, 60, 70); g.strokeStyle = 'rgba(30, 34, 26, 0.6)'; g.lineWidth = 1.4; g.strokeRect(x0 + 24, y, 60, 70); }
  g.fillStyle = '#9aa08e'; g.fillRect(x0 + w * 0.5 - 5, y0, 10, h);
  g.fillStyle = C.steelLo; g.fillRect(x1 - 8, y0, 8, h);
  // the bays' numbers and names, big on the roof so they read from down the range
  for (const [i, l] of LAYOUT.lanes.entries()) {
    const yc = (l.y0 + l.y1) / 2;
    if (yc < y0 + 60 || yc > y1 - 60) continue;
    g.fillStyle = 'rgba(236, 232, 220, 0.78)'; g.font = FONT(84); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(i + 1), x0 + w / 2, yc - 36);
    text(g, l.label, x0 + w / 2, yc + 30, 30, 'rgba(236, 232, 220, 0.78)');
  }
  // a red band across each end: the range's own colours
  for (const y of [y0 + 6, y1 - 20]) { g.fillStyle = C.red; g.fillRect(x0, y, w, 14); }
  g.strokeStyle = C.ink; g.lineWidth = 2.4; g.strokeRect(x0, y0, w, h);
}

function drawRoof(g: G, roof: MapRoof, _alpha: number, info: GeoInfo): boolean {
  if (roof.material !== 'canopy') return false;
  if (!canopy || canopy.id !== roof.id) {
    const xs = roof.points.map((p) => p.x), ys = roof.points.map((p) => p.y);
    canopy = { id: roof.id, sprite: bake(Math.min(...xs) - 2, Math.min(...ys) - 2, Math.max(...xs) + 14, Math.max(...ys) + 16, (c) => paintCanopy(c, roof)) };
  }
  const s = canopy.sprite;
  if (s.x > info.view.x1 || s.x + s.canvas.width < info.view.x0 || s.y > info.view.y1 || s.y + s.canvas.height < info.view.y0) return true;
  g.drawImage(s.canvas, s.x, s.y);
  return true;
}

/* ------------------------------------------------------------ live: flags, wind sock, lamps */

/** Red range flags on poles: the berm corners and crests, and the tower's roof. */
const FLAGS = [
  { x: 306, y: 112, pole: 56 }, { x: 2290, y: 100, pole: 56 }, { x: 2290, y: 2312, pole: 56 },
  { x: 1000, y: 62, pole: 44 }, { x: 1750, y: 62, pole: 44 }, { x: 1000, y: 2366, pole: 44 }, { x: 1750, y: 2366, pole: 44 },
] as const;
/** RANGE HOT boards at each end of the firing line, and the tower's beacon. */
const HOT = [{ x: 450, y: 220 }, { x: 450, y: 2200 }] as const;
const BEACON = { x: 250, y: 44 } as const;

function flag(g: G, x: number, y: number, pole: number, t: number, i: number) {
  g.fillStyle = 'rgba(20, 16, 10, 0.25)'; g.beginPath(); g.ellipse(x + 3, y + 2, 6, 3, 0, 0, TAU); g.fill();
  g.strokeStyle = C.ink; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - pole); g.stroke();
  g.strokeStyle = C.steelHi; g.lineWidth = 2; g.stroke();
  const top = y - pole + 2, len = 34, ht = 20;
  g.fillStyle = C.red; g.strokeStyle = C.ink; g.lineWidth = 1.6;
  g.beginPath(); g.moveTo(x, top);
  for (let k = 0; k <= 6; k++) { const u = k / 6; g.lineTo(x + u * len, top + Math.sin(t / 260 + u * 4 + i) * 3 * u); }
  for (let k = 6; k >= 0; k--) { const u = k / 6; g.lineTo(x + u * len, top + ht - u * 3 + Math.sin(t / 260 + u * 4 + i) * 3 * u); }
  g.closePath(); g.fill(); g.stroke();
  g.fillStyle = 'rgba(255, 255, 255, 0.18)'; g.fillRect(x + 2, top + 2, len * 0.6, 3);
}

function windsock(g: G, x: number, y: number, t: number) {
  g.strokeStyle = C.ink; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 56); g.stroke();
  const top = y - 54, sway = calm ? 0 : Math.sin(t / 700) * 0.12;
  g.save(); g.translate(x, top); g.rotate(sway);
  for (let k = 0; k < 5; k++) { const w0 = 9 - k * 1.2, w1 = 9 - (k + 1) * 1.2; g.fillStyle = k % 2 ? C.bone : '#e0661f'; g.beginPath(); g.moveTo(k * 9, -w0); g.lineTo((k + 1) * 9, -w1); g.lineTo((k + 1) * 9, w1); g.lineTo(k * 9, w0); g.closePath(); g.fill(); }
  g.strokeStyle = C.ink; g.lineWidth = 1.4; g.beginPath(); g.moveTo(0, -9); g.lineTo(45, -3); g.lineTo(45, 3); g.lineTo(0, 9); g.closePath(); g.stroke();
  g.restore();
}

function hotBoard(g: G, x: number, y: number, on: boolean) {
  g.fillStyle = 'rgba(20, 16, 10, 0.28)'; g.beginPath(); g.ellipse(x + 4, y + 6, 40, 8, 0, 0, TAU); g.fill();
  box(g, x - 34, y - 6, 5, 14, C.steelLo, 1.2); box(g, x + 29, y - 6, 5, 14, C.steelLo, 1.2);
  box(g, x - 42, y - 34, 84, 30, C.steelDark, 2);
  g.fillStyle = on ? C.red : C.redLo; g.fillRect(x - 38, y - 30, 76, 22);
  text(g, 'RANGE HOT', x, y - 19, 16, on ? '#fff2e0' : 'rgba(255, 220, 200, 0.6)');
  disc(g, x, y - 42, 6, on ? C.redHi : C.redLo, 1.6);
  if (on) { g.fillStyle = 'rgba(255, 80, 60, 0.25)'; g.beginPath(); g.arc(x, y - 42, 16, 0, TAU); g.fill(); }
}

function beacon(g: G, x: number, y: number, t: number) {
  disc(g, x, y, 8, C.redLo, 1.6);
  const a = calm ? 0 : (t / 600) % TAU;
  g.fillStyle = 'rgba(255, 70, 50, 0.32)';
  g.beginPath(); g.moveTo(x, y); g.arc(x, y, 60, a - 0.35, a + 0.35); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(x, y); g.arc(x, y, 60, a + Math.PI - 0.35, a + Math.PI + 0.35); g.closePath(); g.fill();
  disc(g, x, y, 5, C.redHi, 0);
}

function rangeUnder(g: G, now: number, view: ThemeView) {
  const t = clock(now);
  const on = calm || Math.floor(t / 700) % 2 === 0;
  for (const [i, h] of HOT.entries()) if (inView(view, h.x, h.y, 80)) { hotBoard(g, h.x, h.y, on); setLight(`rg:hot:${i}`, { x: h.x, y: h.y - 30, radius: 160, color: '#ff4a3a', intensity: on ? 0.4 : 0.1, size: 8, shadows: false }); }
  windsock(g, 344, 120, t);
}

function rangeOver(g: G, now: number, view: ThemeView) {
  const t = clock(now);
  for (const [i, f] of FLAGS.entries()) if (inView(view, f.x, f.y - f.pole, 80)) flag(g, f.x, f.y, f.pole, t, i);
  if (inView(view, BEACON.x, BEACON.y, 80)) { beacon(g, BEACON.x, BEACON.y, t); setLight('rg:beacon', { x: BEACON.x, y: BEACON.y, radius: 220, color: '#ff4a3a', intensity: 0.35, size: 8, shadows: false }); }
}

registerTheme('range', { floor: paintRangeFloor, walls: RANGE_WALLS, under: rangeUnder, over: rangeOver, roof: drawRoof });
