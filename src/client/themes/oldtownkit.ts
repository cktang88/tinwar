import type { Pt } from '../../shared/geom.ts';
import { MAPS, type MapWall } from '../../shared/maps.ts';
import { INK } from '../palette.ts';

/**
 * Shared bits of the Old Town theme: its palette, its places (each west-half building, yard and square, and the name its half
 * turn wears), a view of the map's own walls so a painter can tell which edges face open air, and small geometry helpers.
 * Nothing here touches the DOM except `bake`, which makes one offscreen canvas.
 */
export const OLDTOWN = MAPS.oldtown;
export const SIZE = OLDTOWN.size;
export const TAU = Math.PI * 2;

/** Warm limewash and dark oak, red clay roofs, grey-blue slate, mossy setts, canal green: all inside the art bible's muted kit. */
export const C = {
  ink: INK,
  // streets
  sett: '#6f675c', settHi: '#837a6c', settLo: '#5a5349', joint: '#3a352f', flag: '#7d776a', flagHi: '#908a7a', flagLo: '#666054',
  dirt: '#6a5a44', dirtLo: '#544736', gravel: '#857a66', grass: '#55683a', grassHi: '#6b8247', grassLo: '#43532f', moss: '#61784a',
  // water
  water: '#2f5560', waterHi: '#4a7a80', waterLo: '#1f3c46', quay: '#8d8676', quayLo: '#6a6458',
  // houses
  plaster: '#e2d6b8', plasterLo: '#c9bb98', plasterRose: '#e3c6b0', plasterOchre: '#dcc48e', plasterBlue: '#c9d0cc', plasterSage: '#c8cfae',
  beam: '#4a3220', beamHi: '#6a4a30', beamLo: '#2f1f14',
  stone: '#a39a88', stoneHi: '#b8af9c', stoneLo: '#857c6b', stoneFront: '#6a6356',
  // wood and cloth
  oak: '#8a5a34', oakHi: '#a8703f', oakLo: '#5f3d22', pine: '#b08a5a', pineLo: '#8a6a42',
  linen: '#e8e0cc', wool: '#b4524a', woolBlue: '#4a6a8e', woolGreen: '#6a8a4a', woolGold: '#c9a23c',
  awnRed: '#a8443a', awnGreen: '#4f7a52', awnBlue: '#3f5f86', awnGold: '#c9973a',
  // roofs
  tile: '#a85a3c', tileHi: '#c06a46', tileLo: '#7e412c', slate: '#56606e', slateHi: '#6c7888', slateLo: '#3e4652', shingle: '#7a6448', shingleLo: '#5a4834', copper: '#6a9a84',
  // metal and light
  iron: '#3d4450', ironHi: '#5a6270', brass: '#c9a24a', lamp: '#ffc46a', lampHot: '#ffe6a8', window: '#ffd27a', bread: '#c88a4a', breadHi: '#e0a860',
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

export const reduced = (() => { try { return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } })();
export const clock = (now: number): number => (reduced ? 4000 : now);

/** The half-turn twins carry a `~` on their ids. */
export const isTwin = (id: string | undefined): boolean => !!id && id.endsWith('~');
export const baseId = (id: string): string => (id.endsWith('~') ? id.slice(0, -1) : id);
export const turn = (x: number, y: number): Pt => ({ x: SIZE - x, y: SIZE - y });

/* ------------------------------------------------------------ places */

export type FloorKind = 'planks' | 'oak' | 'terracotta' | 'butcher' | 'checker' | 'parquet' | 'wetstone' | 'flags' | 'straw' | 'nave' | 'hall';
export type Place = { id: string; name: string; twin: string; floor: FloorKind; twinFloor?: FloorKind; light: string; twinLight?: string; sign?: readonly [number, number] };
/** Every roofed room by its roof id (west half): its name, its twin's, its floor and the colour of its lamps. `sign`: where its hanging sign is. */
export const ROOMS: Readonly<Record<string, Place>> = {
  church: { id: 'church', name: "ST. ALDRIC'S", twin: 'TOWN HALL', floor: 'nave', twinFloor: 'hall', light: '#ffd9a0', twinLight: '#ffe2b0', sign: [470, 2110] },
  tavern: { id: 'tavern', name: 'THE CROOKED TANKARD', twin: 'THE GOLDEN GOOSE', floor: 'oak', light: '#ffb45a', sign: [520, 590] },
  bakery: { id: 'bakery', name: 'BAKERY', twin: 'BUTCHER', floor: 'terracotta', twinFloor: 'butcher', light: '#ffc070', twinLight: '#fff0d0', sign: [1060, 640] },
  weaver: { id: 'weaver', name: 'WEAVER', twin: 'TAILOR', floor: 'planks', light: '#ffcf8a', sign: [1800, 540] },
  tall: { id: 'tall', name: 'HOUSE', twin: 'HOUSE', floor: 'planks', light: '#ffcf8a' },
  corner: { id: 'corner', name: 'HOUSE', twin: 'HOUSE', floor: 'planks', light: '#ffcf8a' },
  apothecary: { id: 'apothecary', name: 'APOTHECARY', twin: 'BOOKBINDER', floor: 'checker', light: '#bfe6b0', twinLight: '#ffd9a0', sign: [2110, 2040] },
  guild: { id: 'guild', name: 'GUILD HALL', twin: 'COUNCIL ROOM', floor: 'parquet', light: '#ffd9a0', sign: [2610, 2140] },
  cafe: { id: 'cafe', name: 'COFFEE HOUSE', twin: 'TEA ROOM', floor: 'checker', light: '#ffc880', sign: [2560, 2590] },
  laundry: { id: 'laundry', name: 'LAUNDRY', twin: 'BATHHOUSE', floor: 'wetstone', light: '#e6f0ff', twinLight: '#bfe8ff', sign: [700, 2840] },
  merchant: { id: 'merchant', name: "MERCHANT'S HOUSE", twin: 'NOTARY', floor: 'parquet', light: '#ffd9a0', sign: [1580, 2700] },
  archway: { id: 'archway', name: 'ARCHWAY', twin: 'ARCHWAY', floor: 'flags', light: '#ffc46a' },
  counting: { id: 'counting', name: 'COUNTING HOUSE', twin: 'PAWNBROKER', floor: 'planks', light: '#ffd9a0', sign: [2240, 3240] },
  clothhall: { id: 'clothhall', name: 'CLOTH HALL', twin: 'CORN EXCHANGE', floor: 'hall', light: '#ffd9a0', sign: [2460, 3570] },
  cottage1: { id: 'cottage1', name: 'HOUSE', twin: 'HOUSE', floor: 'planks', light: '#ffcf8a' },
  cottage2: { id: 'cottage2', name: 'HOUSE', twin: 'HOUSE', floor: 'planks', light: '#ffcf8a' },
  cooper: { id: 'cooper', name: 'COOPERAGE', twin: 'SMITHY', floor: 'straw', twinFloor: 'flags', light: '#ffb45a', twinLight: '#ff8a3a', sign: [1290, 3860] },
  stable: { id: 'stable', name: 'STABLES', twin: 'COACH HOUSE', floor: 'straw', light: '#ffc070', sign: [1760, 3660] },
  house_e1: { id: 'house_e1', name: 'HOUSE', twin: 'HOUSE', floor: 'planks', light: '#ffcf8a' },
  house_e2: { id: 'house_e2', name: 'HOUSE', twin: 'HOUSE', floor: 'planks', light: '#ffcf8a' },
  posthouse: { id: 'posthouse', name: 'POST HOUSE', twin: 'CUSTOMS HOUSE', floor: 'flags', light: '#ffd9a0', sign: [700, 5440] },
  house_s1: { id: 'house_s1', name: 'HOUSE', twin: 'HOUSE', floor: 'oak', light: '#ffcf8a' },
  house_s2: { id: 'house_s2', name: 'HOUSE', twin: 'HOUSE', floor: 'planks', light: '#ffcf8a' },
  house_s3: { id: 'house_s3', name: 'HOUSE', twin: 'HOUSE', floor: 'oak', light: '#ffcf8a' },
};
export const roomOf = (roofId: string): Place | undefined => ROOMS[baseId(roofId)];
export const nameOf = (roofId: string): string | undefined => { const p = roomOf(roofId); return p && (isTwin(roofId) ? p.twin : p.name); };
export const floorOf = (roofId: string): FloorKind | undefined => { const p = roomOf(roofId); return p && (isTwin(roofId) ? p.twinFloor ?? p.floor : p.floor); };

/** Open-air places (west half, rects in px) and their twins' names, for the ground and the street plates. */
export type Yard = { id: string; name: string; twin: string; x: number; y: number; w: number; h: number; ground: 'setts' | 'square' | 'garden' | 'dirt' | 'flags' | 'yard'; label?: readonly [number, number] };
export const YARDS: readonly Yard[] = [
  { id: 'beergarden', name: 'BEER GARDEN', twin: 'HOP GARDEN', x: 0, y: 550, w: 800, h: 550, ground: 'garden', label: [380, 1060] },
  { id: 'quay', name: 'FISH QUAY', twin: 'COAL QUAY', x: 800, y: 600, w: 2200, h: 600, ground: 'flags', label: [2400, 1130] },
  { id: 'churchyard', name: 'CHURCHYARD', twin: 'TOWN GARDEN', x: 0, y: 1400, w: 1950, h: 300, ground: 'garden' },
  { id: 'churchsq', name: 'CHURCH SQUARE', twin: 'TOWN HALL SQUARE', x: 550, y: 2300, w: 1800, h: 350, ground: 'square', label: [1250, 2350] },
  { id: 'gate', name: 'WEST GATE', twin: 'EAST GATE', x: 0, y: 2550, w: 550, h: 900, ground: 'flags', label: [280, 2560] },
  { id: 'dryingyard', name: 'DRYING YARD', twin: 'BATH YARD', x: 1150, y: 2800, w: 450, h: 650, ground: 'garden', label: [1375, 3420] },
  { id: 'market', name: 'MARKET SQUARE', twin: 'MARKET SQUARE', x: 2200, y: 2550, w: 1600, h: 900, ground: 'square' },
  { id: 'cartyard', name: 'CART YARD', twin: 'FORGE YARD', x: 1250, y: 3700, w: 350, h: 550, ground: 'yard' },
  { id: 'wellcourt', name: 'LINDEN COURT', twin: 'WELL COURT', x: 550, y: 4250, w: 1750, h: 900, ground: 'square', label: [1100, 4300] },
];
export const yardAt = (x: number, y: number): { yard: Yard; twin: boolean } | null => {
  const tw = x >= SIZE / 2;
  const px = tw ? SIZE - x : x, py = tw ? SIZE - y : y;
  for (const yd of YARDS) {
    if (yd.id === 'market') { if (x >= yd.x && x < yd.x + yd.w && y >= yd.y && y < yd.y + yd.h) return { yard: yd, twin: false }; continue; }
    if (px >= yd.x && px < yd.x + yd.w && py >= yd.y && py < yd.y + yd.h) return { yard: yd, twin: tw };
  }
  return null;
};

/* ------------------------------------------------------------ sprites */

export type Sprite = { canvas: HTMLCanvasElement; x: number; y: number; w: number; h: number };
/** Bakes `paint` (in world coordinates) into a canvas covering the box `x0,y0..x1,y1`, so a set piece costs one drawImage a frame. */
export function bake(x0: number, y0: number, x1: number, y1: number, paint: (g: CanvasRenderingContext2D) => void, scale = 1): Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil((x1 - x0) * scale));
  canvas.height = Math.max(1, Math.ceil((y1 - y0) * scale));
  const g = canvas.getContext('2d')!;
  g.scale(scale, scale);
  g.translate(-x0, -y0);
  paint(g);
  return { canvas, x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
export const blit = (g: CanvasRenderingContext2D, s: Sprite): void => { g.drawImage(s.canvas, s.x, s.y, s.w, s.h); };

export const boundsOf = (pts: readonly Pt[]) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  return { x0, y0, x1, y1 };
};

export const trace = (g: CanvasRenderingContext2D, pts: readonly Pt[]): void => {
  g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
  g.closePath();
};

/** A positive-area (clockwise on screen) copy of a polygon. */
export const wound = (pts: readonly Pt[]): Pt[] => {
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i]!, q = pts[(i + 1) % pts.length]!; a += p.x * q.y - q.x * p.y; }
  return a < 0 ? [...pts].reverse() : [...pts];
};

export const centroid = (pts: readonly Pt[]): Pt => ({ x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length });

/** A shape at (x, y) turned by `r`. */
export const at = (g: CanvasRenderingContext2D, x: number, y: number, r: number, paint: () => void): void => { g.save(); g.translate(x, y); g.rotate(r); paint(); g.restore(); };
export const shade = (g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, a = 0.32): void => { g.fillStyle = `rgba(14, 16, 24, ${a})`; g.beginPath(); g.ellipse(x + 3, y + 4, rx, ry, 0, 0, TAU); g.fill(); };
export const disc = (g: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, lw = 1.8): void => { g.fillStyle = fill; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); if (lw > 0) { g.strokeStyle = INK; g.lineWidth = lw; g.stroke(); } };
export const box = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, lw = 1.8): void => { g.fillStyle = fill; g.fillRect(x, y, w, h); if (lw > 0) { g.strokeStyle = INK; g.lineWidth = lw; g.strokeRect(x, y, w, h); } };

/* ------------------------------------------------------------ walls */

type Bucket = { rects: readonly MapWall[]; cells: Map<number, MapWall[]> };
const buckets = new Map<string, Bucket>();
const BK = 100;
const bkey = (cx: number, cy: number) => cx * 4096 + cy;

function bucketOf(material: string): Bucket {
  let b = buckets.get(material);
  if (b) return b;
  const rects = OLDTOWN.walls.filter((w) => w.material === material);
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
  const run = (len: number, isOpen: (t: number) => boolean): [number, number][] => {
    const out: [number, number][] = [];
    let from = -1;
    for (let t = 0; t < len; t += step) {
      const o = isOpen(t + step / 2);
      if (o && from < 0) from = t;
      if (!o && from >= 0) { out.push([from, t]); from = -1; }
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

/** The roofed room a point stands in, if any. */
export function roofAt(x: number, y: number): string | null {
  for (const r of OLDTOWN.roofs ?? []) {
    const b = boundsOf(r.points);
    if (x >= b.x0 && x < b.x1 && y >= b.y0 && y < b.y1) return r.id;
  }
  return null;
}

/** Light and shade as a pair of translucent colours, for cel steps. */
export const CEL = { light: 'rgba(255, 244, 214, 0.22)', dark: 'rgba(8, 10, 16, 0.3)' } as const;
