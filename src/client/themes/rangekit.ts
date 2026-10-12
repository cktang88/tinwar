import { MAPS } from '../../shared/maps.ts';
import { INK } from '../palette.ts';

/**
 * Shared bits of the shooting range's theme: its palette (an army training range in olive drab, khaki, sandbag and earth, with
 * range-flag red and safety yellow), the map's own layout, and small drawing helpers. Nothing here touches the DOM except `bake`,
 * which makes one offscreen canvas.
 */
export const RANGE_DEF = MAPS.range;
export const LAYOUT = RANGE_DEF.range!;
export const SIZE = RANGE_DEF.size;
export const LINE = LAYOUT.line;
export const TAU = Math.PI * 2;
export const FONT = (px: number, weight = 800) => `${weight} ${px}px "Barlow Condensed", "Arial Narrow", sans-serif`;

export const C = {
  ink: INK,
  // ground
  earth: '#6f6650', earthHi: '#80765c', earthLo: '#5c5442', mud: '#4c4536', dust: '#9a8c6c',
  grass: '#5e6a3e', grassHi: '#76844c', grassLo: '#48532f', dry: '#8f8754',
  gravel: '#8c877a', gravelHi: '#a7a294', gravelLo: '#6c685e',
  slab: '#8a877e', slabHi: '#9b988e', slabLo: '#706d65', sand: '#c2ab7c', sandHi: '#d4bf92', sandLo: '#a08a5e',
  scorch: '#2a2620',
  // kit
  olive: '#5f6a44', oliveHi: '#7a8656', oliveLo: '#454e30', oliveDeep: '#323920',
  khaki: '#b4a07a', khakiHi: '#cbb890', khakiLo: '#8e7d5a', bag: '#a8946a', bagHi: '#c2ae82', bagLo: '#7e6c4a',
  wood: '#8d6b44', woodHi: '#ac8656', woodLo: '#5e4630', ply: '#c9a878', plyHi: '#dcc092', plyLo: '#a58656',
  steel: '#7d8792', steelHi: '#a3adb8', steelLo: '#535b65', steelDark: '#3a4048', rubber: '#26292e',
  block: '#9a968a', blockHi: '#aeaa9c', blockLo: '#7a766c', blockFront: '#6e6a60',
  red: '#c23a2e', redHi: '#e85a48', redLo: '#7a2a20', yellow: '#e2b33a', yellowLo: '#a8822a', bone: '#e2dccb', paper: '#efe8d6', brass: '#d9b04a', brassLo: '#9a7a2e',
  glass: '#3a5468', glassHi: '#7da0b8', lamp: '#ffe2a8',
} as const;

/** Tiny deterministic hash to 0..1. */
export function hash(a: number, b = 0, c = 0): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** A seeded stream of 0..1 (mulberry32). */
export function seeded(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

type G = CanvasRenderingContext2D;

/** Draws `paint` translated to (`x`, `y`) and turned by `r`. */
export function at(g: G, x: number, y: number, r: number, paint: () => void) {
  g.save(); g.translate(x, y); g.rotate(r); paint(); g.restore();
}
/** A soft contact shadow on the floor. */
export function shade(g: G, x: number, y: number, rx: number, ry: number, a = 0.28) {
  g.fillStyle = `rgba(20, 16, 10, ${a})`; g.beginPath(); g.ellipse(x + 3, y + 4, rx, ry, 0, 0, TAU); g.fill();
}
/** A filled rect with an ink outline. */
export function box(g: G, x: number, y: number, w: number, h: number, fill: string, lw = 2) {
  g.fillStyle = fill; g.fillRect(x, y, w, h);
  if (lw) { g.strokeStyle = C.ink; g.lineWidth = lw; g.strokeRect(x, y, w, h); }
}
export function disc(g: G, x: number, y: number, r: number, fill: string, lw = 2) {
  g.fillStyle = fill; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  if (lw) { g.strokeStyle = C.ink; g.lineWidth = lw; g.stroke(); }
}
/** Centred lettering. */
export function text(g: G, s: string, x: number, y: number, px: number, fill: string, r = 0, alpha = 1, align: CanvasTextAlign = 'center') {
  g.save(); g.translate(x, y); g.rotate(r); g.globalAlpha *= alpha;
  g.font = FONT(px); g.textAlign = align; g.textBaseline = 'middle'; g.fillStyle = fill; g.fillText(s, 0, 0);
  g.restore();
}
/** Diagonal safety stripes inside a rect. */
export function hazard(g: G, x: number, y: number, w: number, h: number, a: string = C.yellow, b: string = C.ink, step = 12) {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = a; g.fillRect(x, y, w, h);
  g.fillStyle = b;
  for (let k = -h; k < w + h; k += step * 2) { g.beginPath(); g.moveTo(x + k, y + h); g.lineTo(x + k + step, y + h); g.lineTo(x + k + step + h, y); g.lineTo(x + k + h, y); g.closePath(); g.fill(); }
  g.restore();
}
/** A spent case lying on the floor. */
export function casing(g: G, x: number, y: number, r: number, len = 7) {
  at(g, x, y, r, () => { g.fillStyle = C.brassLo; g.fillRect(-len / 2, -1.6, len, 3.2); g.fillStyle = C.brass; g.fillRect(-len / 2, -1.6, len - 1.5, 1.6); });
}
/** An olive ammo can, its lid latch and its yellow stencil. */
export function ammoCan(g: G, x: number, y: number, r: number, w = 26, h = 14) {
  at(g, x, y, r, () => {
    shade(g, 0, 0, w / 2 + 2, h / 2 + 2, 0.25);
    box(g, -w / 2, -h / 2, w, h, C.olive, 1.4);
    g.fillStyle = C.oliveHi; g.fillRect(-w / 2 + 1, -h / 2 + 1, w - 2, 3);
    g.fillStyle = C.steelLo; g.fillRect(-3, -h / 2 - 2, 6, 4);
    g.fillStyle = C.yellow; g.fillRect(-w / 2 + 4, 0, w - 12, 2);
  });
}

export type Sprite = { canvas: HTMLCanvasElement; x: number; y: number };
/** Bakes `paint` (in world coordinates) into a canvas covering `x0,y0..x1,y1`, so a set piece costs one drawImage a frame. */
export function bake(x0: number, y0: number, x1: number, y1: number, paint: (g: G) => void, scale = 1): Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil((x1 - x0) * scale));
  canvas.height = Math.max(1, Math.ceil((y1 - y0) * scale));
  const g = canvas.getContext('2d')!;
  g.scale(scale, scale);
  g.translate(-x0, -y0);
  paint(g);
  return { canvas, x: x0, y: y0 };
}
