import type { MapDef } from '../../shared/maps.ts';
import { CANAL, FOUNTAIN, TREES } from '../../shared/maps/oldtowngeo.ts';
import { setLight } from '../lighting.ts';
import { C, ROOMS, SIZE, TAU, YARDS, baseId, boundsOf, clock, hash, isTwin, reduced, roomOf, turn } from './oldtownkit.ts';
import { chimneysOf } from './oldtownpolys.ts';
import type { ThemeView } from './registry.ts';

/**
 * Everything in Old Town that glows or moves, each slow (nothing above 1 Hz but a candle's flicker) and each tied to a fixture:
 * lamplit windows in every room, the bakery's oven and the smithy's forge, the fountain's lamps and its ripples, glints on the
 * canal, string lights over the beer garden, washing on the lines, smoke from the chimneys, the lime trees' crowns (they thin out
 * over anyone standing under them), and the hanging signs and street plates that name every place. Under
 * `prefers-reduced-motion` it all holds still.
 */
type G = CanvasRenderingContext2D;
const inView = (v: ThemeView, x: number, y: number, r: number) => x + r >= v.x0 && x - r <= v.x1 && y + r >= v.y0 && y - r <= v.y1;
const FONT = '"Barlow Condensed", "Arial Narrow", sans-serif';

/* ---------------------------------------------------------------- lights */

type Src = { key: string; x: number; y: number; radius: number; color: string; intensity: number; flicker?: number; size?: number; shadows?: boolean };
const WEST_FIXTURES: readonly (readonly [number, number, number, string, number, number?])[] = [
  [1000, 120, 240, '#ff8a3a', 0.6, 0.35],     // the bakery's oven (the butcher's cold store has none: it is dimmed below)
  [1640, 2000, 260, '#ffd9a0', 0.55, 0.12],   // altar candles (the council chamber's chandelier)
  [380, 800, 240, '#ffcf7a', 0.45, 0.1],      // beer garden string lights
  [620, 1000, 220, '#ffcf7a', 0.4, 0.1],
  [1250, 3150, 220, '#e6f0ff', 0.3],          // drying yard
  [2400, 2700, 200, '#ffc46a', 0.45, 0.08],   // market stall lanterns
  [2400, 3300, 200, '#ffc46a', 0.45, 0.08],
  [2850, 2650, 200, '#ffc46a', 0.4, 0.08],
  [950, 3870, 200, '#ffb45a', 0.4, 0.2],      // the cooper's lamp (the smithy's forge on the other side)
];

const caches = new Map<string, Src[]>();
function sources(map: MapDef): Src[] {
  let list = caches.get(map.name);
  if (list) return list;
  list = [];
  for (const r of map.roofs ?? []) {
    const p = roomOf(r.id);
    if (!p || baseId(r.id) === 'archway') continue;
    const b = boundsOf(r.points), w = b.x1 - b.x0, h = b.y1 - b.y0;
    const col = isTwin(r.id) ? p.twinLight ?? p.light : p.light;
    list.push({ key: `ot:room:${r.id}`, x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, radius: Math.max(w, h) * 0.62, color: col, intensity: 0.5, flicker: 0.05, size: 30, shadows: true });
    if (p.sign) { const s = isTwin(r.id) ? turn(p.sign[0], p.sign[1]) : { x: p.sign[0], y: p.sign[1] }; list.push({ key: `ot:sign:${r.id}`, x: s.x, y: s.y + 20, radius: 160, color: '#ffc46a', intensity: 0.4, flicker: 0.08, size: 10 }); }
  }
  WEST_FIXTURES.forEach(([x, y, radius, color, intensity, flicker], i) => {
    list!.push({ key: `ot:fx${i}`, x, y, radius, color, intensity, ...(flicker !== undefined && { flicker }), size: 16 });
    const t = turn(x, y), forge = i === 8, cold = i === 0;
    list!.push({ key: `ot:fx${i}~`, ...t, radius, color: forge ? '#ff7a2a' : cold ? '#dff0ff' : color, intensity: forge ? 0.7 : cold ? 0.25 : intensity, ...(flicker !== undefined && { flicker: forge ? 0.45 : flicker }), size: 16 });
  });
  for (const p of [FOUNTAIN, { ...FOUNTAIN, ...turn(FOUNTAIN.x, FOUNTAIN.y) }]) list.push({ key: `ot:fountain:${p.x}`, x: p.x, y: p.y, radius: 260, color: '#8fdcff', intensity: 0.45, size: 40 });
  caches.set(map.name, list);
  return list;
}

/* ---------------------------------------------------------------- under: water */

function fountainWater(g: G, x: number, y: number, t: number) {
  g.save();
  g.beginPath(); g.arc(x, y, FOUNTAIN.r - 18, 0, TAU); g.clip();
  for (let k = 0; k < 3; k++) {
    const u = ((t * 0.00035 + k / 3) % 1);
    g.strokeStyle = `rgba(220, 245, 255, ${(0.4 * (1 - u)).toFixed(3)})`; g.lineWidth = 2.4;
    g.beginPath(); g.arc(x, y, 30 + u * (FOUNTAIN.r - 50), 0, TAU); g.stroke();
  }
  // four jets from the column's lion heads, arcing into the basin
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4, wob = reduced ? 0 : Math.sin(t * 0.004 + i) * 3;
    g.strokeStyle = 'rgba(230, 248, 255, 0.55)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(x + Math.cos(a) * 24, y + Math.sin(a) * 24 - 16); g.quadraticCurveTo(x + Math.cos(a) * 50, y + Math.sin(a) * 50 - 34, x + Math.cos(a) * (70 + wob), y + Math.sin(a) * (70 + wob)); g.stroke();
  }
  g.restore();
}

function canalGlints(g: G, view: ThemeView, t: number) {
  for (const flip of [false, true]) for (const [x0, x1] of CANAL.runs) {
    const ax = flip ? SIZE - x1 : x0, bx = flip ? SIZE - x0 : x1, y0 = flip ? SIZE - CANAL.y - CANAL.h : CANAL.y;
    if (!inView(view, (ax + bx) / 2, y0 + 100, (bx - ax) / 2 + 100)) continue;
    for (let x = ax + 30; x < bx - 20; x += 70) {
      const k = hash(x, y0), u = reduced ? 0.5 : (t * 0.00025 + k) % 1;
      const gx = x + (flip ? -1 : 1) * u * 40, gy = y0 + 30 + k * (CANAL.h - 60);
      g.fillStyle = `rgba(200, 235, 240, ${(0.35 * Math.sin(u * Math.PI)).toFixed(3)})`; g.fillRect(gx, gy, 14, 2.5);
    }
  }
}

export function oldtownUnder(g: G, now: number, view: ThemeView, map: MapDef): void {
  const t = clock(now);
  for (const s of sources(map)) {
    if (!inView(view, s.x, s.y, s.radius + 120)) continue;
    setLight(s.key, { x: s.x, y: s.y, radius: s.radius, color: s.color, intensity: s.intensity, ...(s.flicker !== undefined && !reduced && { flicker: s.flicker }), ...(s.size !== undefined && { size: s.size }), shadows: s.shadows ?? false });
  }
  for (const p of [{ x: FOUNTAIN.x, y: FOUNTAIN.y }, turn(FOUNTAIN.x, FOUNTAIN.y)]) if (inView(view, p.x, p.y, 160)) fountainWater(g, p.x, p.y, t);
  canalGlints(g, view, t);
}

/* ---------------------------------------------------------------- over: washing, lights, smoke, crowns, signs */

/** Washing lines strung across the alleys and the drying yard (west half; each has a twin). */
const LINES: readonly (readonly [number, number, number, number])[] = [
  [700, 130, 900, 150], [700, 440, 900, 420], [1500, 110, 1700, 130], [1500, 400, 1700, 380], [2200, 380, 2300, 400],
  [1260, 2940, 1500, 2940], [1260, 3120, 1500, 3120], [1260, 3320, 1500, 3320], [550, 3500, 700, 3480],
];
const CLOTHES = ['#efe6cf', '#d8e2ea', C.wool, C.woolBlue, '#f0d8a8', C.woolGreen, '#e8c8d0'] as const;

function washingLine(g: G, x0: number, y0: number, x1: number, y1: number, t: number) {
  const sag = 16, len = Math.hypot(x1 - x0, y1 - y0);
  const px = (u: number) => x0 + (x1 - x0) * u, py = (u: number) => y0 + (y1 - y0) * u + Math.sin(u * Math.PI) * sag;
  g.strokeStyle = 'rgba(28, 31, 38, 0.8)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + sag * 2, x1, y1); g.stroke();
  const n = Math.max(2, Math.floor(len / 34));
  for (let i = 1; i < n; i++) {
    const u = i / n, k = hash(Math.round(x0), Math.round(y0), i);
    if (k < 0.2) continue;
    const sway = reduced ? 0 : Math.sin(t * 0.0016 + i * 0.9 + x0) * 0.12;
    const w = 14 + k * 12, h = 18 + hash(i, Math.round(x1)) * 14;
    g.save(); g.translate(px(u), py(u)); g.rotate(sway);
    g.fillStyle = 'rgba(14, 16, 24, 0.22)'; g.fillRect(-w / 2 + 4, 6, w, h);
    g.fillStyle = CLOTHES[Math.floor(k * CLOTHES.length)]!;
    if (k > 0.85) { g.beginPath(); g.moveTo(-w / 2, 0); g.lineTo(w / 2, 0); g.lineTo(w / 2 - 2, h); g.lineTo(2, h); g.lineTo(0, h * 0.5); g.lineTo(-2, h); g.lineTo(-w / 2 + 2, h); g.closePath(); g.fill(); }
    else g.fillRect(-w / 2, 0, w, h);
    g.strokeStyle = 'rgba(28, 31, 38, 0.75)'; g.lineWidth = 1.4; g.strokeRect(-w / 2, 0, w, h);
    g.fillStyle = C.oakLo; g.fillRect(-w / 2 + 2, -2, 3, 4); g.fillRect(w / 2 - 5, -2, 3, 4);
    g.restore();
  }
}

function stringLights(g: G, t: number, flip: boolean) {
  const pts: [number, number][] = [[40, 620], [760, 700], [40, 820], [760, 900], [40, 1020]];
  const P = (p: [number, number]) => (flip ? turn(p[0], p[1]) : { x: p[0], y: p[1] });
  for (let i = 0; i < pts.length - 1; i++) {
    const a = P(pts[i]!), b = P(pts[i + 1]!);
    g.strokeStyle = 'rgba(28, 31, 38, 0.7)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(a.x, a.y); g.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + 20, b.x, b.y); g.stroke();
    for (let k = 1; k < 12; k++) {
      const u = k / 12, x = a.x + (b.x - a.x) * u, y = a.y + (b.y - a.y) * u + Math.sin(u * Math.PI) * 10;
      const on = reduced || Math.sin(t * 0.0011 + k * 1.7 + i) > -0.85;
      const col = ['#ffd27a', '#ff9a6a', '#bfe0ff', '#ffe6a8'][(k + i) % 4]!;
      g.fillStyle = on ? col : '#5a5048'; g.beginPath(); g.arc(x, y + 4, 4, 0, TAU); g.fill();
      if (on) { g.fillStyle = 'rgba(255, 220, 150, 0.18)'; g.beginPath(); g.arc(x, y + 4, 10, 0, TAU); g.fill(); }
    }
  }
}

function smoke(g: G, x: number, y: number, t: number, seed: number) {
  for (let k = 0; k < 4; k++) {
    const u = reduced ? (k + 0.5) / 4 : ((t * 0.00018 + seed + k / 4) % 1);
    const sx = x + u * 70 + Math.sin(u * 5 + seed * 9) * 8, sy = y - 26 - u * 60, r = 7 + u * 18;
    g.fillStyle = `rgba(150, 150, 160, ${(0.32 * (1 - u)).toFixed(3)})`; g.beginPath(); g.arc(sx, sy, r, 0, TAU); g.fill();
  }
}

const crownSprites = new Map<number, HTMLCanvasElement>();
function crown(i: number, twin: boolean): HTMLCanvasElement {
  const key = i * 2 + (twin ? 1 : 0);
  let c = crownSprites.get(key);
  if (c) return c;
  const R = 120, S = R * 2 + 20;
  c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.translate(S / 2, S / 2);
  g.fillStyle = 'rgba(14, 16, 24, 0.25)'; g.beginPath(); g.arc(10, 14, R - 6, 0, TAU); g.fill();
  const greens = twin ? ['#5a7a3a', '#6e8e44', '#4a6830', '#86a052'] : ['#4f7038', '#62843f', '#3f5c2c', '#7a9a4a'];
  for (let k = 0; k < 26; k++) {
    const a = hash(i, k, twin ? 3 : 1) * TAU, d = hash(i, k, 2) * (R - 40), r = 26 + hash(i, k, 4) * 22;
    g.fillStyle = greens[k % 4]!; g.beginPath(); g.arc(Math.cos(a) * d, Math.sin(a) * d, r, 0, TAU); g.fill();
  }
  g.fillStyle = 'rgba(255, 240, 200, 0.12)'; g.beginPath(); g.arc(-R * 0.3, -R * 0.3, R * 0.45, 0, TAU); g.fill();
  if (twin) for (let k = 0; k < 10; k++) { g.fillStyle = '#d9a83a'; g.beginPath(); g.arc((hash(i, k, 9) - 0.5) * R * 1.4, (hash(i, k, 8) - 0.5) * R * 1.4, 4, 0, TAU); g.fill(); }
  g.strokeStyle = 'rgba(28, 31, 38, 0.55)'; g.lineWidth = 2.4; g.beginPath(); g.arc(0, 0, R - 8, 0, TAU); g.stroke();
  crownSprites.set(key, c);
  return c;
}

/* signs */

type Plate = { text: string; x: number; y: number; kind: 'hang' | 'street' };
const plateSprites = new Map<string, HTMLCanvasElement>();
function plateSprite(text: string, kind: Plate['kind'], icon: string): HTMLCanvasElement {
  const key = `${text}|${kind}|${icon}`;
  let c = plateSprites.get(key);
  if (c) return c;
  const size = kind === 'street' ? 17 : 16, padX = 12, h = size + 12, iconW = icon ? 26 : 0;
  c = document.createElement('canvas');
  const g = c.getContext('2d')!;
  const font = `800 ${size}px ${FONT}`;
  g.font = font; (g as unknown as { letterSpacing: string }).letterSpacing = '1.5px';
  const w = Math.ceil(g.measureText(text).width) + padX * 2 + iconW;
  c.width = w + 10; c.height = h + 24;
  g.font = font; (g as unknown as { letterSpacing: string }).letterSpacing = '1.5px';
  if (kind === 'hang') {
    // a wrought-iron bracket with a scroll, two chains and a painted board
    g.strokeStyle = C.ink; g.lineWidth = 3; g.beginPath(); g.moveTo(2, 3); g.lineTo(w + 6, 3); g.stroke();
    g.beginPath(); g.arc(12, 11, 7, Math.PI, Math.PI * 2.4); g.stroke();
    g.lineWidth = 1.6; g.beginPath(); g.moveTo(14, 3); g.lineTo(14, 14); g.moveTo(w - 6, 3); g.lineTo(w - 6, 14); g.stroke();
  } else {
    g.strokeStyle = C.ink; g.lineWidth = 3; g.beginPath(); g.moveTo(14, 0); g.lineTo(14, 14); g.moveTo(w - 6, 0); g.lineTo(w - 6, 14); g.stroke();
  }
  g.fillStyle = 'rgba(20, 24, 32, 0.3)'; g.fillRect(7, 17, w, h);
  g.fillStyle = kind === 'street' ? '#2f4a6a' : '#5a3a22'; g.fillRect(4, 14, w, h);
  g.strokeStyle = kind === 'street' ? '#e2dccb' : C.brass; g.lineWidth = 1.6; g.strokeRect(7, 17, w - 6, h - 6);
  g.strokeStyle = C.ink; g.lineWidth = 2; g.strokeRect(4, 14, w, h);
  g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(4, 14, w, 3);
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = kind === 'street' ? '#ece6d6' : '#f2dca0';
  g.fillText(text, 4 + iconW + (w - iconW) / 2, 14 + h / 2 + 1);
  if (icon) drawIcon(g, 4 + 16, 14 + h / 2, icon);
  plateSprites.set(key, c);
  return c;
}

/** Little painted trade icons on the hanging boards. */
function drawIcon(g: G, x: number, y: number, icon: string) {
  g.save(); g.translate(x, y); g.strokeStyle = '#f2dca0'; g.fillStyle = '#f2dca0'; g.lineWidth = 2; g.lineCap = 'round';
  switch (icon) {
    case 'tankard': g.fillRect(-6, -6, 10, 13); g.beginPath(); g.arc(5, 0, 4, -1.4, 1.4); g.stroke(); g.fillStyle = '#fff4dc'; g.fillRect(-7, -9, 12, 4); break;
    case 'pretzel': g.beginPath(); g.moveTo(-6, 6); g.bezierCurveTo(-12, -4, -6, -9, 0, -1); g.bezierCurveTo(6, -9, 12, -4, 6, 6); g.moveTo(-6, 6); g.lineTo(4, -2); g.moveTo(6, 6); g.lineTo(-4, -2); g.stroke(); break;
    case 'knife': g.beginPath(); g.moveTo(-8, 6); g.lineTo(6, -8); g.stroke(); g.fillRect(-9, 4, 4, 4); break;
    case 'mortar': g.beginPath(); g.moveTo(-7, -2); g.lineTo(7, -2); g.lineTo(4, 7); g.lineTo(-4, 7); g.closePath(); g.fill(); g.beginPath(); g.moveTo(2, -2); g.lineTo(8, -9); g.stroke(); break;
    case 'book': g.fillRect(-7, -6, 14, 12); g.strokeStyle = '#5a3a22'; g.beginPath(); g.moveTo(0, -6); g.lineTo(0, 6); g.stroke(); break;
    case 'cup': g.beginPath(); g.moveTo(-6, -4); g.lineTo(5, -4); g.lineTo(3, 6); g.lineTo(-4, 6); g.closePath(); g.fill(); g.beginPath(); g.arc(6, 0, 3, -1.4, 1.4); g.stroke(); break;
    case 'shirt': g.beginPath(); g.moveTo(-8, -4); g.lineTo(-3, -7); g.lineTo(3, -7); g.lineTo(8, -4); g.lineTo(6, 0); g.lineTo(4, -1); g.lineTo(4, 7); g.lineTo(-4, 7); g.lineTo(-4, -1); g.lineTo(-6, 0); g.closePath(); g.fill(); break;
    case 'key': g.beginPath(); g.arc(-4, 0, 4, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(0, 0); g.lineTo(9, 0); g.moveTo(6, 0); g.lineTo(6, 4); g.stroke(); break;
    case 'scales': g.beginPath(); g.moveTo(0, -8); g.lineTo(0, 7); g.moveTo(-8, -5); g.lineTo(8, -5); g.stroke(); g.beginPath(); g.arc(-7, 1, 3.5, 0, Math.PI); g.arc(7, 1, 3.5, 0, Math.PI); g.fill(); break;
    case 'barrel': g.beginPath(); g.ellipse(0, 0, 6, 8, 0, 0, TAU); g.fill(); g.strokeStyle = '#5a3a22'; g.beginPath(); g.moveTo(-6, -3); g.lineTo(6, -3); g.moveTo(-6, 3); g.lineTo(6, 3); g.stroke(); break;
    case 'anvil': g.beginPath(); g.moveTo(-9, -4); g.lineTo(6, -4); g.lineTo(9, -1); g.lineTo(3, 1); g.lineTo(3, 6); g.lineTo(-4, 6); g.lineTo(-4, 1); g.lineTo(-9, 1); g.closePath(); g.fill(); break;
    case 'horse': g.beginPath(); g.arc(0, 0, 7, 0.6, TAU - 0.6); g.stroke(); break;
    case 'horn': g.beginPath(); g.moveTo(-8, 2); g.quadraticCurveTo(0, -6, 7, -4); g.lineTo(7, 6); g.quadraticCurveTo(0, 2, -8, 4); g.closePath(); g.fill(); break;
    case 'cross': g.fillRect(-1.5, -8, 3, 16); g.fillRect(-6, -4, 12, 3); break;
    case 'bell': g.beginPath(); g.moveTo(-7, 5); g.quadraticCurveTo(-6, -8, 0, -8); g.quadraticCurveTo(6, -8, 7, 5); g.closePath(); g.fill(); break;
    case 'cloth': for (let i = 0; i < 3; i++) g.fillRect(-7, -6 + i * 5, 14, 3); break;
    case 'grain': g.beginPath(); g.moveTo(0, 8); g.lineTo(0, -8); g.stroke(); for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(-3, -5 + i * 4, 2, 3, -0.5, 0, TAU); g.ellipse(3, -5 + i * 4, 2, 3, 0.5, 0, TAU); g.fill(); } break;
    case 'stamp': g.fillRect(-6, -6, 12, 9); g.strokeStyle = '#5a3a22'; g.beginPath(); g.moveTo(-6, -6); g.lineTo(0, -1); g.lineTo(6, -6); g.stroke(); break;
    case 'tea': g.beginPath(); g.ellipse(0, 1, 7, 5, 0, 0, TAU); g.fill(); g.fillRect(-2, -7, 4, 3); g.beginPath(); g.moveTo(6, 0); g.lineTo(10, -3); g.stroke(); break;
    case 'goose': g.beginPath(); g.ellipse(-1, 3, 7, 4, 0, 0, TAU); g.fill(); g.beginPath(); g.moveTo(4, 2); g.quadraticCurveTo(6, -6, 9, -6); g.stroke(); break;
    case 'bath': g.beginPath(); g.moveTo(-8, -1); g.lineTo(8, -1); g.quadraticCurveTo(8, 6, 0, 6); g.quadraticCurveTo(-8, 6, -8, -1); g.fill(); g.beginPath(); g.moveTo(-6, -2); g.lineTo(-6, -7); g.lineTo(-2, -7); g.stroke(); break;
    case 'needle': g.beginPath(); g.moveTo(-8, 7); g.lineTo(7, -8); g.stroke(); g.beginPath(); g.arc(5, -5, 3, 0, TAU); g.stroke(); break;
  }
  g.restore();
}

const ICONS: Readonly<Record<string, readonly [string, string]>> = {
  church: ['cross', 'bell'], tavern: ['tankard', 'goose'], bakery: ['pretzel', 'knife'], weaver: ['cloth', 'needle'], apothecary: ['mortar', 'book'],
  guild: ['scales', 'key'], cafe: ['cup', 'tea'], laundry: ['shirt', 'bath'], merchant: ['scales', 'stamp'], counting: ['key', 'scales'],
  clothhall: ['cloth', 'grain'], cooper: ['barrel', 'anvil'], stable: ['horse', 'horse'], posthouse: ['horn', 'stamp'],
};

type Cache = { plates: Plate[]; icons: string[]; chimneys: { x: number; y: number; x0: number; y0: number; x1: number; y1: number }[] };
const overCaches = new Map<string, Cache>();
function overCache(map: MapDef): Cache {
  let c = overCaches.get(map.name);
  if (c) return c;
  const plates: Plate[] = [], icons: string[] = [];
  for (const p of Object.values(ROOMS)) {
    if (!p.sign) continue;
    plates.push({ text: p.name, x: p.sign[0], y: p.sign[1], kind: 'hang' }); icons.push(ICONS[p.id]?.[0] ?? '');
    const t = turn(p.sign[0], p.sign[1]);
    plates.push({ text: p.twin, x: t.x, y: t.y, kind: 'hang' }); icons.push(ICONS[p.id]?.[1] ?? '');
  }
  for (const y of YARDS) {
    if (!y.label) continue;
    plates.push({ text: y.name, x: y.label[0], y: y.label[1], kind: 'street' }); icons.push('');
    if (y.id !== 'market') { const t = turn(y.label[0], y.label[1]); plates.push({ text: y.twin, x: t.x, y: t.y, kind: 'street' }); icons.push(''); }
  }
  plates.push({ text: 'MARKET SQUARE', x: 3000, y: 2565, kind: 'street' }, { text: 'THE CANAL', x: 1400, y: 1155, kind: 'street' }, { text: 'THE CANAL', x: 4600, y: 4655, kind: 'street' });
  icons.push('', '', '');
  c = { plates, icons, chimneys: chimneysOf(map.roofs ?? []) };
  overCaches.set(map.name, c);
  return c;
}

export function oldtownOver(g: G, now: number, view: ThemeView, map: MapDef, bodies: readonly { x: number; y: number }[] = []): void {
  const t = clock(now);
  const { plates, icons, chimneys } = overCache(map);
  for (const [x0, y0, x1, y1] of LINES) {
    if (inView(view, (x0 + x1) / 2, (y0 + y1) / 2, 260)) washingLine(g, x0, y0, x1, y1, t);
    const a = turn(x0, y0), b = turn(x1, y1);
    if (inView(view, (a.x + b.x) / 2, (a.y + b.y) / 2, 260)) washingLine(g, b.x, b.y, a.x, a.y, t + 700);
  }
  if (inView(view, 400, 820, 520)) stringLights(g, t, false);
  if (inView(view, SIZE - 400, SIZE - 820, 520)) stringLights(g, t, true);
  for (const [i, ch] of chimneys.entries()) {
    if (!inView(view, ch.x, ch.y - 60, 120)) continue;
    // under a ghosted roof (someone is inside) the smoke would hang in the room, so it waits
    if (bodies.some((b) => b.x >= ch.x0 && b.x < ch.x1 && b.y >= ch.y0 && b.y < ch.y1)) continue;
    smoke(g, ch.x, ch.y, t, hash(i, 5));
  }
  TREES.forEach(([x, y], i) => {
    for (const twin of [false, true]) {
      const p = twin ? turn(x, y) : { x, y };
      if (!inView(view, p.x, p.y, 150)) continue;
      const under = bodies.some((b) => Math.hypot(b.x - p.x, b.y - p.y) < 150);
      const img = crown(i, twin);
      g.save(); g.globalAlpha = under ? 0.3 : 0.92;
      const sway = reduced ? 0 : Math.sin(t * 0.0007 + i) * 2;
      g.drawImage(img, p.x - img.width / 2 + sway, p.y - img.height / 2 - 30);
      g.restore();
    }
  });
  plates.forEach((p, i) => {
    if (!inView(view, p.x, p.y, 180)) return;
    const img = plateSprite(p.text, p.kind, icons[i]!);
    const swing = p.kind === 'hang' && !reduced ? Math.sin(t * 0.0011 + p.x) * 0.03 : 0;
    g.save(); g.translate(p.x, p.y); g.rotate(swing); g.drawImage(img, -img.width / 2, -14); g.restore();
  });
}
