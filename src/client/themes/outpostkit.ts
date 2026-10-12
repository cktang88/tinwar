import { MAPS, type MapWall } from '../../shared/maps.ts';
import { INK } from '../palette.ts';

/**
 * Shared bits of the Outpost theme (Firebase Bastion, a forward operating base at night under the horde): its palette (desert
 * dust, olive drab, HESCO tan, sodium floodlight and red alarm), a view of the map's own walls so a painter can tell which edges
 * face open air, the places the floor, the walls and the lights agree on, and small drawing helpers. Nothing here touches the
 * DOM, so the floor can be baked in the ground worker.
 */
export const OUTPOST = MAPS.outpost;
export const SIZE = OUTPOST.size;
export const MID = SIZE / 2;
export const TAU = Math.PI * 2;
export const FONT = (px: number, weight = 800) => `${weight} ${px}px "Barlow Condensed", "Arial Narrow", sans-serif`;

export const C = {
  ink: INK,
  // ground: dust outside the wire, packed gravel inside, the parade ground's concrete
  dust: '#6f6450', dustHi: '#82765f', dustLo: '#5a5142', dustDeep: '#4a4236', scrub: '#55603e', scrubHi: '#6c7a4c',
  gravel: '#77736a', gravelHi: '#8b877c', gravelLo: '#625e56', slab: '#7e7d78', slabHi: '#93918b', slabLo: '#66655f',
  road: '#5d574b', roadHi: '#6e675a', mud: '#4a4034',
  // kit
  hesco: '#b09a6c', hescoHi: '#c8b384', hescoLo: '#8a7650', mesh: '#5c5a52', fill: '#9a8358',
  bag: '#968a5c', bagHi: '#ada172', bagLo: '#746a44', bagDark: '#5c5436',
  olive: '#5d6a44', oliveHi: '#738256', oliveLo: '#46502f', oliveDark: '#343c24',
  canvas: '#6b7350', canvasHi: '#848c66', canvasLo: '#535a3c', white: '#d9d6c8', whiteHi: '#ecebe2', whiteLo: '#b2afa2',
  tan: '#a4916a', tanHi: '#bba882', tanLo: '#80704f',
  steel: '#6e757c', steelHi: '#959ca3', steelLo: '#4c5258', steelDark: '#33373c', rubber: '#24262a',
  wood: '#8a6a42', woodHi: '#a5824f', woodLo: '#64492c', crate: '#7a6a3e', crateHi: '#94834f', crateLo: '#5a4e2c',
  rust: '#7e4a2a', rustHi: '#9c6038', char: '#2a2522', charHi: '#3e3630', ash: '#5c5852', ember: '#ff8a3a',
  red: '#b0352a', redHi: '#d2493a', redLo: '#7a2219', blood: '#5e1414', bloodHi: '#7e1d1a', yellow: '#d6b03a', yellowLo: '#9c7e24',
  lamp: '#ffe6a8', sodium: '#ffc870', alarm: '#ff3b2e', paint: '#e8e2cc', paintDim: 'rgba(236, 230, 208, 0.8)',
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
/** A seeded generator, for the floor's scatter. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ------------------------------------------------------------ places */

/** The places the floor paints, the decor dresses and the lights light, by name. */
export const PLACE = {
  toc: { x: MID, y: MID },
  helipad: { x: 1700, y: 830, r: 120 },
  mess: { x: 875, y: 825 },
  comms: { x: 2075, y: 800 },
  mast: { x: 2225, y: 825 },
  depot: { x: 1150, y: 2150 },
  med: { x: 2175, y: 2150 },
  motor: { x: 2150, y: 1350 },
  fuel: { x: 1925, y: 2200 },
  ammo: { x: 800, y: 2175 },
  barracks: { x: 825, y: 1275 },
  barracks2: { x: 825, y: 1925 },
  alpha: { x: 1350, y: 330 },
  bravo: { x: 1650, y: 2650 },
  drop: { x: 360, y: 360 },
  convoy: { x: 2650, y: 1350 },
  heli: { x: 330, y: 1350 },
  tower: { x: 2600, y: 2600 },
  pit: { x: 420, y: 2700 },
  apc: { x: 2600, y: 300 },
} as const;
/** The four watchtowers on the corners of the wire. */
export const TOWERS = [{ x: 600, y: 600 }, { x: 2400, y: 600 }, { x: 2400, y: 2400 }, { x: 600, y: 2400 }] as const;
/** Each side's main gate (centre, and the unit step out through it) and its breach; the north side's turned round the map. */
const turnQ = (p: { x: number; y: number }) => ({ x: SIZE - p.y, y: p.x });
const quarters = (p: { x: number; y: number }) => { const out = [p]; for (let i = 0; i < 3; i++) out.push(turnQ(out[i]!)); return out; };
export const GATES = quarters({ x: 1350, y: 625 });
export const BREACHES = quarters({ x: 1975, y: 625 });
export const OUT_DIRS = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }] as const;
export const GATE_NAMES = ['NORTH GATE', 'EAST GATE', 'SOUTH GATE', 'WEST GATE'] as const;

/* ------------------------------------------------------------ drawing */

export const rr = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, k: number) => { g.beginPath(); g.roundRect(x, y, w, h, k); };
export const at = (g: CanvasRenderingContext2D, x: number, y: number, r: number, paint: () => void) => { g.save(); g.translate(x, y); g.rotate(r); paint(); g.restore(); };
/** A soft contact shadow under a prop. */
export const shade = (g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, a = 0.3) => { g.fillStyle = `rgba(12, 12, 16, ${a})`; g.beginPath(); g.ellipse(x + 3, y + 4, rx, ry, 0, 0, TAU); g.fill(); };
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
export function hazard(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, band = 10, a: string = C.yellow, b: string = C.ink) {
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
  const rects = OUTPOST.walls.filter((w) => w.material === material);
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
/** Whether a point is inside a wall of one of these materials (all of them when none is named). */
export function insideWall(material: string, x: number, y: number): boolean {
  const list = bucketOf(material).cells.get(bkey(Math.floor(x / BK), Math.floor(y / BK)));
  return !!list?.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
}
export type Open = { n: boolean; e: boolean; s: boolean; w: boolean; spans: Record<'n' | 'e' | 's' | 'w', [number, number][]> };
const exposures = new Map<string, Open>();
/** Which sides of this rect face open air rather than another wall of the same material (or of `joins`), and which stretches. */
export function openSides(material: string, r: { x: number; y: number; w: number; h: number }, joins: readonly string[] = []): Open {
  const key = `${material}${r.x},${r.y},${r.w},${r.h}`;
  const known = exposures.get(key);
  if (known) return known;
  const step = 5;
  const solid = (x: number, y: number) => insideWall(material, x, y) || joins.some((m) => insideWall(m, x, y));
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
    n: run(r.w, (t) => !solid(r.x + t, r.y - 2)),
    s: run(r.w, (t) => !solid(r.x + t, r.y + r.h + 2)),
    w: run(r.h, (t) => !solid(r.x - 2, r.y + t)),
    e: run(r.h, (t) => !solid(r.x + r.w + 2, r.y + t)),
  };
  const open: Open = { n: spans.n.length > 0, e: spans.e.length > 0, s: spans.s.length > 0, w: spans.w.length > 0, spans };
  exposures.set(key, open);
  return open;
}
export const CEL = { light: 'rgba(255, 244, 220, 0.2)', dark: 'rgba(8, 10, 16, 0.3)' } as const;
