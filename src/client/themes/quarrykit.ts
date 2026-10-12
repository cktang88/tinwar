import type { Pt } from '../../shared/geom.ts';
import { MAPS, type MapWall } from '../../shared/maps.ts';
import { PIT } from '../../shared/maps/quarrygeo.ts';
import { INK } from '../palette.ts';

/**
 * Shared bits of the Quarry theme: its palette (wet limestone, dust, hi-vis yellow and safety orange under a storm sky), the
 * pit's benches as a function of position, a view of the map's own walls so a painter can tell which edges face open air, and
 * small geometry helpers. Nothing here touches the DOM except `bake`, which makes one offscreen canvas.
 */
export const QUARRY = MAPS.quarry;
export const SIZE = QUARRY.size;
export const TAU = Math.PI * 2;
export const FONT = (px: number, weight = 800) => `${weight} ${px}px "Barlow Condensed", "Arial Narrow", sans-serif`;

export const C = {
  ink: INK,
  // ground, from the upper works down to the pit floor
  dirt: '#7a705f', dirtHi: '#8c8270', dirtLo: '#635b4d', mud: '#4e463b', grass: '#5e6b40', grassHi: '#7a8a4e',
  bench1: '#9a968a', bench1Hi: '#aeaa9c', bench2: '#878479', bench2Hi: '#9a978b', floor: '#6f7276', floorHi: '#828589', floorLo: '#5c5f63',
  concrete: '#8f8c84', concreteHi: '#a3a097', concreteLo: '#767369', puddle: '#4a5a66', puddleHi: '#7d95a4',
  rock: '#8a8478', rockHi: '#a7a194', rockLo: '#625d53', rockDeep: '#46423b', strata: '#77715f',
  lime: '#d7cfb6', limeHi: '#e8e2cc', limeLo: '#b4aa8e', limeDeep: '#8e866e', sawn: '#cbc2a6',
  gravel: '#9b968b', gravelHi: '#b9b4a8', gravelLo: '#6e6a61', sand: '#b8a27a',
  // plant and kit
  hivis: '#e2b33a', hivisHi: '#f2cd5e', hivisLo: '#a8822a', orange: '#d9682a', orangeHi: '#ef8a4a', red: '#b8432f', redLo: '#7a2a20',
  steel: '#7d8792', steelHi: '#a3adb8', steelLo: '#535b65', steelDark: '#3a4048', rust: '#9a5530', rubber: '#26292e',
  cabin: '#d8d4c8', cabinHi: '#ebe8de', cabinLo: '#a9a597', cabinBlue: '#3f6a8e', cabinGreen: '#4e7a5a',
  shed: '#5f7a6a', shedHi: '#7a9686', shedLo: '#44584c', bone: '#e2dccb', wood: '#8d6b44', woodHi: '#ac8656', woodLo: '#5e4630',
  water: '#3e5e66', waterHi: '#6e94a0', waterLo: '#2a434a', glass: '#3a5468', lamp: '#ffe2a8',
} as const;

export const hexA = (hex: string, a: number): string => {
  const v = parseInt(hex.slice(1), 16);
  return `rgba(${(v >> 16) & 255}, ${(v >> 8) & 255}, ${v & 255}, ${a})`;
};

/** Tiny deterministic hash to 0..1. */
export function hash(a: number, b = 0, c = 0): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export const hashStr = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
};

/** Half-turn twins carry a `~` on their ids: the east half, dressed as the other place of each pair. */
export const isTwin = (id: string | undefined): boolean => !!id && id.endsWith('~');
export const baseId = (id: string): string => (id.endsWith('~') ? id.slice(0, -1) : id);
export const turn = <T extends { x: number; y: number }>(p: T): T => ({ ...p, x: SIZE - p.x, y: SIZE - p.y });
export const both = <T extends { x: number; y: number }>(list: readonly T[]): T[] => [...list, ...list.map(turn)];

/* ------------------------------------------------------------ the pit */

/** Where a point sits in the pit, on an oval scale: below 1 inside that oval. */
export const ovalAt = (x: number, y: number, o: { rx: number; ry: number }): number => Math.hypot((x - PIT.x) / o.rx, (y - PIT.y) / o.ry);
/** Which level a point is on: 0 the upper works, 1 the top bench, 2 the middle bench, 3 the pit floor. */
export const levelAt = (x: number, y: number): 0 | 1 | 2 | 3 => (ovalAt(x, y, PIT.floor) < 1 ? 3 : ovalAt(x, y, PIT.mid) < 1 ? 2 : ovalAt(x, y, PIT.rim) < 1 ? 1 : 0);
export const ovalPt = (o: { rx: number; ry: number }, a: number, inset = 0): Pt => ({ x: PIT.x + (o.rx - inset) * Math.cos(a), y: PIT.y + (o.ry - inset) * Math.sin(a) });
/** Traces a whole oval (inset px inside it). */
export function ovalPath(g: CanvasRenderingContext2D, o: { rx: number; ry: number }, inset = 0) {
  g.ellipse(PIT.x, PIT.y, o.rx - inset, o.ry - inset, 0, 0, TAU);
}

/* ------------------------------------------------------------ sprites and shapes */

export type Sprite = { canvas: HTMLCanvasElement; x: number; y: number };
/** Bakes `paint` (in world coordinates) into a canvas covering `x0,y0..x1,y1`, so a set piece costs one drawImage a frame. */
export function bake(x0: number, y0: number, x1: number, y1: number, paint: (g: CanvasRenderingContext2D) => void, scale = 1): Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil((x1 - x0) * scale));
  canvas.height = Math.max(1, Math.ceil((y1 - y0) * scale));
  const g = canvas.getContext('2d')!;
  g.scale(scale, scale);
  g.translate(-x0, -y0);
  paint(g);
  return { canvas, x: x0, y: y0 };
}

export const boundsOf = (pts: readonly Pt[]) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  return { x0, y0, x1, y1 };
};
export const trace = (g: CanvasRenderingContext2D, pts: readonly Pt[]) => {
  g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
  g.closePath();
};
/** A positive-area (clockwise on screen) copy of a polygon, so edge tests agree on which side faces the light. */
export const wound = (pts: readonly Pt[]): Pt[] => {
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i]!, q = pts[(i + 1) % pts.length]!; a += p.x * q.y - q.x * p.y; }
  return a < 0 ? [...pts].reverse() : [...pts];
};
/** South-facing edges of a positive-area polygon: the ones that run leftward on screen (matches geoart.ts). */
export const southEdges = (pts: readonly Pt[]): [Pt, Pt][] => {
  const out: [Pt, Pt][] = [];
  for (let i = 0; i < pts.length; i++) { const a = pts[i]!, b = pts[(i + 1) % pts.length]!; if (b.x < a.x - 0.5) out.push([a, b]); }
  return out;
};
export const rr = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, k: number) => { g.beginPath(); g.roundRect(x, y, w, h, k); };
export const at = (g: CanvasRenderingContext2D, x: number, y: number, r: number, paint: () => void) => { g.save(); g.translate(x, y); g.rotate(r); paint(); g.restore(); };
/** A soft contact shadow under a prop. */
export const shade = (g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, a = 0.3) => { g.fillStyle = `rgba(16, 18, 24, ${a})`; g.beginPath(); g.ellipse(x + 3, y + 4, rx, ry, 0, 0, TAU); g.fill(); };
export const disc = (g: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, lw = 1.8) => { g.fillStyle = fill; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); if (lw) { g.strokeStyle = C.ink; g.lineWidth = lw; g.stroke(); } };
export const box = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, lw = 1.8) => { g.fillStyle = fill; g.fillRect(x, y, w, h); if (lw) { g.strokeStyle = C.ink; g.lineWidth = lw; g.strokeRect(x, y, w, h); } };
/** Centred stencil lettering. */
export function text(g: CanvasRenderingContext2D, s: string, x: number, y: number, px: number, fill: string, rot = 0, spacing = 2) {
  g.save(); g.translate(x, y); g.rotate(rot);
  g.font = FONT(px); (g as unknown as { letterSpacing: string }).letterSpacing = `${spacing}px`;
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = fill; g.fillText(s, 0, 0);
  g.restore();
}
/** A rect of diagonal hazard stripes. */
export function hazard(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, band = 10, a: string = C.hivis, b: string = C.ink) {
  g.save();
  g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = a; g.fillRect(x, y, w, h);
  g.fillStyle = b; g.beginPath();
  for (let k = -h; k < w + h; k += band * 2) { g.moveTo(x + k, y + h); g.lineTo(x + k + band, y + h); g.lineTo(x + k + band + h, y); g.lineTo(x + k + h, y); g.closePath(); }
  g.fill();
  g.restore();
}

/* ------------------------------------------------------------ walls */

type Bucket = { rects: readonly MapWall[]; cells: Map<number, MapWall[]> };
const buckets = new Map<string, Bucket>();
const BK = 100;
const bkey = (cx: number, cy: number) => cx * 4096 + cy;
function bucketOf(material: string): Bucket {
  let b = buckets.get(material);
  if (b) return b;
  const rects = QUARRY.walls.filter((w) => w.material === material);
  const cells = new Map<number, MapWall[]>();
  for (const r of rects) {
    for (let cy = Math.floor(r.y / BK); cy <= Math.floor((r.y + r.h) / BK); cy++) {
      for (let cx = Math.floor(r.x / BK); cx <= Math.floor((r.x + r.w) / BK); cx++) {
        const k = bkey(cx, cy), list = cells.get(k);
        if (list) list.push(r); else cells.set(k, [r]);
      }
    }
  }
  buckets.set(material, (b = { rects, cells }));
  return b;
}
export const wallsOf = (material: string): readonly MapWall[] => bucketOf(material).rects;
export function insideWall(material: string, x: number, y: number): boolean {
  const list = bucketOf(material).cells.get(bkey(Math.floor(x / BK), Math.floor(y / BK)));
  return !!list?.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
}
export type Open = { n: boolean; e: boolean; s: boolean; w: boolean; spans: Record<'n' | 'e' | 's' | 'w', [number, number][]> };
const exposures = new Map<string, Open>();
/** Which sides of this rect face open air rather than another wall of the same material, and which stretches. */
export function openSides(material: string, r: { x: number; y: number; w: number; h: number }): Open {
  const key = `${material}${r.x},${r.y},${r.w},${r.h}`;
  const known = exposures.get(key);
  if (known) return known;
  const step = 5;
  const run = (len: number, atT: (t: number) => boolean): [number, number][] => {
    const out: [number, number][] = [];
    let from = -1;
    for (let t = 0; t < len; t += step) {
      const open = atT(t + step / 2);
      if (open && from < 0) from = t;
      if (!open && from >= 0) { out.push([from, t]); from = -1; }
    }
    if (from >= 0) out.push([from, len]);
    return out;
  };
  const spans = {
    n: run(r.w, (t) => !insideWall(material, r.x + t, r.y - 2)),
    s: run(r.w, (t) => !insideWall(material, r.x + t, r.y + r.h + 2)),
    w: run(r.h, (t) => !insideWall(material, r.x - 2, r.y + t)),
    e: run(r.h, (t) => !insideWall(material, r.x + r.w + 2, r.y + t)),
  };
  const open: Open = { n: spans.n.length > 0, e: spans.e.length > 0, s: spans.s.length > 0, w: spans.w.length > 0, spans };
  exposures.set(key, open);
  return open;
}
export const CEL = { light: 'rgba(255, 248, 228, 0.22)', dark: 'rgba(8, 10, 16, 0.3)' } as const;
