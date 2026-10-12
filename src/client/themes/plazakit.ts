import type { Pt } from '../../shared/geom.ts';
import { PLACES, PLAZA_SIZE, placeAt, type PlazaPlace, type PlazaStyle } from '../../shared/maps/plazageo.ts';
import { INK } from '../palette.ts';

/**
 * Shared bits of the Plaza theme: the downtown palette, hashing, offscreen baking, rect helpers and which place (and which side of
 * the half turn) a point belongs to. Nothing here touches the DOM at import time, so the ground worker can load it.
 */
export const TAU = Math.PI * 2;
export const SIZE = PLAZA_SIZE;
export { INK };

/** Granite, glass and painted steel under sodium and neon: cool greys with warm accents, inside the art bible's muted kit. */
export const C = {
  ink: INK,
  // ground
  pave: '#8a8a86', paveHi: '#9c9c97', paveLo: '#767672', joint: '#5f5f5c',
  asphalt: '#45474c', asphaltHi: '#505257', asphaltLo: '#3b3d42', kerb: '#a6a49c', kerbLo: '#6c6b66',
  line: '#e8e4d6', lineYellow: '#e0b43a', granite: '#9a958b', graniteLo: '#7d796f', graniteHi: '#b3ada1',
  grass: '#5e7e3e', grassHi: '#719449', grassLo: '#4b6831', gravel: '#a39a86', dirt: '#7e6a4e', dirtLo: '#5f4f3a', mud: '#4c4034',
  // materials
  concrete: '#9a9a94', concreteLo: '#6e6e69', concreteDk: '#55554f', steel: '#8d96a3', steelLo: '#5a626e', steelDk: '#3a404a',
  glass: '#7fb2c4', glassHi: '#c8e6ee', glassLo: '#3e6676', brick: '#9a4e3a', brickLo: '#6e3426', brickHi: '#b5654c',
  stone: '#c9bfa6', stoneLo: '#9c917a', render: '#d8d2c4', wood: '#9b6a3b', woodHi: '#b98652', woodLo: '#6a4526', oak: '#b08350',
  green: '#4f7a3a', greenHi: '#6f9a4a', greenLo: '#35562a', water: '#4f9ab0', waterHi: '#8fd0de', waterLo: '#2f6476',
  bronze: '#5f8a76', bronzeHi: '#8ab8a0', bronzeLo: '#3d5e50', yellow: '#e8b52e', yellowLo: '#a87e1a', hazard: '#1f2228',
  red: '#b8433a', blue: '#3a6ab0', teal: '#2f8a86', cream: '#efe6cf', white: '#eeeee8', plywood: '#c8a46a', navy: '#2a3a5c',
} as const;

export const hexA = (hex: string, a: number): string => {
  const v = parseInt(hex.slice(1), 16);
  return `rgba(${(v >> 16) & 255}, ${(v >> 8) & 255}, ${v & 255}, ${a})`;
};
export const mix = (hex: string, to: number, t: number): string => {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (to - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
};

/** `mix` as '#rrggbb', for light colours. */
export const mixHex = (hex: string, to: number, t: number): string => {
  const n = parseInt(hex.slice(1), 16);
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (to - v) * t).toString(16).padStart(2, '0')).join('')}`;
};

/** Tiny deterministic hash to 0..1. */
export function hash(a: number, b = 0, c = 0): number {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1440662683)) | 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export const hashStr = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

export const reduced = (() => { try { return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } })();
export const clock = (now: number): number => (reduced ? 4000 : now);

export const isTwin = (id: string | undefined): boolean => !!id && id.endsWith('~');
export const baseId = (id: string): string => (id.endsWith('~') ? id.slice(0, -1) : id);
export const turn = (p: Pt): Pt => ({ x: SIZE - p.x, y: SIZE - p.y });

export type Box = { x: number; y: number; w: number; h: number };
/** A west-half rect and its half turn. */
export const both = (r: Box): Box[] => [r, { x: SIZE - r.x - r.w, y: SIZE - r.y - r.h, w: r.w, h: r.h }];

/** What a point is: its place, side, name, style and accent. */
export type Here = { place: PlazaPlace | null; twin: boolean; style: PlazaStyle; name: string; accent: string };
export function hereAt(x: number, y: number): Here {
  const at = placeAt(x, y);
  if (!at) return { place: null, twin: x >= SIZE / 2, style: 'street', name: '', accent: '#ffe0a0' };
  const p = at.place;
  return { place: p, twin: at.twin, style: at.twin ? p.twinStyle : p.style, name: at.twin ? p.twinName : p.name, accent: at.twin ? p.twinAccent : p.accent };
}
/** Every place's rect on the map with its side, for painters that walk them all. */
export const placeRects = (): { p: PlazaPlace; twin: boolean; r: Box }[] =>
  PLACES.flatMap((p) => both(p).map((r, i) => ({ p, twin: i === 1, r })));

/* ------------------------------------------------------------ drawing helpers */

export type Sprite = { canvas: HTMLCanvasElement; x: number; y: number };
/** Bakes `paint` (world coordinates) into a canvas covering x0,y0..x1,y1, so a piece costs one drawImage a frame. */
export function bake(x0: number, y0: number, x1: number, y1: number, paint: (g: CanvasRenderingContext2D) => void): Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(x1 - x0));
  canvas.height = Math.max(1, Math.ceil(y1 - y0));
  const g = canvas.getContext('2d')!;
  g.translate(-x0, -y0);
  paint(g);
  return { canvas, x: x0, y: y0 };
}

export const trace = (g: CanvasRenderingContext2D, pts: readonly Pt[]) => {
  g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
  g.closePath();
};
export const boundsOf = (pts: readonly Pt[]) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  return { x0, y0, x1, y1 };
};
/** A positive-area (clockwise on screen) copy of a polygon. */
export const wound = (pts: readonly Pt[]): Pt[] => {
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i]!, q = pts[(i + 1) % pts.length]!; a += p.x * q.y - q.x * p.y; }
  return a < 0 ? [...pts].reverse() : [...pts];
};
/** South-facing edges of a positive-area polygon. */
export const southEdges = (pts: readonly Pt[]): [Pt, Pt][] => {
  const out: [Pt, Pt][] = [];
  for (let i = 0; i < pts.length; i++) { const a = pts[i]!, b = pts[(i + 1) % pts.length]!; if (b.x < a.x - 0.5) out.push([a, b]); }
  return out;
};

export function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
export const box = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, lw = 1.8) => {
  g.fillStyle = fill; g.fillRect(x, y, w, h); g.strokeStyle = INK; g.lineWidth = lw; g.strokeRect(x, y, w, h);
};
export const disc = (g: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, lw = 1.8) => {
  g.fillStyle = fill; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); if (lw > 0) { g.strokeStyle = INK; g.lineWidth = lw; g.stroke(); }
};
export const shade = (g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, a = 0.28) => {
  g.fillStyle = `rgba(14, 16, 22, ${a})`; g.beginPath(); g.ellipse(x + 3, y + 4, rx, ry, 0, 0, TAU); g.fill();
};
/** Lettering in the game's condensed face. */
export function letter(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, o: { weight?: number; align?: CanvasTextAlign; spacing?: number; rot?: number; alpha?: number } = {}) {
  g.save();
  g.translate(x, y); if (o.rot) g.rotate(o.rot);
  g.globalAlpha *= o.alpha ?? 1;
  g.font = `${o.weight ?? 800} ${size}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  (g as unknown as { letterSpacing: string }).letterSpacing = `${o.spacing ?? 2}px`;
  g.textAlign = o.align ?? 'center'; g.textBaseline = 'middle';
  g.fillStyle = color; g.fillText(text, 0, 0);
  g.restore();
}
export const inView = (v: { x0: number; y0: number; x1: number; y1: number }, x: number, y: number, r: number) => x + r >= v.x0 && x - r <= v.x1 && y + r >= v.y0 && y - r <= v.y1;
