import type { MapPoly, MapRoof, Pt } from '../../shared/geom.ts';
import type { MapDef } from '../../shared/maps.ts';
import { TABLES, TREES, VEHICLES, VEHICLE_SIZE, type Vehicle } from '../../shared/maps/plazageo.ts';
import type { PlazaStyle } from '../../shared/maps/plazageo.ts';
import type { GeoInfo } from '../geoart.ts';
import { C, INK, TAU, bake, baseId, box, boundsOf, disc, hash, hashStr, hereAt, hexA, isTwin, letter, mix, rr, shade, southEdges, trace, wound, type Box, type Sprite } from './plazakit.ts';

/**
 * Every polygon of the Plaza, painted whole once into its own sprite: facade walls in the brick, stone, render or cladding of the
 * building they belong to (found from plazageo's PLACES), shop glass on its sill, counters, shelves and ovens dressed for the shop
 * (books in the library, files in the archive, pastries in the cafe, wine in the trattoria), the site's hoarding, scaffold, pallets
 * and cabin, the fountain basin, the statue, trees, the bus, the food trucks and the parked cars; and the roofs (deck, gravel,
 * green, copper, solar, glass). Each sprite costs one drawImage a frame.
 */
type G = CanvasRenderingContext2D;
type Open = { n: boolean; e: boolean; s: boolean; w: boolean; spans: Record<'n' | 'e' | 's' | 'w', [number, number][]> };

/* ------------------------------------------------------------------ neighbours: which edges meet open air */

const FAMILY: Record<string, string> = { pzwall: 'shell', pzglass: 'shell', pzhoard: 'hoard' };
const famOf = (m: string) => FAMILY[m] ?? m;
const famRects = new WeakMap<MapDef, Map<string, Box[]>>();
function rectsOf(map: MapDef, fam: string): Box[] {
  let byFam = famRects.get(map);
  if (!byFam) {
    byFam = new Map();
    for (const p of map.polys ?? []) {
      if (p.points.length !== 4 || !p.material.startsWith('pz')) continue;
      const b = boundsOf(p.points), f = famOf(p.material);
      (byFam.get(f) ?? byFam.set(f, []).get(f)!).push({ x: b.x0, y: b.y0, w: b.x1 - b.x0, h: b.y1 - b.y0 });
    }
    famRects.set(map, byFam);
  }
  return byFam.get(fam) ?? [];
}
function openSides(map: MapDef, material: string, r: Box): Open {
  const list = rectsOf(map, famOf(material));
  const solid = (x: number, y: number) => list.some((q) => x > q.x && x < q.x + q.w && y > q.y && y < q.y + q.h);
  const run = (len: number, at: (t: number) => boolean): [number, number][] => {
    const out: [number, number][] = [];
    let from = -1;
    for (let t = 0; t < len; t += 5) {
      const open = at(t + 2.5);
      if (open && from < 0) from = t;
      if (!open && from >= 0) { out.push([from, t]); from = -1; }
    }
    if (from >= 0) out.push([from, len]);
    return out;
  };
  const spans = {
    n: run(r.w, (t) => !solid(r.x + t, r.y - 2)), s: run(r.w, (t) => !solid(r.x + t, r.y + r.h + 2)),
    w: run(r.h, (t) => !solid(r.x - 2, r.y + t)), e: run(r.h, (t) => !solid(r.x + r.w + 2, r.y + t)),
  };
  return { n: spans.n.length > 0, e: spans.e.length > 0, s: spans.s.length > 0, w: spans.w.length > 0, spans };
}

/** A front face over each open stretch of the south edge; `paint` dresses the face inside a clip. */
function southFace(g: G, r: Box, o: Open, fh: number, fill: string, paint?: (q: Box) => void) {
  for (const [a, b] of o.spans.s) {
    const q = { x: r.x + a, y: r.y + r.h, w: b - a, h: fh };
    g.fillStyle = fill; g.fillRect(q.x, q.y, q.w, q.h);
    if (paint) { g.save(); g.beginPath(); g.rect(q.x, q.y, q.w, q.h); g.clip(); paint(q); g.restore(); }
    g.fillStyle = 'rgba(12, 14, 20, 0.28)'; g.fillRect(q.x, q.y + fh * 0.7, q.w, fh * 0.3);
    g.strokeStyle = INK; g.lineWidth = 2;
    g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(q.x, q.y + fh); g.lineTo(q.x + q.w, q.y + fh); g.lineTo(q.x + q.w, q.y); g.stroke();
  }
}
/** Light on open north and west edges, shade on south and east, and the ink line only where the edge meets air. */
function finish(g: G, r: Box, o: Open, band = 4) {
  g.fillStyle = 'rgba(255, 248, 230, 0.2)';
  for (const [a, b] of o.spans.n) g.fillRect(r.x + a, r.y, b - a, band);
  for (const [a, b] of o.spans.w) g.fillRect(r.x, r.y + a, band, b - a);
  g.fillStyle = 'rgba(8, 10, 16, 0.26)';
  for (const [a, b] of o.spans.s) g.fillRect(r.x + a, r.y + r.h - band, b - a, band);
  for (const [a, b] of o.spans.e) g.fillRect(r.x + r.w - band, r.y + a, band, b - a);
  g.strokeStyle = INK; g.lineWidth = 2; g.lineCap = 'square';
  g.beginPath();
  for (const [a, b] of o.spans.n) { g.moveTo(r.x + a, r.y); g.lineTo(r.x + b, r.y); }
  for (const [a, b] of o.spans.s) { g.moveTo(r.x + a, r.y + r.h); g.lineTo(r.x + b, r.y + r.h); }
  for (const [a, b] of o.spans.w) { g.moveTo(r.x, r.y + a); g.lineTo(r.x, r.y + b); }
  for (const [a, b] of o.spans.e) { g.moveTo(r.x + r.w, r.y + a); g.lineTo(r.x + r.w, r.y + b); }
  g.stroke();
  g.lineCap = 'butt';
}
const clipTo = (g: G, r: Box, paint: () => void) => { g.save(); g.beginPath(); g.rect(r.x, r.y, r.w, r.h); g.clip(); paint(); g.restore(); };

/* ------------------------------------------------------------------ facades */

type Facade = { kind: 'brick' | 'stone' | 'panel' | 'metal' | 'render' | 'concrete'; top: string; front: string };
const FACADE: Partial<Record<PlazaStyle, Facade>> = {
  garage: { kind: 'concrete', top: '#a3a39c', front: '#6c6c66' },
  lobby: { kind: 'metal', top: '#58606c', front: '#2f353e' },
  bank: { kind: 'stone', top: '#cfc5aa', front: '#8f8670' },
  cafe: { kind: 'brick', top: '#a9624a', front: '#6e3426' },
  trattoria: { kind: 'render', top: '#d49a6a', front: '#8e5a36' },
  library: { kind: 'stone', top: '#d6ccb0', front: '#968c74' },
  archive: { kind: 'stone', top: '#b8b4a8', front: '#7e7a70' },
  pharmacy: { kind: 'render', top: '#e2ded2', front: '#9a968a' },
  optician: { kind: 'panel', top: '#9ab0c4', front: '#5a6e80' },
  mart: { kind: 'panel', top: '#5f8f8a', front: '#36574f' },
  grocer: { kind: 'brick', top: '#8f6a4a', front: '#5a3e28' },
  bakery: { kind: 'brick', top: '#c49a6a', front: '#7e5a36' },
  noodles: { kind: 'render', top: '#c45a4a', front: '#7a2e24' },
  florist: { kind: 'render', top: '#d8b8c8', front: '#8e6e7e' },
  barber: { kind: 'panel', top: '#4a6a8a', front: '#2a3e54' },
  books: { kind: 'panel', top: '#3f6a4f', front: '#244030' },
  games: { kind: 'metal', top: '#5a4a7a', front: '#33284a' },
  thrift: { kind: 'brick', top: '#9a5a44', front: '#62362a' },
  phones: { kind: 'metal', top: '#4a5a64', front: '#2a343c' },
  pizza: { kind: 'brick', top: '#a4483a', front: '#6a2a20' },
  sushi: { kind: 'panel', top: '#3a3a40', front: '#202026' },
};
const DEFAULT_FACADE: Facade = { kind: 'concrete', top: '#a19f97', front: '#66655f' };

function facadeFront(g: G, q: Box, f: Facade, seed: number) {
  const { x, y, w, h } = q;
  if (f.kind === 'brick') {
    g.strokeStyle = 'rgba(20, 10, 6, 0.4)'; g.lineWidth = 1.2; g.beginPath();
    for (let yy = y + 4, k = 0; yy < y + h; yy += 4.5, k++) { g.moveTo(x, yy); g.lineTo(x + w, yy); for (let xx = x + (k % 2) * 7; xx < x + w; xx += 14) { g.moveTo(xx, yy - 4.5); g.lineTo(xx, yy); } }
    g.stroke();
  } else if (f.kind === 'stone') {
    g.strokeStyle = 'rgba(30, 26, 18, 0.35)'; g.lineWidth = 1.4; g.beginPath();
    g.moveTo(x, y + h / 2); g.lineTo(x + w, y + h / 2);
    for (let xx = x + 30; xx < x + w; xx += 44) { g.moveTo(xx, y); g.lineTo(xx, y + h / 2); g.moveTo(xx + 22, y + h / 2); g.lineTo(xx + 22, y + h); }
    g.stroke();
  } else if (f.kind === 'panel') {
    g.fillStyle = 'rgba(255,255,255,0.1)';
    for (let xx = x; xx < x + w; xx += 60) g.fillRect(xx + 2, y + 2, 2, h - 4);
    g.fillStyle = 'rgba(10,14,20,0.35)';
    for (let xx = x + 58; xx < x + w; xx += 60) g.fillRect(xx, y, 2, h);
  } else if (f.kind === 'metal') {
    g.fillStyle = 'rgba(200, 220, 240, 0.12)';
    for (let xx = x + 4; xx < x + w; xx += 12) g.fillRect(xx, y, 1.5, h);
  } else if (f.kind === 'render') {
    for (let i = 0; i < w / 40; i++) { g.fillStyle = 'rgba(30, 20, 10, 0.1)'; g.fillRect(x + hash(seed, i) * w, y + h * 0.5, 6 + hash(seed, i, 2) * 14, h * 0.5); }
  } else {
    g.fillStyle = 'rgba(20, 20, 20, 0.35)';
    for (let xx = x + 12; xx < x + w; xx += 36) { g.beginPath(); g.arc(xx, y + h * 0.35, 1.6, 0, TAU); g.arc(xx, y + h * 0.75, 1.6, 0, TAU); g.fill(); }
  }
}

function facadeTop(g: G, r: Box, f: Facade, seed: number, style: PlazaStyle) {
  g.fillStyle = f.top; g.fillRect(r.x, r.y, r.w, r.h);
  const long = r.w >= r.h;
  // the coping: a lighter cap stone in sections, a groove down the middle
  g.fillStyle = 'rgba(255, 250, 235, 0.1)';
  if (long) g.fillRect(r.x, r.y + 6, r.w, r.h - 12); else g.fillRect(r.x + 6, r.y, r.w - 12, r.h);
  g.strokeStyle = 'rgba(14, 16, 22, 0.28)'; g.lineWidth = 1.5; g.beginPath();
  if (long) { for (let x = r.x + 50; x < r.x + r.w; x += 50) { g.moveTo(x, r.y + 6); g.lineTo(x, r.y + r.h - 6); } }
  else { for (let y = r.y + 50; y < r.y + r.h; y += 50) { g.moveTo(r.x + 6, y); g.lineTo(r.x + r.w - 6, y); } }
  g.stroke();
  if (f.kind === 'brick') {
    g.fillStyle = 'rgba(20, 10, 6, 0.16)';
    for (let i = 0; i < (r.w * r.h) / 260; i++) g.fillRect(r.x + hash(seed, i, 1) * r.w, r.y + hash(seed, i, 2) * r.h, 6, 3);
  }
  if (style === 'garage') {
    // hazard band along the coping, where bumpers have scraped it
    g.save(); g.beginPath(); if (long) g.rect(r.x, r.y + r.h - 12, r.w, 8); else g.rect(r.x + r.w - 12, r.y, 8, r.h); g.clip();
    for (let t = -60; t < r.w + r.h; t += 20) { g.fillStyle = (t / 20) % 2 ? C.yellow : C.hazard; g.beginPath(); g.moveTo(r.x + t, r.y); g.lineTo(r.x + t + 10, r.y); g.lineTo(r.x + t + 10 - 60, r.y + r.h + 60); g.lineTo(r.x + t - 60, r.y + r.h + 60); g.fill(); }
    g.restore();
  }
}

/* ------------------------------------------------------------------ the painters */

type Ctx = { p: MapPoly; pts: Pt[]; r: Box; o: Open; style: PlazaStyle; accent: string; twin: boolean; seed: number; h: number };

function wall(g: G, c: Ctx) {
  const f = FACADE[c.style] ?? DEFAULT_FACADE;
  southFace(g, c.r, c.o, c.h, f.front, (q) => facadeFront(g, q, f, c.seed));
  facadeTop(g, c.r, f, c.seed, c.style);
  finish(g, c.r, c.o);
}

function glass(g: G, c: Ctx) {
  const { r, o } = c;
  const long = r.w >= r.h;
  // front: glass showing a warm room behind it, mullions, a dark sill
  southFace(g, r, o, c.h, '#4a6e7c', (q) => {
    const gr = g.createLinearGradient(0, q.y, 0, q.y + q.h);
    gr.addColorStop(0, '#9fd0dc'); gr.addColorStop(0.6, '#54808e'); gr.addColorStop(1, '#2a3e48');
    g.fillStyle = gr; g.fillRect(q.x, q.y, q.w, q.h);
    g.fillStyle = hexA('#ffd9a0', 0.25); g.fillRect(q.x, q.y + q.h * 0.45, q.w, q.h * 0.3);
    g.fillStyle = 'rgba(255,255,255,0.35)';
    for (let x = q.x + 14; x < q.x + q.w; x += 46) { g.beginPath(); g.moveTo(x, q.y + q.h); g.lineTo(x + 8, q.y); g.lineTo(x + 13, q.y); g.lineTo(x + 5, q.y + q.h); g.fill(); }
    g.fillStyle = C.steelDk; for (let x = q.x; x <= q.x + q.w; x += 50) g.fillRect(x - 1.5, q.y, 3, q.h);
  });
  // top: a steel sill the width of the cell, the pane a band down its middle
  g.fillStyle = C.steelLo; g.fillRect(r.x, r.y, r.w, r.h);
  g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6);
  const pane = long ? { x: r.x, y: r.y + r.h / 2 - 9, w: r.w, h: 18 } : { x: r.x + r.w / 2 - 9, y: r.y, w: 18, h: r.h };
  g.fillStyle = C.glass; g.fillRect(pane.x, pane.y, pane.w, pane.h);
  g.fillStyle = hexA(C.glassHi, 0.7);
  if (long) for (let x = pane.x + 10; x < pane.x + pane.w; x += 38) { g.beginPath(); g.moveTo(x, pane.y + pane.h); g.lineTo(x + 8, pane.y); g.lineTo(x + 14, pane.y); g.lineTo(x + 6, pane.y + pane.h); g.fill(); }
  else for (let y = pane.y + 10; y < pane.y + pane.h; y += 38) { g.beginPath(); g.moveTo(pane.x, y + 8); g.lineTo(pane.x + pane.w, y); g.lineTo(pane.x + pane.w, y + 6); g.lineTo(pane.x, y + 14); g.fill(); }
  g.strokeStyle = hexA(C.glassLo, 0.9); g.lineWidth = 1.5; g.strokeRect(pane.x, pane.y, pane.w, pane.h);
  // mullions
  g.fillStyle = C.steelDk;
  if (long) for (let x = r.x; x <= r.x + r.w; x += 50) g.fillRect(x - 3, pane.y - 2, 6, pane.h + 4);
  else for (let y = r.y; y <= r.y + r.h; y += 50) g.fillRect(pane.x - 2, y - 3, pane.w + 4, 6);
  // a window decal now and then: the shop's opening hours, a sale sticker
  if (hash(c.seed, 3) < 0.5 && (long ? r.w : r.h) >= 150) {
    const t = 0.3 + hash(c.seed, 4) * 0.4, px = long ? r.x + r.w * t : pane.x + pane.w / 2, py = long ? pane.y + pane.h / 2 : r.y + r.h * t;
    disc(g, px, py, 7, c.accent, 1.2);
  }
  finish(g, r, o, 3);
}

function desk(g: G, c: Ctx) {
  const { r, style } = c;
  const cell = r.w <= 50 && r.h <= 50;
  const booth = (style === 'pizza' || style === 'sushi') && r.w === 100 && r.h === 100;
  const top = style === 'lobby' || style === 'bank' ? '#e8e4dc' : style === 'garage' ? C.yellow : style === 'cafe' || style === 'library' || style === 'archive' || style === 'trattoria' ? C.oak : '#c8ccd0';
  const front = style === 'lobby' || style === 'bank' ? C.woodLo : style === 'garage' ? C.yellowLo : mix(top, 0, 0.45);
  if (booth) {
    // two vinyl benches facing a table, in the shop's colour
    const vinyl = style === 'pizza' ? '#b83a32' : '#2f6a66';
    southFace(g, r, c.o, 10, mix(vinyl, 0, 0.4));
    box(g, r.x, r.y, r.w, 26, vinyl); box(g, r.x, r.y + r.h - 26, r.w, 26, vinyl);
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(r.x + 4, r.y + 4, r.w - 8, 4); g.fillRect(r.x + 4, r.y + r.h - 22, r.w - 8, 4);
    box(g, r.x + 12, r.y + 30, r.w - 24, r.h - 60, style === 'pizza' ? '#e8e0cc' : '#2a2a30');
    if (style === 'pizza') { disc(g, r.x + r.w / 2, r.y + r.h / 2, 15, '#e0a050', 1.4); for (let i = 0; i < 5; i++) disc(g, r.x + r.w / 2 + Math.cos(i * 1.3) * 8, r.y + r.h / 2 + Math.sin(i * 1.3) * 8, 2.6, '#b8302a', 0); }
    else { box(g, r.x + 30, r.y + 42, 40, 16, '#c8302a', 1.2); for (let i = 0; i < 4; i++) disc(g, r.x + 36 + i * 9, r.y + 50, 3, '#f0f0e8', 0.8); }
    return;
  }
  if (cell && (style === 'lobby' || style === 'bank')) {
    // a turnstile: a steel post with its glass flaps
    southFace(g, r, c.o, 10, C.steelDk);
    box(g, r.x + 14, r.y + 6, 22, 38, C.steel);
    g.fillStyle = hexA(C.glassHi, 0.6); g.fillRect(r.x + 2, r.y + 18, 12, 4); g.fillRect(r.x + 36, r.y + 18, 12, 4);
    disc(g, r.x + 25, r.y + 14, 3, '#3aff8a', 0.8);
    return;
  }
  southFace(g, r, c.o, c.h, front, (q) => { g.fillStyle = 'rgba(255,255,255,0.1)'; for (let x = q.x + 6; x < q.x + q.w; x += 24) g.fillRect(x, q.y + 2, 12, q.h - 6); });
  g.fillStyle = top; g.fillRect(r.x, r.y, r.w, r.h);
  g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(r.x + 3, r.y + 3, r.w - 6, 5);
  const long = r.w >= r.h, len = long ? r.w : r.h;
  const at = (t: number): [number, number] => (long ? [r.x + t, r.y + r.h / 2] : [r.x + r.w / 2, r.y + t]);
  if (style === 'garage') {
    // the pay booth: a window all round, a barrier arm
    box(g, r.x + 10, r.y + 10, r.w - 20, r.h - 20, hexA(C.glass, 0.9));
    box(g, r.x + 30, r.y + 30, r.w - 60, r.h - 60, C.cream);
    letter(g, 'PAY', r.x + r.w / 2, r.y + r.h / 2, 14, INK);
  } else if (style === 'cafe' || style === 'trattoria') {
    for (let t = 30; t < len - 20; t += 60) {
      const [x, y] = at(t);
      if ((t / 60) % 3 < 1) { box(g, x - 14, y - 10, 28, 20, C.steel, 1.4); disc(g, x - 6, y, 3, '#d8302a', 0.8); disc(g, x + 6, y, 3, '#2a2a2a', 0.8); }
      else { disc(g, x, y, 6, C.white, 1.2); disc(g, x, y, 3, '#5a3a22', 0); disc(g, x + 14, y + 4, 5, C.white, 1.2); }
    }
  } else if (style === 'library' || style === 'archive') {
    for (let t = 25; t < len - 10; t += 50) { const [x, y] = at(t); box(g, x - 10, y - 8, 20, 14, hash(c.seed, t) < 0.5 ? '#8a3a2a' : '#2a4a6a', 1.2); }
    const [lx, ly] = at(len - 20); disc(g, lx, ly, 7, '#3a6a3a', 1.4); disc(g, lx, ly, 3, '#ffe9a0', 0);
  } else if (style === 'lobby' || style === 'bank') {
    for (let t = 30; t < len - 10; t += 60) { const [x, y] = at(t); box(g, x - 11, y - 9, 22, 6, '#20242c', 1.2); g.fillStyle = '#5ab0ff'; g.fillRect(x - 9, y - 8, 18, 3); }
  } else {
    // a till: the register, a card reader and a basket of impulse buys
    const [x, y] = at(Math.min(30, len / 2));
    box(g, x - 13, y - 10, 26, 18, '#2a2e36', 1.4); g.fillStyle = '#7ad0ff'; g.fillRect(x - 9, y - 8, 18, 6);
    if (len > 90) { const [bx, by] = at(len - 30); g.fillStyle = c.accent; for (let i = 0; i < 6; i++) disc(g, bx - 8 + (i % 3) * 8, by - 4 + Math.floor(i / 3) * 8, 3.4, i % 2 ? c.accent : C.cream, 0.8); }
  }
  finish(g, r, c.o, 3);
}

const SPINES = ['#8a2e2a', '#2f4a7a', '#3a6a3a', '#c8a03a', '#5a2a5a', '#2a6a6a', '#c86a3a', '#e8e0cc'] as const;
function shelf(g: G, c: Ctx) {
  const { r, style, seed } = c;
  const long = r.w >= r.h, len = long ? r.w : r.h, depth = long ? r.h : r.w;
  const frame = style === 'library' || style === 'books' || style === 'trattoria' ? C.woodLo : style === 'cafe' ? C.steel : style === 'archive' ? '#5a5e66' : '#d8dcdc';
  southFace(g, r, c.o, c.h, mix(frame.startsWith('#') ? frame : '#888888', 0, 0.35), (q) => {
    // the front shows the lowest shelf's goods
    for (let x = q.x + 2; x < q.x + q.w - 2; x += 7) { g.fillStyle = SPINES[Math.floor(hash(seed, x) * SPINES.length)]!; g.fillRect(x, q.y + 3, 5, q.h - 7); }
  });
  g.fillStyle = frame; g.fillRect(r.x, r.y, r.w, r.h);
  const cell = (t: number, d: number, w: number, hh: number, col: string) => { if (long) box(g, r.x + t, r.y + d, w, hh, col, 1); else box(g, r.x + d, r.y + t, hh, w, col, 1); };
  if (style === 'library' || style === 'books' || style === 'games' || style === 'archive') {
    // two faces of spines back to back; the archive's are grey boxes with labels
    for (const side of [3, depth / 2 + 1]) for (let t = 3; t < len - 6; t += style === 'archive' ? 20 : 7) {
      const col = style === 'archive' ? (hash(seed, t, side) < 0.2 ? '#c8b88a' : '#8a8e94') : style === 'games' ? ['#c83a3a', '#3a6ac8', '#3ac86a', '#c8c83a', '#8a3ac8'][Math.floor(hash(seed, t, side) * 5)]! : SPINES[Math.floor(hash(seed, t, side) * SPINES.length)]!;
      const w = style === 'archive' ? 17 : 5 + hash(seed, t) * 1.5;
      cell(t, side, w, depth / 2 - 4, col);
    }
  } else if (style === 'cafe' || style === 'bakery') {
    g.fillStyle = hexA(C.glassHi, 0.5); g.fillRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6);
    for (let t = 10; t < len - 8; t += 16) { const x = long ? r.x + t : r.x + r.w / 2 + (hash(seed, t) - 0.5) * 16, y = long ? r.y + r.h / 2 + (hash(seed, t) - 0.5) * 16 : r.y + t; disc(g, x, y, 6, hash(seed, t, 2) < 0.5 ? '#d8a050' : '#8a4a2a', 1); g.fillStyle = 'rgba(255,240,200,0.6)'; g.fillRect(x - 2, y - 3, 3, 2); }
  } else if (style === 'trattoria') {
    for (let t = 8; t < len - 6; t += 11) for (let d = 8; d < depth - 4; d += 11) disc(g, long ? r.x + t : r.x + d, long ? r.y + d : r.y + t, 4.2, hash(seed, t, d) < 0.6 ? '#3a1a22' : '#2a4a2a', 1);
  } else if (style === 'grocer') {
    for (let t = 4; t < len - 4; t += 24) {
      cell(t, 4, 22, depth - 8, C.woodHi);
      const fruit = ['#c83a2a', '#e8a02a', '#7ab83a', '#e8d03a', '#6a2a6a'][Math.floor(hash(seed, t) * 5)]!;
      for (let k = 0; k < 5; k++) disc(g, long ? r.x + t + 6 + (k % 2) * 10 : r.x + 10 + (k % 3) * 10, long ? r.y + 10 + (k % 3) * 10 : r.y + t + 6 + (k % 2) * 10, 4, fruit, 0.8);
    }
  } else if (style === 'thrift' || style === 'barber') {
    g.strokeStyle = C.steelDk; g.lineWidth = 3; g.beginPath(); if (long) { g.moveTo(r.x + 4, r.y + r.h / 2); g.lineTo(r.x + r.w - 4, r.y + r.h / 2); } else { g.moveTo(r.x + r.w / 2, r.y + 4); g.lineTo(r.x + r.w / 2, r.y + r.h - 4); } g.stroke();
    for (let t = 6; t < len - 6; t += 6) { const col = ['#c84a4a', '#4a6ac8', '#e8c84a', '#4a8a5a', '#e8e0cc', '#2a2a2a'][Math.floor(hash(seed, t) * 6)]!; cell(t, 4, 4, depth - 8, col); }
  } else {
    // packaged goods: pharmacy boxes, groceries, phone cases, glasses frames
    const pal = style === 'pharmacy' ? ['#f0f0f0', '#5ab0e0', '#5ac88a', '#e8e8e8', '#e05a5a'] : style === 'optician' ? ['#2a2a2a', '#8a5a3a', '#c8c8d0', '#3a5a8a'] : style === 'phones' ? ['#2a2a30', '#5affe0', '#ff5aa0', '#e8e8e8'] : ['#e05a3a', '#e8c83a', '#3a8ae0', '#5ac85a', '#f0f0f0', '#c83a8a'];
    for (const side of [3, depth / 2 + 1]) for (let t = 3; t < len - 8; t += 11) cell(t, side, 9, depth / 2 - 5, pal[Math.floor(hash(seed, t, side) * pal.length)]!);
  }
  finish(g, r, c.o, 3);
}

function shrubs(g: G, r: Box, seed: number, flowers: string | null, big = 1) {
  const n = Math.max(3, Math.round((r.w * r.h) / 900));
  for (let i = 0; i < n; i++) {
    const x = r.x + 10 + hash(seed, i, 1) * (r.w - 20), y = r.y + 10 + hash(seed, i, 2) * (r.h - 20), rad = (9 + hash(seed, i, 3) * 7) * big;
    disc(g, x, y + 2, rad, C.greenLo, 0); disc(g, x, y, rad, hash(seed, i, 4) < 0.5 ? C.green : C.greenHi, 1.6);
    g.fillStyle = 'rgba(255,255,220,0.2)'; g.beginPath(); g.arc(x - rad * 0.3, y - rad * 0.3, rad * 0.4, 0, TAU); g.fill();
    if (flowers && hash(seed, i, 5) < 0.7) for (let k = 0; k < 4; k++) disc(g, x + Math.cos(k * 1.6 + i) * rad * 0.55, y + Math.sin(k * 1.6 + i) * rad * 0.55, 2.6, flowers, 0.6);
  }
}
function planter(g: G, c: Ctx) {
  const { r, style, seed } = c;
  const rim = style === 'florist' || style === 'barber' ? '#5a4a3a' : '#b4b0a6';
  southFace(g, r, c.o, c.h, mix(rim, 0, 0.4), (q) => { g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(q.x, q.y, q.w, 3); });
  g.fillStyle = rim; g.fillRect(r.x, r.y, r.w, r.h);
  g.fillStyle = '#4a3a2a'; g.fillRect(r.x + 7, r.y + 7, r.w - 14, r.h - 14);
  const flowers = style === 'florist' ? null : style === 'park' ? '#ff8ab0' : style === 'cafe' || style === 'trattoria' ? '#ffd24a' : style === 'street' || style === 'station' ? '#b48ae0' : null;
  if (style === 'florist') {
    // buckets of cut flowers
    for (let y = r.y + 16; y < r.y + r.h - 8; y += 26) for (let x = r.x + 14; x < r.x + r.w - 8; x += 24) {
      disc(g, x, y, 10, '#8a8e94', 1.2);
      const col = ['#ff5a7a', '#ffd24a', '#ff8a3a', '#e8e8f0', '#b45ae0'][Math.floor(hash(seed, x, y) * 5)]!;
      for (let k = 0; k < 5; k++) disc(g, x + Math.cos(k * 1.26) * 5, y + Math.sin(k * 1.26) * 5, 3.2, col, 0.6);
    }
  } else shrubs(g, { x: r.x + 4, y: r.y + 4, w: r.w - 8, h: r.h - 8 }, seed, flowers);
  finish(g, r, c.o, 3);
}

function hedge(g: G, c: Ctx) {
  const { r, seed } = c;
  southFace(g, r, c.o, c.h, C.greenLo, (q) => { for (let x = q.x; x < q.x + q.w; x += 12) disc(g, x + 6, q.y + 4, 7, mix(C.greenLo, 0, 0.2), 0); });
  g.fillStyle = C.green; g.fillRect(r.x, r.y, r.w, r.h);
  for (let i = 0; i < (r.w * r.h) / 160; i++) { const x = r.x + hash(seed, i, 1) * r.w, y = r.y + hash(seed, i, 2) * r.h; disc(g, x, y, 5 + hash(seed, i, 3) * 4, hash(seed, i, 4) < 0.5 ? C.greenHi : C.green, 0); }
  g.fillStyle = 'rgba(255,255,220,0.12)'; g.fillRect(r.x, r.y, r.w, 6);
  finish(g, r, c.o, 3);
}

function hoard(g: G, c: Ctx) {
  const { r, o, seed, twin } = c;
  const long = r.w >= r.h;
  const brand = twin ? '#6a2a3a' : '#21436a';
  southFace(g, r, o, c.h, brand, (q) => {
    // the printed panels: a skyline of the tower to come, the developer's line
    g.fillStyle = hexA('#ffffff', 0.12);
    for (let x = q.x; x < q.x + q.w; x += 30 + hash(seed, x) * 40) { const hh = 4 + hash(seed, x, 1) * (q.h - 6); g.fillRect(x, q.y + q.h - hh, 18 + hash(seed, x, 2) * 16, hh); }
    g.fillStyle = 'rgba(255,255,255,0.4)'; for (let x = q.x + 100; x < q.x + q.w; x += 200) g.fillRect(x, q.y + 3, 2, q.h - 6);
    for (let x = q.x + 40; x < q.x + q.w - 60; x += 400) letter(g, twin ? 'GRAND HOTEL  OPENING SOON' : 'TOWER 3  LIVE ABOVE IT ALL', x + 80, q.y + q.h / 2, 11, 'rgba(255,255,255,0.75)', { spacing: 1.5 });
  });
  g.fillStyle = C.plywood; g.fillRect(r.x, r.y, r.w, r.h);
  g.fillStyle = brand; if (long) g.fillRect(r.x, r.y + r.h - 16, r.w, 16); else g.fillRect(r.x + r.w - 16, r.y, 16, r.h);
  g.strokeStyle = 'rgba(80, 56, 20, 0.5)'; g.lineWidth = 1.5; g.beginPath();
  if (long) for (let x = r.x + 120; x < r.x + r.w; x += 120) { g.moveTo(x, r.y); g.lineTo(x, r.y + r.h); } else for (let y = r.y + 120; y < r.y + r.h; y += 120) { g.moveTo(r.x, y); g.lineTo(r.x + r.w, y); }
  g.stroke();
  // the posts that hold it up, and the odd poster pasted on
  g.fillStyle = C.steelDk;
  if (long) for (let x = r.x + 10; x < r.x + r.w; x += 120) g.fillRect(x, r.y + 6, 8, 18); else for (let y = r.y + 10; y < r.y + r.h; y += 120) g.fillRect(r.x + 6, y, 18, 8);
  if (hash(seed, 9) < 0.6) { const t = 0.2 + hash(seed, 10) * 0.6; const px = long ? r.x + r.w * t : r.x + 4, py = long ? r.y + 4 : r.y + r.h * t; box(g, px, py, long ? 30 : 26, long ? 26 : 30, ['#e8c83a', '#e85a5a', '#f0f0e8'][Math.floor(hash(seed, 11) * 3)]!, 1.2); }
  finish(g, r, o, 3);
}

function pillar(g: G, c: Ctx) {
  const { r, style } = c;
  southFace(g, r, c.o, c.h, C.concreteLo, (q) => {
    if (style === 'garage') for (let x = q.x - 20; x < q.x + q.w; x += 12) { g.fillStyle = Math.floor((x - q.x) / 12) % 2 ? C.yellow : C.hazard; g.beginPath(); g.moveTo(x, q.y + q.h); g.lineTo(x + 6, q.y + q.h); g.lineTo(x + 6 + 10, q.y + q.h * 0.5); g.lineTo(x + 10, q.y + q.h * 0.5); g.fill(); }
  });
  g.fillStyle = C.concrete; g.fillRect(r.x, r.y, r.w, r.h);
  g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(r.x + 5, r.y + 5, r.w - 10, r.h - 10);
  if (style === 'site') {
    for (const [dx, dy] of [[12, 12], [38, 12], [12, 38], [38, 38]] as const) { g.strokeStyle = C.ink; g.lineWidth = 4; g.beginPath(); g.moveTo(r.x + dx, r.y + dy); g.lineTo(r.x + dx + 3, r.y + dy - 9); g.stroke(); g.strokeStyle = '#a8552e'; g.lineWidth = 2; g.stroke(); }
  } else {
    letter(g, `${String.fromCharCode(65 + Math.floor(hash(c.seed, 1) * 4))}${1 + Math.floor(hash(c.seed, 2) * 9)}`, r.x + r.w / 2, r.y + r.h / 2, 13, '#3a3a36');
  }
  finish(g, r, c.o, 3);
}

function stack(g: G, c: Ctx) {
  const { r, seed } = c;
  const kind = Math.floor(hash(seed, 1) * 3);
  g.fillStyle = C.woodLo; g.fillRect(r.x + 2, r.y + r.h - 6, r.w - 4, c.h + 6);
  southFace(g, { ...r, x: r.x + 2, w: r.w - 4 }, c.o, c.h, kind === 0 ? '#7e7e78' : kind === 1 ? '#6a3a20' : '#2a5a8a');
  if (kind === 0) {
    // concrete blocks on a pallet
    box(g, r.x + 2, r.y + 2, r.w - 4, r.h - 4, C.woodHi);
    for (let y = r.y + 6; y < r.y + r.h - 12; y += 16) for (let x = r.x + 6; x < r.x + r.w - 20; x += 24) box(g, x, y, 22, 14, '#a9a9a2', 1.2);
  } else if (kind === 1) {
    // a bundle of rebar on timber bearers
    box(g, r.x + 2, r.y + 2, r.w - 4, r.h - 4, '#5a4a3a');
    g.strokeStyle = '#a8552e'; g.lineWidth = 3;
    const long = r.w >= r.h;
    for (let k = 6; k < (long ? r.h : r.w) - 4; k += 5) { g.beginPath(); if (long) { g.moveTo(r.x - 6, r.y + k); g.lineTo(r.x + r.w + 6, r.y + k); } else { g.moveTo(r.x + k, r.y - 6); g.lineTo(r.x + k, r.y + r.h + 6); } g.stroke(); }
  } else {
    // stacked drain pipe, ends on show
    box(g, r.x + 2, r.y + 2, r.w - 4, r.h - 4, '#3a6a9a');
    for (let y = r.y + 12; y < r.y + r.h - 6; y += 20) for (let x = r.x + 12; x < r.x + r.w - 6; x += 20) { disc(g, x, y, 9, '#e07a3a', 1.4); disc(g, x, y, 5, '#2a2a2a', 0); }
  }
  g.strokeStyle = INK; g.lineWidth = 2; g.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
}

function core(g: G, c: Ctx) {
  const { r, style, seed } = c;
  if (style === 'bakery' || style === 'noodles' || style === 'sushi') {
    southFace(g, r, c.o, c.h, '#5a626e', (q) => { for (let x = q.x + 20; x < q.x + q.w - 20; x += 70) { g.fillStyle = '#1a1a1e'; g.fillRect(x, q.y + 3, 50, q.h - 8); g.fillStyle = 'rgba(255,150,60,0.7)'; g.fillRect(x + 3, q.y + 5, 44, q.h - 12); } });
    g.fillStyle = '#b8c0c8'; g.fillRect(r.x, r.y, r.w, r.h);
    for (let x = r.x + 8; x < r.x + r.w - 8; x += 40) { box(g, x, r.y + 8, 34, r.h - 16, '#8a929e', 1.4); disc(g, x + 8, r.y + 16, 3, '#ff5a3a', 0.8); }
    finish(g, r, c.o, 3);
    return;
  }
  if (style === 'pizza') {
    southFace(g, r, c.o, c.h, C.brickLo);
    g.fillStyle = C.brick; g.fillRect(r.x, r.y, r.w, r.h);
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    disc(g, cx, cy, Math.min(r.w, r.h) / 2 - 4, '#b5654c', 2);
    g.strokeStyle = 'rgba(60,20,10,0.5)'; g.lineWidth = 1.5; for (let k = 1; k < 4; k++) { g.beginPath(); g.arc(cx, cy, k * 11, 0, TAU); g.stroke(); }
    g.fillStyle = '#1a1210'; g.beginPath(); g.ellipse(cx, cy + r.h / 2 - 10, 18, 9, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,170,60,0.8)'; g.beginPath(); g.ellipse(cx, cy + r.h / 2 - 9, 12, 5, 0, 0, TAU); g.fill();
    finish(g, r, c.o, 3);
    return;
  }
  if (style === 'garage') {
    // the up-ramp: a sloping deck between kerbs, chevrons climbing north
    southFace(g, r, c.o, c.h, C.concreteLo);
    g.fillStyle = '#8e8e88'; g.fillRect(r.x, r.y, r.w, r.h);
    const gr = g.createLinearGradient(0, r.y + r.h, 0, r.y);
    gr.addColorStop(0, 'rgba(0,0,0,0.25)'); gr.addColorStop(1, 'rgba(255,255,255,0.12)');
    g.fillStyle = gr; g.fillRect(r.x + 10, r.y, r.w - 20, r.h);
    g.fillStyle = C.yellow; g.fillRect(r.x, r.y, 10, r.h); g.fillRect(r.x + r.w - 10, r.y, 10, r.h);
    g.strokeStyle = hexA(C.line, 0.7); g.lineWidth = 6;
    for (let y = r.y + r.h - 60; y > r.y + 40; y -= 90) { g.beginPath(); g.moveTo(r.x + 30, y + 22); g.lineTo(r.x + r.w / 2, y); g.lineTo(r.x + r.w - 30, y + 22); g.stroke(); }
    letter(g, 'UP', r.x + r.w / 2, r.y + r.h - 30, 22, hexA(C.line, 0.8), { rot: -Math.PI / 2 });
    finish(g, r, c.o, 3);
    return;
  }
  // a lift or stair core: board-marked concrete (granite in the bank), lift doors on its open long side
  const stone = style === 'bank' ? '#c8bea4' : style === 'site' ? '#9a9a92' : '#7e848e';
  southFace(g, r, c.o, c.h, mix(stone, 0, 0.42), (q) => { g.strokeStyle = 'rgba(0,0,0,0.2)'; g.lineWidth = 1; for (let y = q.y + 5; y < q.y + q.h; y += 5) { g.beginPath(); g.moveTo(q.x, y); g.lineTo(q.x + q.w, y); g.stroke(); } });
  g.fillStyle = stone; g.fillRect(r.x, r.y, r.w, r.h);
  g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 1.2;
  for (let y = r.y + 25; y < r.y + r.h; y += 25) { g.beginPath(); g.moveTo(r.x, y); g.lineTo(r.x + r.w, y); g.stroke(); }
  if (style === 'site') {
    // formwork still on the top lift, a rebar mat sticking up
    box(g, r.x + 8, r.y + 8, r.w - 16, r.h - 16, C.plywood, 1.6);
    g.strokeStyle = '#a8552e'; g.lineWidth = 2; g.beginPath();
    for (let x = r.x + 18; x < r.x + r.w - 12; x += 14) { g.moveTo(x, r.y + 14); g.lineTo(x, r.y + r.h - 14); }
    for (let y = r.y + 18; y < r.y + r.h - 12; y += 14) { g.moveTo(r.x + 14, y); g.lineTo(r.x + r.w - 14, y); }
    g.stroke();
  } else {
    for (let y = r.y + 40; y < r.y + r.h - 70; y += 120) {
      box(g, r.x + r.w - 16, y, 12, 70, '#c8ccd2', 1.4);
      g.fillStyle = INK; g.fillRect(r.x + r.w - 11, y + 2, 2, 66);
      disc(g, r.x + r.w - 22, y + 82, 3.5, '#ffd27a', 1);
    }
    box(g, r.x + 20, r.y + 30, r.w - 56, 60, mix(stone, 0, 0.2), 1.4);
    letter(g, style === 'bank' ? 'VAULT' : 'LIFTS', r.x + r.w / 2 - 8, r.y + 60, 15, 'rgba(255,255,255,0.6)', { rot: -Math.PI / 2 });
    void seed;
  }
  finish(g, r, c.o, 3);
}

function scaffold(g: G, c: Ctx) {
  const { r } = c;
  // poles every 50 px with the green safety net hanging off the face
  for (const [a, b] of c.o.spans.s) {
    g.fillStyle = 'rgba(70, 140, 70, 0.45)'; g.fillRect(r.x + a, r.y + r.h, b - a, c.h);
    g.strokeStyle = 'rgba(30, 60, 30, 0.6)'; g.lineWidth = 1; g.beginPath();
    for (let x = r.x + a; x < r.x + b; x += 6) { g.moveTo(x, r.y + r.h); g.lineTo(x + 6, r.y + r.h + c.h); }
    g.stroke();
  }
  g.fillStyle = 'rgba(120, 100, 70, 0.25)'; g.fillRect(r.x, r.y, r.w, r.h);
  for (let x = r.x; x < r.x + r.w; x += 50) { box(g, x + 4, r.y + 8, 42, 14, C.plywood, 1.2); box(g, x + 4, r.y + 28, 42, 14, mix(C.plywood, 0, 0.1), 1.2); }
  g.strokeStyle = INK; g.lineWidth = 5; g.beginPath();
  g.moveTo(r.x, r.y + 4); g.lineTo(r.x + r.w, r.y + 4); g.moveTo(r.x, r.y + r.h - 4); g.lineTo(r.x + r.w, r.y + r.h - 4);
  for (let x = r.x; x < r.x + r.w; x += 50) { g.moveTo(x + 4, r.y); g.lineTo(x + 4, r.y + r.h); g.moveTo(x + 4, r.y + 4); g.lineTo(x + 54, r.y + r.h - 4); }
  g.stroke();
  g.strokeStyle = '#a8b0bc'; g.lineWidth = 2.6; g.stroke();
  for (let x = r.x; x <= r.x + r.w; x += 50) for (const y of [r.y + 4, r.y + r.h - 4]) disc(g, x + 4, y, 3.4, C.yellow, 1);
}

function cabin(g: G, c: Ctx) {
  const { r, twin } = c;
  const body = twin ? '#c8862a' : '#3a6a9a';
  southFace(g, r, c.o, c.h, mix(body, 0, 0.4), (q) => {
    g.fillStyle = 'rgba(0,0,0,0.2)'; for (let x = q.x + 4; x < q.x + q.w; x += 8) g.fillRect(x, q.y, 3, q.h);
    for (let x = q.x + 30; x < q.x + q.w - 40; x += 90) { box(g, x, q.y + 4, 40, q.h - 10, '#cfe6ee', 1.4); }
  });
  g.fillStyle = body; g.fillRect(r.x, r.y, r.w, r.h);
  g.fillStyle = 'rgba(255,255,255,0.12)'; for (let x = r.x + 6; x < r.x + r.w; x += 12) g.fillRect(x, r.y, 4, r.h);
  box(g, r.x + 18, r.y + 18, 60, 40, '#5a6068', 1.6); disc(g, r.x + 48, r.y + 38, 12, '#8a929c', 1.4);
  letter(g, 'SITE OFFICE', r.x + r.w / 2 + 30, r.y + r.h / 2 + 30, 16, 'rgba(255,255,255,0.85)');
  disc(g, r.x + r.w - 40, r.y + 30, 11, '#f0f0e8', 1.6); g.fillStyle = '#f0f0e8'; g.fillRect(r.x + r.w - 54, r.y + 30, 28, 4);
  finish(g, r, c.o, 3);
}

function metro(g: G, c: Ctx) {
  const { r } = c;
  // the stairwell going down: treads darkening into the station, rails, the glass balustrade and the canopy's steel frame
  g.fillStyle = '#2a2e36'; g.fillRect(r.x, r.y, r.w, r.h);
  const inner = { x: r.x + 14, y: r.y + 14, w: r.w - 28, h: r.h - 28 };
  for (let i = 0, y = inner.y; y < inner.y + inner.h; y += 12, i++) {
    const k = i / Math.max(1, inner.h / 12);
    g.fillStyle = mix('#a8a8a2', 20, k * 0.85); g.fillRect(inner.x, y, inner.w, 10);
    g.fillStyle = hexA(C.yellow, 0.8 - k * 0.6); g.fillRect(inner.x, y, inner.w, 2);
  }
  g.fillStyle = 'rgba(10, 14, 24, 0.5)'; g.fillRect(inner.x, inner.y + inner.h * 0.6, inner.w, inner.h * 0.4);
  g.fillStyle = '#7ab0ff'; g.globalAlpha = 0.25; g.fillRect(inner.x, inner.y + inner.h - 20, inner.w, 20); g.globalAlpha = 1;
  g.strokeStyle = C.steel; g.lineWidth = 4; g.beginPath(); g.moveTo(inner.x + inner.w / 2, inner.y); g.lineTo(inner.x + inner.w / 2, inner.y + inner.h); g.stroke();
  g.strokeStyle = hexA(C.glassHi, 0.75); g.lineWidth = 8; g.strokeRect(r.x + 5, r.y + 5, r.w - 10, r.h - 10);
  g.strokeStyle = INK; g.lineWidth = 2; g.strokeRect(r.x, r.y, r.w, r.h); g.strokeRect(r.x + 10, r.y + 10, r.w - 20, r.h - 20);
  // canopy frame over the top: ribs and a tinted glass sheet
  g.fillStyle = hexA('#9fd0e8', 0.22); g.fillRect(r.x - 6, r.y - 6, r.w + 12, r.h * 0.45);
  g.strokeStyle = C.steelDk; g.lineWidth = 3; g.beginPath();
  for (let x = r.x - 6; x <= r.x + r.w + 6; x += (r.w + 12) / 5) { g.moveTo(x, r.y - 6); g.lineTo(x, r.y - 6 + r.h * 0.45); }
  g.stroke();
  g.strokeStyle = INK; g.lineWidth = 2; g.strokeRect(r.x - 6, r.y - 6, r.w + 12, r.h * 0.45);
}

function kiosk(g: G, c: Ctx) {
  const { r, twin } = c;
  const body = twin ? '#7a3a5a' : '#2f6a4a';
  southFace(g, r, c.o, c.h, mix(body, 0, 0.35), (q) => {
    for (let x = q.x + 4; x < q.x + q.w - 8; x += 14) box(g, x, q.y + 3, 12, q.h - 8, ['#e8c83a', '#e85a5a', '#5a8ae8', '#f0f0e8'][Math.floor(hash(x, q.y) * 4)]!, 1);
  });
  g.fillStyle = body; g.fillRect(r.x, r.y, r.w, r.h);
  // the awning on the south, striped, and the magazines fanned on the counter
  for (let x = r.x; x < r.x + r.w; x += 16) { g.fillStyle = (x - r.x) / 16 % 2 ? C.cream : (twin ? '#c84a7a' : '#3a8a5a'); g.fillRect(x, r.y + r.h - 22, 16, 22); }
  g.strokeStyle = INK; g.lineWidth = 1.6; g.strokeRect(r.x, r.y + r.h - 22, r.w, 22);
  letter(g, twin ? 'CANDY' : 'NEWS', r.x + r.w / 2, r.y + r.h / 2 - 14, 22, C.cream);
  finish(g, r, c.o, 3);
}

/* ------------------------------------------------------------------ round and hand-placed things */

function basin(g: G, p: MapPoly, pts: Pt[]) {
  trace(g, pts); g.fillStyle = C.water; g.fill();
  g.save(); trace(g, pts); g.clip();
  const gr = g.createRadialGradient(3000, 3000, 240, 3000, 3000, 340);
  gr.addColorStop(0, 'rgba(255,255,255,0.15)'); gr.addColorStop(1, 'rgba(10,40,60,0.35)');
  g.fillStyle = gr; g.fillRect(2600, 2600, 800, 800);
  g.strokeStyle = hexA(C.waterHi, 0.5); g.lineWidth = 1.6;
  for (let rad = 262; rad < 322; rad += 14) { g.beginPath(); g.arc(3000, 3000, rad, 0, TAU); g.stroke(); }
  // coins at the bottom, a few wishes each
  for (let i = 0; i < 40; i++) { const a = hash(i, 7) * TAU, rad = 262 + hash(i, 8) * 56; disc(g, 3000 + Math.cos(a) * rad, 3000 + Math.sin(a) * rad, 2.2, hash(i, 9) < 0.7 ? '#d8b04a' : '#b0b0b0', 0); }
  g.restore();
  // the granite rim, inner and outer
  g.strokeStyle = C.graniteHi; g.lineWidth = 10; trace(g, pts); g.stroke();
  g.strokeStyle = INK; g.lineWidth = 2; trace(g, pts); g.stroke();
  void p;
}

function statue(g: G, p: MapPoly, pts: Pt[], twin: boolean) {
  const b = boundsOf(pts), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, rad = (b.x1 - b.x0) / 2;
  // the plinth's front, its stepped top, a plaque, and the bronze on top: the founder with a book (the twin: a runner mid-stride)
  g.fillStyle = C.graniteLo; g.fillRect(cx - rad, cy, rad * 2, 46);
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(cx - rad, cy + 30, rad * 2, 16);
  g.strokeStyle = INK; g.lineWidth = 2; g.strokeRect(cx - rad, cy, rad * 2, 46);
  box(g, cx - 22, cy + 12, 44, 16, '#b08a3a', 1.4);
  disc(g, cx, cy, rad, C.granite, 2); disc(g, cx, cy, rad - 12, C.graniteHi, 1.6);
  const s = 1.1;
  g.save(); g.translate(cx, cy); g.rotate(twin ? 0.6 : -0.3);
  g.fillStyle = 'rgba(14,16,22,0.3)'; g.beginPath(); g.ellipse(6, 8, 26, 14, 0, 0, TAU); g.fill();
  g.strokeStyle = INK; g.lineWidth = 9 * s; g.lineCap = 'round';
  const limbs = twin ? [[-18, 14, 0, 0], [16, 16, 0, 0], [0, 0, -16, -14], [0, 0, 20, -8]] : [[-10, 16, 0, 0], [10, 16, 0, 0], [0, -6, -20, -20], [0, -6, 16, 4]];
  for (const [x0, y0, x1, y1] of limbs) { g.beginPath(); g.moveTo(x0!, y0!); g.lineTo(x1!, y1!); g.stroke(); }
  g.strokeStyle = C.bronze; g.lineWidth = 5.5 * s;
  for (const [x0, y0, x1, y1] of limbs) { g.beginPath(); g.moveTo(x0!, y0!); g.lineTo(x1!, y1!); g.stroke(); }
  disc(g, 0, -4, 13, C.bronze, 2); disc(g, 0, -14, 9, C.bronzeHi, 2);
  if (!twin) box(g, 12, 0, 12, 9, C.bronzeLo, 1.4);
  g.restore();
  g.lineCap = 'butt';
  void p;
}

function crane(g: G, pts: Pt[]) {
  const b = boundsOf(pts), w = b.x1 - b.x0;
  // ballast blocks round the foot, then the lattice mast seen from above
  for (const [dx, dy] of [[-30, -30], [w + 6, -30], [-30, w + 6], [w + 6, w + 6]] as const) box(g, b.x0 + dx, b.y0 + dy, 24, 24, '#8a8a84');
  g.fillStyle = C.yellowLo; g.fillRect(b.x0, b.y1, w, 30);
  g.strokeStyle = INK; g.lineWidth = 2; g.strokeRect(b.x0, b.y1, w, 30);
  g.strokeStyle = C.yellow; g.lineWidth = 3; g.beginPath(); for (let y = b.y1; y < b.y1 + 30; y += 15) { g.moveTo(b.x0, y); g.lineTo(b.x1, y + 15); g.moveTo(b.x1, y); g.lineTo(b.x0, y + 15); } g.stroke();
  box(g, b.x0, b.y0, w, w, C.yellow, 2.4);
  g.strokeStyle = C.yellowLo; g.lineWidth = 4; g.beginPath(); g.moveTo(b.x0, b.y0); g.lineTo(b.x1, b.y1); g.moveTo(b.x1, b.y0); g.lineTo(b.x0, b.y1); g.stroke();
  g.strokeStyle = INK; g.lineWidth = 2; g.strokeRect(b.x0 + 8, b.y0 + 8, w - 16, w - 16);
}

function pond(g: G, pts: Pt[], twin: boolean) {
  trace(g, pts); g.fillStyle = C.water; g.fill();
  g.save(); trace(g, pts); g.clip();
  const b = boundsOf(pts), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  g.fillStyle = 'rgba(10, 40, 50, 0.3)'; g.beginPath(); g.ellipse(cx + 8, cy + 10, (b.x1 - b.x0) * 0.4, (b.y1 - b.y0) * 0.35, 0, 0, TAU); g.fill();
  for (let i = 0; i < 9; i++) {
    const x = b.x0 + 30 + hash(i, 3) * (b.x1 - b.x0 - 60), y = b.y0 + 20 + hash(i, 4) * (b.y1 - b.y0 - 40);
    g.fillStyle = C.greenHi; g.beginPath(); g.moveTo(x, y); g.arc(x, y, 10, 0.4, TAU - 0.2); g.closePath(); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.2; g.stroke();
    if (i % 3 === 0) disc(g, x + 3, y - 2, 3, twin ? '#ff8ab0' : '#f0f0f8', 0.8);
  }
  g.restore();
  g.strokeStyle = C.stone; g.lineWidth = 9; trace(g, pts); g.stroke();
  g.strokeStyle = INK; g.lineWidth = 2; trace(g, pts); g.stroke();
  // two ducks, drawn the way a child would
  for (const [x, y, k] of [[cx - 50, cy - 10, 1], [cx + 30, cy + 25, -1]] as const) {
    g.fillStyle = '#f0e8c8'; g.beginPath(); g.ellipse(x, y, 11, 7, 0, 0, TAU); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.4; g.stroke();
    disc(g, x + 8 * k, y - 6, 5, '#3a7a4a', 1.2); g.fillStyle = '#e8a03a'; g.fillRect(x + 12 * k - (k < 0 ? 5 : 0), y - 7, 5, 3);
  }
}

const LIVERY = ['#b8433a', '#3a6ab0', '#e8e4dc', '#2f8a5a', '#d8a83a', '#5a5e66', '#8a3a6a', '#2a2e36'] as const;
function vehicle(g: G, p: MapPoly, v: Vehicle, x: number, y: number, rot: number, twin: boolean) {
  const s = VEHICLE_SIZE[v.kind], L = s.len, Wd = s.wid, h = p.height ?? 26;
  // the side and front faces hang below the footprint, then the body is drawn turned
  g.save();
  g.fillStyle = 'rgba(12,14,20,0.35)';
  trace(g, wound(p.points).map((q) => ({ x: q.x, y: q.y + h * 0.6 }))); g.fill();
  for (const [a, b] of southEdges(wound(p.points))) { g.fillStyle = '#26282e'; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(b.x, b.y + h * 0.7); g.lineTo(a.x, a.y + h * 0.7); g.closePath(); g.fill(); g.strokeStyle = INK; g.lineWidth = 2; g.stroke(); }
  g.translate(x, y); g.rotate(rot);
  const body = v.kind === 'bus' ? (twin ? '#2f7a5a' : '#c8402a') : v.kind === 'mixer' ? '#e8e4dc' : v.kind === 'foodtruck' ? (v.livery ? '#e86aa0' : '#e8902a') : LIVERY[(v.livery + (twin ? 3 : 0)) % LIVERY.length]!;
  const hi = mix(body, 255, 0.25), lo = mix(body, 0, 0.3);
  rr(g, -L / 2, -Wd / 2, L, Wd, 16); g.fillStyle = body; g.fill(); g.strokeStyle = INK; g.lineWidth = 2.4; g.stroke();
  // wheels peeking out
  g.fillStyle = '#1a1a1e';
  for (const wx of [-L * 0.33, L * 0.33]) for (const wy of [-Wd / 2 - 3, Wd / 2 - 5]) g.fillRect(wx - 16, wy, 32, 8);
  if (v.kind === 'car' || v.kind === 'van') {
    const cab = v.kind === 'van' ? 0.26 : 0.34;
    rr(g, -L * cab, -Wd / 2 + 10, L * (v.kind === 'van' ? 0.62 : 0.5), Wd - 20, 12); g.fillStyle = hi; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.6; g.stroke();
    g.fillStyle = '#3a5a6a'; g.beginPath(); g.moveTo(L * 0.18, -Wd / 2 + 12); g.lineTo(L * 0.3, -Wd / 2 + 16); g.lineTo(L * 0.3, Wd / 2 - 16); g.lineTo(L * 0.18, Wd / 2 - 12); g.closePath(); g.fill(); g.stroke();
    if (v.kind === 'car') { g.beginPath(); g.moveTo(-L * 0.3, -Wd / 2 + 14); g.lineTo(-L * 0.36, -Wd / 2 + 16); g.lineTo(-L * 0.36, Wd / 2 - 16); g.lineTo(-L * 0.3, Wd / 2 - 14); g.closePath(); g.fill(); g.stroke(); }
    else letter(g, twin ? 'COURIER' : 'FLOWERS', -L * 0.02, 0, 15, lo);
    for (const wy of [-Wd / 2 + 10, Wd / 2 - 18]) { g.fillStyle = '#fff6c8'; g.fillRect(L / 2 - 8, wy, 6, 8); g.fillStyle = '#c8302a'; g.fillRect(-L / 2 + 2, wy, 6, 8); }
  } else if (v.kind === 'bus') {
    g.fillStyle = '#2f4a58'; for (let t = -L / 2 + 40; t < L / 2 - 60; t += 44) { g.fillRect(t, -Wd / 2 + 3, 36, 8); g.fillRect(t, Wd / 2 - 11, 36, 8); }
    g.fillStyle = lo; g.fillRect(-L / 2 + 4, -Wd / 2 + 16, L - 8, Wd - 32);
    for (const t of [-L * 0.25, L * 0.12]) box(g, t - 30, -24, 60, 48, '#9aa0a8', 1.6);
    g.fillStyle = '#3a5a6a'; g.fillRect(L / 2 - 22, -Wd / 2 + 10, 16, Wd - 20);
    box(g, L / 2 - 60, -14, 30, 28, '#1a1a1e', 1.2); letter(g, twin ? '7' : '12', L / 2 - 45, 0, 18, '#ffb000');
  } else if (v.kind === 'foodtruck') {
    // a serving hatch with its awning pushed out on one side, a roof vent, a menu board
    g.fillStyle = hi; g.fillRect(-L / 2 + 8, -Wd / 2 + 8, L * 0.66, Wd - 16);
    g.fillStyle = '#3a5a6a'; g.fillRect(L / 2 - 26, -Wd / 2 + 12, 16, Wd - 24);
    for (let t = -L / 2 + 20; t < L * 0.1; t += 22) { g.fillStyle = (t / 22) % 2 < 1 ? C.cream : body; g.fillRect(t, Wd / 2 - 2, 22, 22); }
    g.strokeStyle = INK; g.lineWidth = 1.6; g.strokeRect(-L / 2 + 20, Wd / 2 - 2, L * 0.6 - 10, 22);
    box(g, -L * 0.15, -18, 36, 36, '#8a929c', 1.6); g.strokeStyle = INK; g.beginPath(); g.moveTo(-L * 0.15, 0); g.lineTo(-L * 0.15 + 36, 0); g.stroke();
    letter(g, v.livery ? 'GELATO' : 'TACOS', -L * 0.3, -Wd * 0.2, 20, INK);
  } else {
    // the mixer: cab up front, the drum striped and tilted behind
    box(g, L / 2 - 90, -Wd / 2 + 6, 80, Wd - 12, C.yellow, 1.8);
    g.fillStyle = '#3a5a6a'; g.fillRect(L / 2 - 30, -Wd / 2 + 14, 14, Wd - 28);
    g.save(); g.beginPath(); g.ellipse(-L * 0.12, 0, L * 0.34, Wd / 2 - 6, 0, 0, TAU); g.fillStyle = '#e07a2a'; g.fill(); g.clip();
    g.strokeStyle = C.cream; g.lineWidth = 12; for (let t = -L; t < L; t += 40) { g.beginPath(); g.moveTo(t, -Wd); g.lineTo(t + 60, Wd); g.stroke(); }
    g.restore(); g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.ellipse(-L * 0.12, 0, L * 0.34, Wd / 2 - 6, 0, 0, TAU); g.stroke();
  }
  g.restore();
}

function table(g: G, pts: Pt[], umbrella: boolean, accent: string, seed: number) {
  const b = boundsOf(pts), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, rad = (b.x1 - b.x0) / 2;
  for (let k = 0; k < 3; k++) { const a = hash(seed, k) * 0.6 + (k * TAU) / 3; shade(g, cx + Math.cos(a) * (rad + 12), cy + Math.sin(a) * (rad + 12), 10, 8, 0.2); disc(g, cx + Math.cos(a) * (rad + 12), cy + Math.sin(a) * (rad + 12), 9, '#3a3e46', 1.4); }
  shade(g, cx, cy, rad, rad * 0.8); disc(g, cx, cy, rad, '#d8d4c8', 2);
  if (umbrella) {
    const R = rad + 40;
    g.fillStyle = 'rgba(14,16,22,0.25)'; g.beginPath(); g.arc(cx + 10, cy + 14, R, 0, TAU); g.fill();
    for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? C.cream : accent; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, (k * TAU) / 8, ((k + 1) * TAU) / 8); g.closePath(); g.fill(); }
    g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1.4; g.beginPath(); for (let k = 0; k < 8; k++) { g.moveTo(cx, cy); g.lineTo(cx + Math.cos((k * TAU) / 8) * R, cy + Math.sin((k * TAU) / 8) * R); } g.stroke();
    disc(g, cx, cy, 4, C.steel, 1.2);
  } else { disc(g, cx - 6, cy - 4, 5, C.white, 1); disc(g, cx + 7, cy + 5, 4, C.white, 1); }
}

function bench(g: G, pts: Pt[]) {
  const w = wound(pts);
  for (const [a, b] of southEdges(w)) { g.fillStyle = '#2a2e36'; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(b.x, b.y + 9); g.lineTo(a.x, a.y + 9); g.closePath(); g.fill(); }
  trace(g, w); g.fillStyle = C.wood; g.fill();
  const [p0, p1, , p3] = w as [Pt, Pt, Pt, Pt];
  const ux = (p1.x - p0.x), uy = (p1.y - p0.y), vx = (p3.x - p0.x), vy = (p3.y - p0.y);
  g.strokeStyle = C.woodLo; g.lineWidth = 2;
  for (let k = 1; k < 4; k++) { const t = k / 4; g.beginPath(); g.moveTo(p0.x + vx * t, p0.y + vy * t); g.lineTo(p0.x + vx * t + ux, p0.y + vy * t + uy); g.stroke(); }
  g.strokeStyle = '#2a2e36'; g.lineWidth = 4;
  for (const t of [0.12, 0.88]) { g.beginPath(); g.moveTo(p0.x + ux * t, p0.y + uy * t); g.lineTo(p0.x + ux * t + vx, p0.y + uy * t + vy); g.stroke(); }
  g.strokeStyle = INK; g.lineWidth = 2; trace(g, w); g.stroke();
}

function tree(g: G, x: number, y: number, R: number, seed: number, blossom: string | null) {
  g.fillStyle = 'rgba(14, 18, 14, 0.3)'; g.beginPath(); g.ellipse(x + 14, y + 20, R, R * 0.85, 0, 0, TAU); g.fill();
  disc(g, x, y, R, C.greenLo, 2.2);
  for (let i = 0; i < 9; i++) { const a = hash(seed, i) * TAU, d = R * (0.2 + hash(seed, i, 2) * 0.5), r = R * (0.32 + hash(seed, i, 3) * 0.2); disc(g, x + Math.cos(a) * d, y + Math.sin(a) * d - 2, r, i % 3 === 0 ? C.green : C.greenHi, 1.4); }
  g.fillStyle = 'rgba(255,255,210,0.18)'; g.beginPath(); g.arc(x - R * 0.3, y - R * 0.35, R * 0.4, 0, TAU); g.fill();
  if (blossom) for (let i = 0; i < 14; i++) { const a = hash(seed, i, 7) * TAU, d = R * hash(seed, i, 8) * 0.85; disc(g, x + Math.cos(a) * d, y + Math.sin(a) * d, 3, blossom, 0.6); }
}

/* ------------------------------------------------------------------ dispatch and sprite cache */

const RECT_PAINT: Record<string, (g: G, c: Ctx) => void> = {
  pzwall: wall, pzpart: wall, pzglass: glass, pzdesk: desk, pzshelf: shelf, pzplanter: planter, pzhoard: hoard, pzpillar: pillar,
  pzstack: stack, pzcore: core, pzscaffold: scaffold, pzcabin: cabin, pzmetro: metro, pzkiosk: kiosk, pzhedge: hedge,
};

function paint(g: G, p: MapPoly, map: MapDef) {
  const pts = wound(p.points);
  const b = boundsOf(pts);
  const r: Box = { x: b.x0, y: b.y0, w: b.x1 - b.x0, h: b.y1 - b.y0 };
  const here = hereAt(r.x + r.w / 2, r.y + r.h / 2);
  const id = p.id ?? p.material, twin = isTwin(p.id), seed = hashStr(baseId(id));
  const rect = RECT_PAINT[p.material];
  if (rect) {
    const style = p.material === 'pzpart' ? 'site' : here.style;
    rect(g, { p, pts, r, o: openSides(map, p.material, r), style, accent: here.accent, twin: here.twin, seed, h: p.height ?? 14 });
    return;
  }
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  switch (p.material) {
    case 'pzbasin': basin(g, p, pts); return;
    case 'pzstatue': statue(g, p, pts, twin); return;
    case 'pzcrane': crane(g, pts); return;
    case 'pzpond': pond(g, pts, twin); return;
    case 'pzbench': bench(g, pts); return;
    case 'pztable': { const i = Number(baseId(id).slice(5)); table(g, pts, TABLES[i]?.[3] === 1, here.accent, seed); return; }
    case 'pztree': { const t = TREES[Number(baseId(id).slice(4))]; tree(g, cx, cy, t?.[2] ?? 60, seed, here.style === 'park' ? (twin ? '#ff9ac0' : null) : null); return; }
    case 'pzvehicle': {
      const v = VEHICLES.find((q) => q.id === baseId(id));
      if (v) vehicle(g, p, v, cx, cy, v.rot + (twin ? Math.PI : 0), twin);
      return;
    }
  }
}

const sprites = new WeakMap<MapPoly, Sprite>();
const PAD: Record<string, number> = { pztree: 90, pztable: 80, pzvehicle: 60, pzcrane: 50, pzstatue: 60 };
export function drawPlazaPoly(g: G, p: MapPoly, info: GeoInfo): boolean {
  if (!p.material.startsWith('pz')) return false;
  let s = sprites.get(p);
  if (!s) {
    const b = boundsOf(p.points), pad = PAD[p.material] ?? 30;
    s = bake(b.x0 - pad, b.y0 - pad, b.x1 + pad, b.y1 + (p.height ?? 14) + pad, (c) => paint(c, p, info.map));
    sprites.set(p, s);
  }
  g.drawImage(s.canvas, s.x, s.y);
  return true;
}

/* ------------------------------------------------------------------ roofs */

function roofPaint(g: G, roof: MapRoof) {
  const pts = wound(roof.points), b = boundsOf(pts);
  const r: Box = { x: b.x0, y: b.y0, w: b.x1 - b.x0, h: b.y1 - b.y0 };
  const seed = hashStr(baseId(roof.id)), twin = isTwin(roof.id), m = roof.material ?? 'pzgravel';
  const base = { pzdeck: '#7e7e78', pzglassroof: '#3e444e', pzgreen: '#5a7a3e', pzcopper: '#4f8f80', pzgravel: '#8a8680', pzsolar: '#6a6e74' }[m] ?? '#8a8680';
  // the parapet's front face along the south edge
  g.fillStyle = mix(base, 0, 0.45); g.fillRect(r.x, r.y + r.h, r.w, 12);
  g.strokeStyle = INK; g.lineWidth = 2; g.strokeRect(r.x, r.y + r.h, r.w, 12);
  g.fillStyle = base; g.fillRect(r.x, r.y, r.w, r.h);
  g.save(); g.beginPath(); g.rect(r.x + 10, r.y + 10, r.w - 20, r.h - 20); g.clip();
  const unit = (x: number, y: number, w: number, h: number) => { shade(g, x + w / 2, y + h / 2, w / 2 + 4, h / 2 + 4, 0.3); box(g, x, y, w, h, '#9aa0a8', 1.8); disc(g, x + w / 2, y + h / 2, Math.min(w, h) * 0.32, '#5a626e', 1.4); g.strokeStyle = '#3a404a'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + w / 2 - Math.min(w, h) * 0.3, y + h / 2); g.lineTo(x + w / 2 + Math.min(w, h) * 0.3, y + h / 2); g.stroke(); };
  if (m === 'pzdeck') {
    // the top deck of the garage: bays, arrows, two cars that got the good spots, the stair house
    g.strokeStyle = hexA(C.line, 0.85); g.lineWidth = 6; g.beginPath();
    for (let x = r.x + 80; x < r.x + r.w - 40; x += 130) { g.moveTo(x, r.y + 30); g.lineTo(x, r.y + 300); g.moveTo(x, r.y + r.h - 300); g.lineTo(x, r.y + r.h - 30); }
    g.moveTo(r.x + 80, r.y + 300); g.lineTo(r.x + r.w - 300, r.y + 300); g.moveTo(r.x + 80, r.y + r.h - 300); g.lineTo(r.x + r.w - 40, r.y + r.h - 300);
    g.stroke();
    for (let x = r.x + 280; x < r.x + r.w - 100; x += 260) letter(g, '➜', x, r.y + r.h / 2, 46, hexA(C.line, 0.5));
    for (const [x, y, col] of [[r.x + 145, r.y + 170, twin ? '#3a6ab0' : '#d8a83a'], [r.x + 535, r.y + r.h - 170, twin ? '#b8433a' : '#2f8a5a']] as const) {
      g.save(); g.translate(x, y); g.rotate(Math.PI / 2); rr(g, -110, -50, 220, 100, 14); g.fillStyle = col; g.fill(); g.strokeStyle = INK; g.lineWidth = 2; g.stroke(); rr(g, -60, -38, 110, 76, 10); g.fillStyle = mix(col, 255, 0.25); g.fill(); g.stroke(); g.restore();
    }
    box(g, r.x + r.w - 230, r.y + 40, 170, 130, '#9a9a94', 2);
    letter(g, twin ? 'P2' : 'P', r.x + r.w - 145, r.y + 105, 48, '#ffd34d');
  } else if (m === 'pzglassroof') {
    // the tower lobby's roof: membrane, a run of skylights over the hall, plant, and a helipad for the people upstairs
    g.fillStyle = 'rgba(255,255,255,0.05)'; for (let y = r.y; y < r.y + r.h; y += 40) g.fillRect(r.x, y, r.w, 20);
    for (let y = r.y + 80; y < r.y + r.h - 80; y += 70) for (let x = r.x + r.w - 340; x < r.x + r.w - 60; x += 70) { box(g, x, y, 62, 62, '#6fa8bc', 1.6); g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); g.moveTo(x + 6, y + 56); g.lineTo(x + 40, y + 6); g.lineTo(x + 50, y + 6); g.lineTo(x + 16, y + 56); g.fill(); }
    const hx = r.x + 280, hy = r.y + r.h / 2;
    disc(g, hx, hy, 150, '#2e333b', 2.4); g.strokeStyle = twin ? '#ffd27a' : '#e8e4dc'; g.lineWidth = 8; g.beginPath(); g.arc(hx, hy, 130, 0, TAU); g.stroke();
    letter(g, 'H', hx, hy, 120, twin ? '#ffd27a' : '#e8e4dc');
    unit(r.x + 40, r.y + 40, 80, 60); unit(r.x + 40, r.y + r.h - 110, 80, 60);
  } else if (m === 'pzgreen') {
    for (let i = 0; i < (r.w * r.h) / 2500; i++) { const x = r.x + hash(seed, i, 1) * r.w, y = r.y + hash(seed, i, 2) * r.h; g.fillStyle = ['#6f9a4a', '#8aa84a', '#4f7a3a', '#a85a4a', '#c8b04a'][Math.floor(hash(seed, i, 3) * 5)]!; g.beginPath(); g.arc(x, y, 14 + hash(seed, i, 4) * 18, 0, TAU); g.fill(); }
    g.fillStyle = C.gravel; g.fillRect(r.x, r.y + r.h / 2 - 20, r.w, 40);
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2; g.strokeRect(r.x - 2, r.y + r.h / 2 - 20, r.w + 4, 40);
    // a beehive, and a deckchair someone carried up
    box(g, r.x + 40, r.y + 40, 40, 36, '#e8c84a', 1.8); for (let k = 0; k < 3; k++) { g.fillStyle = INK; g.fillRect(r.x + 44, r.y + 50 + k * 9, 32, 2); }
    g.save(); g.translate(r.x + r.w - 110, r.y + r.h - 110); g.rotate(0.4); box(g, -24, -40, 48, 80, twin ? '#3a8ac8' : '#e85a5a', 1.8); for (let k = -16; k < 24; k += 16) { g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(-24, k, 48, 6); } g.restore();
  } else if (m === 'pzcopper') {
    g.strokeStyle = 'rgba(14,40,36,0.5)'; g.lineWidth = 3; g.beginPath(); for (let x = r.x + 20; x < r.x + r.w; x += 36) { g.moveTo(x, r.y); g.lineTo(x, r.y + r.h); } g.stroke();
    g.strokeStyle = 'rgba(170,225,205,0.3)'; g.lineWidth = 3; g.beginPath(); for (let x = r.x + 24; x < r.x + r.w; x += 36) { g.moveTo(x, r.y); g.lineTo(x, r.y + r.h); } g.stroke();
    for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(190,235,215,0.15)'; g.fillRect(r.x + hash(seed, i) * r.w, r.y + hash(seed, i, 1) * r.h, 30, 18); }
    // the reading room's lantern: a raised glass box at the centre
    const lx = r.x + r.w / 2 - 120, ly = r.y + r.h / 2 - 100;
    g.fillStyle = 'rgba(14,16,22,0.3)'; g.fillRect(lx + 10, ly + 14, 240, 200);
    box(g, lx, ly, 240, 200, '#7fb8c8', 2.4);
    g.strokeStyle = C.steelDk; g.lineWidth = 3; g.beginPath(); for (let x = lx + 40; x < lx + 240; x += 40) { g.moveTo(x, ly); g.lineTo(x, ly + 200); } g.moveTo(lx, ly + 100); g.lineTo(lx + 240, ly + 100); g.stroke();
    g.fillStyle = 'rgba(255,240,200,0.25)'; g.fillRect(lx, ly + 100, 240, 100);
  } else if (m === 'pzsolar') {
    g.fillStyle = 'rgba(255,255,255,0.06)'; for (let i = 0; i < (r.w * r.h) / 400; i++) g.fillRect(r.x + hash(seed, i) * r.w, r.y + hash(seed, i, 1) * r.h, 3, 3);
    for (let y = r.y + 40; y < r.y + r.h - 90; y += 110) for (let x = r.x + 30; x < r.x + r.w - 110; x += 120) {
      g.fillStyle = 'rgba(14,16,22,0.3)'; g.fillRect(x + 6, y + 10, 104, 74);
      box(g, x, y, 104, 74, '#2a3e6a', 1.8);
      g.strokeStyle = 'rgba(160,190,240,0.45)'; g.lineWidth = 1; g.beginPath(); for (let k = 1; k < 4; k++) { g.moveTo(x + k * 26, y); g.lineTo(x + k * 26, y + 74); } for (let k = 1; k < 3; k++) { g.moveTo(x, y + k * 25); g.lineTo(x + 104, y + k * 25); } g.stroke();
    }
  } else {
    // membrane laps, a water tank on its stand, a skylight over the shop floor, vent stacks
    g.strokeStyle = 'rgba(40, 38, 34, 0.25)'; g.lineWidth = 2; g.beginPath(); for (let y = r.y + 90; y < r.y + r.h; y += 90) { g.moveTo(r.x, y); g.lineTo(r.x + r.w, y); } g.stroke();
    const sk = { x: r.x + r.w * 0.3, y: r.y + r.h * 0.38, w: r.w * 0.4, h: 110 };
    g.fillStyle = 'rgba(14,16,22,0.3)'; g.fillRect(sk.x + 6, sk.y + 10, sk.w, sk.h);
    box(g, sk.x, sk.y, sk.w, sk.h, '#7fb2c4', 2); g.strokeStyle = C.steelDk; g.lineWidth = 3; g.beginPath(); for (let x = sk.x + 40; x < sk.x + sk.w; x += 40) { g.moveTo(x, sk.y); g.lineTo(x, sk.y + sk.h); } g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(sk.x + 4, sk.y + 4, sk.w - 8, 10);
    const tx = r.x + 110, ty = r.y + r.h - 130;
    shade(g, tx, ty, 44, 40, 0.35); disc(g, tx, ty, 38, twin ? '#8a6a4a' : '#a8b0b8', 2.2); disc(g, tx, ty, 26, twin ? '#6a4a2a' : '#8a929c', 1.6);
    for (const [vx, vy] of [[r.x + 60, r.y + 200], [r.x + 90, r.y + 210], [r.x + r.w - 70, r.y + 70]] as const) disc(g, vx, vy, 9, '#5a626e', 1.6);
    for (let i = 0; i < (r.w * r.h) / 120; i++) { g.fillStyle = hash(seed, i) > 0.5 ? 'rgba(220,214,200,0.28)' : 'rgba(30,28,24,0.22)'; g.fillRect(r.x + hash(seed, i, 1) * r.w, r.y + hash(seed, i, 2) * r.h, 3, 3); }
    unit(r.x + 40 + hash(seed, 5) * (r.w - 200), r.y + 60, 90, 70);
    unit(r.x + 200 + hash(seed, 6) * (r.w - 320), r.y + r.h - 160, 70, 60);
    disc(g, r.x + r.w - 80, r.y + r.h / 2, 26, '#c8ccd2', 2); disc(g, r.x + r.w - 80, r.y + r.h / 2, 6, '#5a626e', 1.2);
    box(g, r.x + 30, r.y + r.h / 2 - 30, 60, 60, '#7a7e86', 1.8);
  }
  g.restore();
  // parapet: lit north and west, shaded south and east, ink outline
  g.lineWidth = 10; g.strokeStyle = mix(base, 255, 0.22); g.beginPath(); g.moveTo(r.x + 5, r.y + r.h); g.lineTo(r.x + 5, r.y + 5); g.lineTo(r.x + r.w, r.y + 5); g.stroke();
  g.strokeStyle = mix(base, 0, 0.3); g.beginPath(); g.moveTo(r.x + r.w - 5, r.y); g.lineTo(r.x + r.w - 5, r.y + r.h - 5); g.lineTo(r.x, r.y + r.h - 5); g.stroke();
  g.strokeStyle = INK; g.lineWidth = 2; trace(g, pts); g.stroke();
}

const roofSprites = new Map<string, Sprite>();
export function drawPlazaRoof(g: G, roof: MapRoof, _alpha: number, info: GeoInfo): boolean {
  let s = roofSprites.get(roof.id);
  if (!s) {
    const b = boundsOf(roof.points);
    s = bake(b.x0 - 4, b.y0 - 4, b.x1 + 4, b.y1 + 18, (c) => roofPaint(c, roof));
    roofSprites.set(roof.id, s);
  }
  g.drawImage(s.canvas, s.x, s.y);
  if (info.dark > 0) { const b = boundsOf(roof.points); g.fillStyle = `rgba(20, 28, 60, ${(0.4 * info.dark).toFixed(3)})`; g.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0 + 12); }
  return true;
}
