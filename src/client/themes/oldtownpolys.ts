import type { MapDoor, MapPoly, MapRoof, Pt } from '../../shared/geom.ts';
import { CHURCH } from '../../shared/maps/oldtowngeo.ts';
import type { DoorLeaf } from '../../shared/sim/doors.ts';
import { drawExtruded, type GeoInfo, type PolyLook } from '../geoart.ts';
import { hingePins, paintDoor, type DoorStyle } from './geokit.ts';
import { C, TAU, at, baseId, bake, blit, boundsOf, centroid, disc, hash, hashStr, isTwin, shade, trace, wound, type Sprite } from './oldtownkit.ts';

/**
 * Old Town's polygons, roofs and doors. Every polygon and roof is baked once into a sprite (the engine calls these hooks every
 * frame) and blitted; doors are drawn live (they move). The bell tower's slate spire turns into the town hall's copper clock
 * tower on the other side, the West Gate's towers into the East Gate's, the altar into the mayor's desk, the wedding cart into
 * a coal cart. Roofs are gabled clay tile, slate or shingle with a ridge down the long side, chimneys and dormers, each house
 * its own shade, and the church roof follows the apse round.
 */
type G = CanvasRenderingContext2D;

const mix = (hex: string, to: number, t: number): string => {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (to - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};
const look = (top: string): PolyLook => ({ top, front: mix(top, 0, 0.42), lit: mix(top, 255, 0.22), shade: mix(top, 0, 0.3) });
const STONE = look(C.stone), OAK = look(C.oakLo);

const sprites = new Map<string, Sprite>();
function cached(key: string, pts: readonly Pt[], pad: number, foot: number, paint: (g: G) => void): Sprite {
  let s = sprites.get(key);
  if (!s) {
    const b = boundsOf(pts);
    s = bake(b.x0 - pad, b.y0 - pad - 90, b.x1 + pad, b.y1 + pad + foot, paint);
    sprites.set(key, s);
  }
  return s;
}

/* ---------------------------------------------------------------- set pieces */

function apse(g: G, p: MapPoly) {
  drawExtruded(g, wound(p.points), p.height ?? 18, STONE);
  const c = isTwin(p.id) ? { x: 6000 - CHURCH.apse.x, y: 6000 - CHURCH.apse.y } : CHURCH.apse;
  g.save(); trace(g, p.points); g.clip();
  g.strokeStyle = 'rgba(40, 36, 30, 0.45)'; g.lineWidth = 2;
  g.beginPath(); g.arc(c.x, c.y, (CHURCH.apse.rIn + CHURCH.apse.rOut) / 2, 0, TAU); g.stroke();
  for (let a = 0, k = 0; a < TAU; a += 0.11, k++) {
    const r0 = k % 2 ? CHURCH.apse.rIn : (CHURCH.apse.rIn + CHURCH.apse.rOut) / 2, r1 = k % 2 ? (CHURCH.apse.rIn + CHURCH.apse.rOut) / 2 : CHURCH.apse.rOut;
    g.beginPath(); g.moveTo(c.x + Math.cos(a) * r0, c.y + Math.sin(a) * r0); g.lineTo(c.x + Math.cos(a) * r1, c.y + Math.sin(a) * r1); g.stroke();
  }
  g.restore();
}

/** A round tower seen from above: its roof (a slate spire or a copper dome with a clock on the front) over a stone drum. */
function tower(g: G, p: MapPoly, kind: 'spire' | 'clock' | 'gate' | 'gate2') {
  const pts = wound(p.points), c = centroid(pts), r = Math.hypot(pts[0]!.x - c.x, pts[0]!.y - c.y), h = p.height ?? 56;
  // the drum: its front face in coursed stone, with an arched window or the clock
  drawExtruded(g, pts, h, STONE);
  g.save(); g.beginPath(); g.rect(c.x - r - 2, c.y, r * 2 + 4, r + h + 4); g.clip();
  g.strokeStyle = 'rgba(40, 36, 30, 0.4)'; g.lineWidth = 2;
  for (let yy = c.y + 10; yy < c.y + r + h; yy += 12) { g.beginPath(); g.moveTo(c.x - r, yy); g.lineTo(c.x + r, yy); g.stroke(); }
  g.restore();
  const fy = c.y + r + h * 0.45;
  if (kind === 'clock') {
    disc(g, c.x, fy, Math.min(20, h * 0.36), '#efe6cf', 2.4);
    g.strokeStyle = C.ink; g.lineWidth = 2.6; g.beginPath(); g.moveTo(c.x, fy); g.lineTo(c.x, fy - 13); g.moveTo(c.x, fy); g.lineTo(c.x + 9, fy + 3); g.stroke();
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; g.fillStyle = C.ink; g.fillRect(c.x + Math.cos(a) * 15 - 1, fy + Math.sin(a) * 15 - 1, 2, 2); }
  } else {
    g.fillStyle = '#26303c'; g.beginPath(); g.moveTo(c.x - 8, fy + 12); g.lineTo(c.x - 8, fy - 6); g.arc(c.x, fy - 6, 8, Math.PI, 0); g.lineTo(c.x + 8, fy + 12); g.closePath(); g.fill();
    g.fillStyle = kind === 'spire' ? 'rgba(255, 210, 130, 0.65)' : 'rgba(255, 190, 110, 0.4)'; g.fill();
    g.strokeStyle = C.ink; g.lineWidth = 2; g.stroke();
  }
  // the roof
  if (kind === 'gate' || kind === 'gate2') {
    // a crenellated parapet round a flat lead roof, a flagpole with the town's pennant
    g.fillStyle = '#7a828c'; g.beginPath(); g.arc(c.x, c.y, r - 14, 0, TAU); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 2; g.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      at(g, c.x + Math.cos(a) * (r - 7), c.y + Math.sin(a) * (r - 7), a + Math.PI / 2, () => { g.fillStyle = i % 2 ? C.stoneHi : C.stone; g.fillRect(-9, -7, 18, 14); g.strokeStyle = C.ink; g.lineWidth = 1.6; g.strokeRect(-9, -7, 18, 14); });
    }
    disc(g, c.x, c.y, 5, C.iron, 1.6);
    return;
  }
  const n = 8;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * TAU + Math.PI / 8, a1 = ((i + 1) / n) * TAU + Math.PI / 8;
    const lit = Math.cos((a0 + a1) / 2 + 2.2) * 0.5 + 0.5;
    const base = kind === 'spire' ? C.slate : C.copper;
    g.fillStyle = mix(base, lit > 0.5 ? 255 : 0, Math.abs(lit - 0.5) * 0.4);
    g.beginPath(); g.moveTo(c.x, c.y - 8); g.lineTo(c.x + Math.cos(a0) * (r + 6), c.y + Math.sin(a0) * (r + 6)); g.lineTo(c.x + Math.cos(a1) * (r + 6), c.y + Math.sin(a1) * (r + 6)); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(20, 24, 30, 0.6)'; g.lineWidth = 1.6; g.stroke();
  }
  g.strokeStyle = C.ink; g.lineWidth = 2.2; g.beginPath();
  for (let i = 0; i <= n; i++) { const a = (i / n) * TAU + Math.PI / 8; const x = c.x + Math.cos(a) * (r + 6), y = c.y + Math.sin(a) * (r + 6); if (i) g.lineTo(x, y); else g.moveTo(x, y); }
  g.stroke();
  // the finial: a gilt cross on the church, a weathercock on the town hall
  g.strokeStyle = C.ink; g.lineWidth = 5; g.beginPath(); g.moveTo(c.x, c.y - 8); g.lineTo(c.x, c.y - 40); g.stroke();
  g.strokeStyle = C.brass; g.lineWidth = 3; g.beginPath(); g.moveTo(c.x, c.y - 8); g.lineTo(c.x, c.y - 40);
  if (kind === 'spire') { g.moveTo(c.x - 9, c.y - 30); g.lineTo(c.x + 9, c.y - 30); }
  g.stroke();
  if (kind === 'clock') { g.fillStyle = C.brass; g.beginPath(); g.moveTo(c.x - 10, c.y - 44); g.lineTo(c.x + 12, c.y - 40); g.lineTo(c.x - 4, c.y - 34); g.closePath(); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 1.4; g.stroke(); }
}

function altar(g: G, p: MapPoly, twin: boolean) {
  const pts = wound(p.points), b = boundsOf(pts);
  drawExtruded(g, pts, p.height ?? 12, twin ? OAK : look('#e8e0cc'));
  if (twin) {
    // the mayor's desk: green leather, a ledger, an inkwell and the chain of office
    g.fillStyle = '#3f6a4a'; g.fillRect(b.x0 + 6, b.y0 + 8, b.x1 - b.x0 - 12, b.y1 - b.y0 - 16);
    g.fillStyle = '#efe6cf'; g.fillRect(b.x0 + 14, b.y0 + 30, 24, 32); g.strokeStyle = C.ink; g.lineWidth = 1.2; g.strokeRect(b.x0 + 14, b.y0 + 30, 24, 32);
    disc(g, b.x0 + 30, b.y0 + 84, 5, C.ink, 1);
    g.strokeStyle = C.brass; g.lineWidth = 2.4; g.beginPath(); g.arc(b.x0 + 30, b.y0 + 100, 10, 0.2, Math.PI - 0.2); g.stroke();
    return;
  }
  g.fillStyle = '#c9a24a'; g.fillRect(b.x0 + 4, b.y0, 6, b.y1 - b.y0);
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  g.strokeStyle = C.brass; g.lineWidth = 4; g.beginPath(); g.moveTo(cx, cy - 18); g.lineTo(cx, cy + 18); g.moveTo(cx - 10, cy - 6); g.lineTo(cx + 10, cy - 6); g.stroke();
  for (const dy of [-44, 44]) { disc(g, cx, cy + dy, 5, '#efe6cf', 1.4); g.fillStyle = C.lampHot; g.beginPath(); g.arc(cx, cy + dy - 6, 3, 0, TAU); g.fill(); }
}

function pew(g: G, p: MapPoly) {
  const pts = wound(p.points), b = boundsOf(pts);
  drawExtruded(g, pts, p.height ?? 10, OAK);
  g.fillStyle = C.beamLo; g.fillRect(b.x1 - 9, b.y0, 6, b.y1 - b.y0);
  g.strokeStyle = 'rgba(20, 10, 4, 0.4)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(b.x0 + 12, b.y0 + 4); g.lineTo(b.x0 + 12, b.y1 - 4); g.stroke();
  g.fillStyle = '#7a2a2a'; g.fillRect(b.x0 + 4, b.y0 + 40 + hash(b.x0) * 50, 6, 10);
}

function fountain(g: G, p: MapPoly, twin: boolean) {
  const pts = wound(p.points), c = centroid(pts), r = Math.hypot(pts[0]!.x - c.x, pts[0]!.y - c.y);
  drawExtruded(g, pts, p.height ?? 14, look(C.stoneHi));
  g.fillStyle = C.water; g.beginPath(); g.arc(c.x, c.y, r - 16, 0, TAU); g.fill();
  g.fillStyle = 'rgba(160, 210, 220, 0.25)'; g.beginPath(); g.arc(c.x - 10, c.y - 10, r - 40, 0, TAU); g.fill();
  g.strokeStyle = C.ink; g.lineWidth = 2; g.beginPath(); g.arc(c.x, c.y, r - 16, 0, TAU); g.stroke();
  // coins on the bottom
  for (let i = 0; i < 9; i++) { const a = hash(i, 7) * TAU, d = 30 + hash(i, 8) * (r - 56); g.fillStyle = i % 3 ? '#c9a24a' : '#b0b8c0'; g.beginPath(); g.arc(c.x + Math.cos(a) * d, c.y + Math.sin(a) * d, 2.6, 0, TAU); g.fill(); }
  // the column, and the statue on it (a saint with a lamb; the twin a lion with a shield)
  drawExtruded(g, Array.from({ length: 12 }, (_, i) => ({ x: c.x + Math.cos((i / 12) * TAU) * 26, y: c.y + Math.sin((i / 12) * TAU) * 26 })), 30, look(C.stone));
  disc(g, c.x, c.y, 18, twin ? '#9a8a6a' : '#8a9a92', 2);
  if (twin) { disc(g, c.x - 4, c.y - 2, 9, '#b09a6a', 1.6); g.fillStyle = '#7a3a2a'; g.fillRect(c.x + 4, c.y - 6, 8, 12); g.strokeStyle = C.ink; g.lineWidth = 1.2; g.strokeRect(c.x + 4, c.y - 6, 8, 12); }
  else { disc(g, c.x, c.y - 4, 7, '#a8b4ac', 1.6); disc(g, c.x + 9, c.y + 6, 5, '#e8e2d0', 1.2); }
}

function well(g: G, p: MapPoly) {
  const pts = wound(p.points), c = centroid(pts), r = Math.hypot(pts[0]!.x - c.x, pts[0]!.y - c.y);
  drawExtruded(g, pts, p.height ?? 22, STONE);
  g.fillStyle = '#16202a'; g.beginPath(); g.arc(c.x, c.y, r - 14, 0, TAU); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 2; g.stroke();
  g.fillStyle = 'rgba(120, 170, 190, 0.35)'; g.beginPath(); g.arc(c.x - 4, c.y - 4, r - 30, 0, TAU); g.fill();
  // the winch: two posts and a beam across with a rope and a bucket
  for (const dx of [-r + 6, r - 6]) { disc(g, c.x + dx, c.y, 6, C.oakLo, 1.6); }
  g.fillStyle = C.oak; g.fillRect(c.x - r + 2, c.y - 5, r * 2 - 4, 10); g.strokeStyle = C.ink; g.lineWidth = 1.8; g.strokeRect(c.x - r + 2, c.y - 5, r * 2 - 4, 10);
  g.fillStyle = C.oakHi; g.fillRect(c.x - 10, c.y - 7, 20, 14); g.strokeRect(c.x - 10, c.y - 7, 20, 14);
  disc(g, c.x + 20, c.y + 22, 9, C.oak, 1.6); g.strokeStyle = C.iron; g.lineWidth = 2; g.beginPath(); g.arc(c.x + 20, c.y + 22, 6, 0, TAU); g.stroke();
}

/** A handcart: plank bed, two big wheels, shafts out front; what it carries depends on where it stands. */
function cart(g: G, p: MapPoly) {
  const pts = p.points;
  const c = centroid(pts), rot = Math.atan2(pts[1]!.y - pts[0]!.y, pts[1]!.x - pts[0]!.x);
  const id = baseId(p.id ?? ''), twin = isTwin(p.id);
  g.save(); g.translate(c.x, c.y); g.rotate(rot);
  shade(g, 4, 6, 66, 38, 0.3);
  // shafts and wheels
  g.strokeStyle = C.ink; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(54, -22); g.lineTo(104, -18); g.moveTo(54, 22); g.lineTo(104, 18); g.stroke();
  g.strokeStyle = C.oak; g.lineWidth = 3.6; g.stroke();
  for (const wy of [-40, 40]) { g.fillStyle = C.oakLo; g.beginPath(); g.roundRect(-26, wy - 7, 52, 14, 6); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 2; g.stroke(); g.fillStyle = C.iron; g.fillRect(-26, wy - 2, 52, 4); }
  g.fillStyle = C.oak; g.fillRect(-58, -32, 116, 64); g.strokeStyle = C.ink; g.lineWidth = 2; g.strokeRect(-58, -32, 116, 64);
  g.fillStyle = C.oakLo; g.fillRect(-58, -32, 116, 7); g.fillRect(-58, 25, 116, 7);
  g.strokeStyle = 'rgba(30, 16, 6, 0.45)'; g.lineWidth = 1.5; g.beginPath(); for (let x = -46; x < 58; x += 14) { g.moveTo(x, -25); g.lineTo(x, 25); } g.stroke();
  if (id === 'cart-0') {
    // fish barrels and a net
    for (const [x, y] of [[-30, -10], [-6, 8], [20, -8], [36, 12]] as const) disc(g, x, y, 13, twin ? '#3a3634' : C.oakHi, 1.8);
    if (!twin) for (const [x, y] of [[-30, -10], [-6, 8], [20, -8], [36, 12]] as const) disc(g, x, y, 8, '#a8b4bd', 1.2);
  } else if (id === 'cart-1') {
    if (twin) { g.fillStyle = '#26282e'; g.beginPath(); g.ellipse(0, 0, 50, 24, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(120,130,150,0.4)'; for (let i = 0; i < 14; i++) g.fillRect(-40 + hash(i) * 80, -16 + hash(i, 2) * 30, 5, 4); }
    else {
      // just married: garlands of flowers and tin cans on strings behind
      for (let x = -50; x <= 50; x += 12) { disc(g, x, -26, 5, x % 24 ? '#f0a0b0' : '#f4f0e4', 1); disc(g, x, 26, 5, x % 24 ? '#f4f0e4' : '#f0a0b0', 1); }
      g.fillStyle = '#f4f0e4'; g.fillRect(-36, -12, 72, 24); g.strokeStyle = C.ink; g.lineWidth = 1.4; g.strokeRect(-36, -12, 72, 24);
      g.fillStyle = '#8a2a2a'; g.font = '700 13px "Barlow Condensed", "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('JUST MARRIED', 0, 1);
      g.strokeStyle = '#d8ccb0'; g.lineWidth = 1.4; for (const [ex, ey] of [[-90, -24], [-100, 4], [-86, 26]] as const) { g.beginPath(); g.moveTo(-58, ey * 0.5); g.lineTo(ex, ey); g.stroke(); disc(g, ex, ey, 6, '#b0b8c0', 1.2); }
    }
  } else {
    // hay, or apples on the other side
    if (twin) for (let i = 0; i < 26; i++) disc(g, -46 + (i % 9) * 11.5, -18 + Math.floor(i / 9) * 16, 6, i % 4 ? '#b4524a' : '#6a8a4a', 1);
    else { g.fillStyle = '#c9a85a'; g.beginPath(); g.roundRect(-52, -26, 104, 52, 12); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 1.6; g.stroke(); g.strokeStyle = 'rgba(255, 240, 180, 0.4)'; g.lineWidth = 1.4; for (let i = 0; i < 16; i++) { g.beginPath(); g.moveTo(-46 + i * 6, -20); g.lineTo(-40 + i * 6, 18); g.stroke(); } }
  }
  g.restore();
}

function trunk(g: G, p: MapPoly) {
  const c = centroid(p.points);
  shade(g, c.x, c.y + 6, 30, 16, 0.35);
  drawExtruded(g, wound(p.points), 22, look('#5a4030'));
  g.strokeStyle = 'rgba(20, 12, 6, 0.4)'; g.lineWidth = 2; g.beginPath(); g.arc(c.x, c.y, 14, 0.4, 2.4); g.stroke();
}

function paintPoly(g: G, p: MapPoly) {
  const twin = isTwin(p.id);
  switch (p.material) {
    case 'otaltar': altar(g, p, twin); return;
    case 'otpew': pew(g, p); return;
    case 'otfountain': fountain(g, p, twin); return;
    case 'otwell': well(g, p); return;
    case 'otcart': cart(g, p); return;
    case 'ottree': trunk(g, p); return;
  }
  if (p.shape === 'apse') { apse(g, p); return; }
  if (p.shape === 'belltower') { tower(g, p, twin ? 'clock' : 'spire'); return; }
  if (p.shape === 'gatetower') { tower(g, p, twin ? 'gate2' : 'gate'); return; }
  drawExtruded(g, wound(p.points), p.height ?? 14, STONE);
}

export function drawOldtownPoly(g: G, p: MapPoly, _info: GeoInfo): boolean {
  void _info;
  if (p.material === 'otcanal') return true;
  const s = cached(`p:${p.id ?? p.material}`, p.points, 60, 120, (c) => { c.lineJoin = 'round'; paintPoly(c, p); });
  blit(g, s);
  return true;
}

/* ---------------------------------------------------------------- roofs */

type Roofing = { base: string; hi: string; lo: string; course: number };
const ROOFING: Record<string, Roofing> = {
  tile: { base: C.tile, hi: C.tileHi, lo: C.tileLo, course: 16 },
  slate: { base: C.slate, hi: C.slateHi, lo: C.slateLo, course: 14 },
  shingle: { base: C.shingle, hi: '#94795a', lo: C.shingleLo, course: 12 },
};
/** Each house's tiles are a shade apart from its neighbours'. */
function roofingOf(r: MapRoof): Roofing {
  const base = ROOFING[r.material ?? 'tile'] ?? ROOFING.tile!;
  const k = hashStr(r.id) - 0.5;
  const shift = (hex: string) => mix(hex, k > 0 ? 255 : 0, Math.abs(k) * 0.22);
  return { base: shift(base.base), hi: shift(base.hi), lo: shift(base.lo), course: base.course };
}

/** One slope of a gabled roof: courses of tiles running along the ridge, each course a little offset, lighter toward the light. */
function slope(g: G, x: number, y: number, w: number, h: number, horiz: boolean, lit: boolean, rf: Roofing, seed: number) {
  g.fillStyle = lit ? rf.hi : rf.base; g.fillRect(x, y, w, h);
  const across = horiz ? h : w, along = horiz ? w : h;
  for (let c = 0, row = 0; c < across; c += rf.course, row++) {
    // the course's shadow line and staggered tile joints
    g.fillStyle = 'rgba(20, 12, 8, 0.32)';
    if (horiz) g.fillRect(x, y + c + rf.course - 3, w, 3); else g.fillRect(x + c + rf.course - 3, y, 3, h);
    for (let a = (row % 2) * 9; a < along; a += 18) {
      const k = hash(seed, row, a);
      if (k < 0.12) { g.fillStyle = k < 0.06 ? rf.lo : 'rgba(255, 240, 220, 0.16)'; if (horiz) g.fillRect(x + a, y + c, 18, rf.course - 3); else g.fillRect(x + c, y + a, rf.course - 3, 18); }
      g.fillStyle = 'rgba(20, 12, 8, 0.22)';
      if (horiz) g.fillRect(x + a, y + c, 2, rf.course - 3); else g.fillRect(x + c, y + a, rf.course - 3, 2);
    }
  }
  // moss on the shaded slopes
  if (!lit) for (let i = 0; i < (w * h) / 6000; i++) { g.fillStyle = 'rgba(100, 130, 70, 0.35)'; g.beginPath(); g.ellipse(x + hash(seed, i, 3) * w, y + hash(seed, i, 4) * h, 8 + hash(seed, i, 5) * 10, 5, 0, 0, TAU); g.fill(); }
}

function chimney(g: G, x: number, y: number) {
  drawExtruded(g, [{ x: x - 14, y: y - 12 }, { x: x + 14, y: y - 12 }, { x: x + 14, y: y + 12 }, { x: x - 14, y: y + 12 }], 18, look('#8a4a3a'));
  g.fillStyle = '#1c1f26'; g.fillRect(x - 8, y - 6, 16, 12);
  g.strokeStyle = 'rgba(40, 20, 14, 0.5)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x - 14, y); g.lineTo(x - 8, y); g.moveTo(x + 8, y); g.lineTo(x + 14, y); g.stroke();
}

function dormer(g: G, x: number, y: number, horiz: boolean, rf: Roofing) {
  // a little gabled window poking out of the slope, lamplit
  const w = horiz ? 36 : 30, h = horiz ? 30 : 36;
  g.fillStyle = 'rgba(14, 16, 24, 0.3)'; g.fillRect(x - w / 2 + 3, y - h / 2 + 4, w, h);
  g.fillStyle = rf.lo; g.fillRect(x - w / 2, y - h / 2, w, h);
  g.fillStyle = rf.hi; if (horiz) g.fillRect(x - w / 2, y - h / 2, w / 2, h); else g.fillRect(x - w / 2, y - h / 2, w, h / 2);
  g.strokeStyle = C.ink; g.lineWidth = 1.8; g.strokeRect(x - w / 2, y - h / 2, w, h);
  g.fillStyle = C.window; if (horiz) g.fillRect(x - 8, y + h / 2 - 2, 16, 8); else g.fillRect(x + w / 2 - 2, y - 8, 8, 16);
}

function roofPaint(g: G, r: MapRoof, pts: Pt[]) {
  const b = boundsOf(pts), w = b.x1 - b.x0, h = b.y1 - b.y0;
  const rf = roofingOf(r), seed = Math.round(hashStr(r.id) * 9999);
  const id = baseId(r.id);
  // the eaves' shadow on the street, then the roof
  g.fillStyle = 'rgba(10, 12, 18, 0.28)'; trace(g, pts.map((p) => ({ x: p.x + 8, y: p.y + 12 }))); g.fill();
  g.save(); trace(g, pts); g.clip();
  if (id === 'church') {
    // the nave's long slate roof, ridge east-west, and the apse's half cone fanning out from the ridge's end
    const ridge = (b.y0 + b.y1) / 2, ax = b.x1 - 300;
    const left = b.x0 > 3000 ? b.x0 + 300 : b.x0, right = b.x0 > 3000 ? b.x1 : ax;
    slope(g, left, b.y0, right - left, ridge - b.y0, true, true, rf, seed);
    slope(g, left, ridge, right - left, b.y1 - ridge, true, false, rf, seed + 1);
    const cx = b.x0 > 3000 ? b.x0 + 300 : ax;
    for (let i = 0; i < 12; i++) {
      const dir = b.x0 > 3000 ? Math.PI : 0;
      const a0 = dir - Math.PI / 2 + (i / 12) * Math.PI, a1 = dir - Math.PI / 2 + ((i + 1) / 12) * Math.PI;
      g.fillStyle = mix(rf.base, Math.cos((a0 + a1) / 2 + 2.2) > 0 ? 255 : 0, 0.12);
      g.beginPath(); g.moveTo(cx, ridge); g.lineTo(cx + Math.cos(a0) * 320, ridge + Math.sin(a0) * 320); g.lineTo(cx + Math.cos(a1) * 320, ridge + Math.sin(a1) * 320); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(20, 24, 30, 0.4)'; g.lineWidth = 2; g.stroke();
    }
    g.fillStyle = '#3a3634'; g.fillRect(left, ridge - 6, right - left, 12);
    g.strokeStyle = C.ink; g.lineWidth = 1.6; g.strokeRect(left, ridge - 6, right - left, 12);
  } else {
    const horiz = w >= h;
    if (horiz) {
      const ridge = b.y0 + h / 2;
      slope(g, b.x0, b.y0, w, h / 2, true, true, rf, seed);
      slope(g, b.x0, ridge, w, h / 2, true, false, rf, seed + 1);
      g.fillStyle = rf.lo; g.fillRect(b.x0, ridge - 5, w, 10);
      g.strokeStyle = C.ink; g.lineWidth = 1.6; g.beginPath(); g.moveTo(b.x0, ridge - 5); g.lineTo(b.x1, ridge - 5); g.moveTo(b.x0, ridge + 5); g.lineTo(b.x1, ridge + 5); g.stroke();
      // ridge tiles
      g.fillStyle = 'rgba(255, 240, 220, 0.18)'; for (let x = b.x0 + 4; x < b.x1; x += 20) g.fillRect(x, ridge - 4, 10, 3);
    } else {
      const ridge = b.x0 + w / 2;
      slope(g, b.x0, b.y0, w / 2, h, false, true, rf, seed);
      slope(g, ridge, b.y0, w / 2, h, false, false, rf, seed + 1);
      g.fillStyle = rf.lo; g.fillRect(ridge - 5, b.y0, 10, h);
      g.strokeStyle = C.ink; g.lineWidth = 1.6; g.beginPath(); g.moveTo(ridge - 5, b.y0); g.lineTo(ridge - 5, b.y1); g.moveTo(ridge + 5, b.y0); g.lineTo(ridge + 5, b.y1); g.stroke();
      g.fillStyle = 'rgba(255, 240, 220, 0.18)'; for (let y = b.y0 + 4; y < b.y1; y += 20) g.fillRect(ridge - 4, y, 3, 10);
    }
    if (id !== 'archway') {
      // dormers on the lit slope of the bigger houses, and a chimney or two on the ridge
      const n = Math.floor((horiz ? w : h) / 220);
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        if (horiz) dormer(g, b.x0 + w * t + (hash(seed, i) - 0.5) * 30, b.y0 + h * 0.25, true, rf);
        else dormer(g, b.x0 + w * 0.25, b.y0 + h * t, false, rf);
      }
      const chims = w * h > 200000 ? 2 : 1;
      for (let i = 0; i < chims; i++) {
        const t = chims === 1 ? 0.3 + hash(seed, 7) * 0.4 : i === 0 ? 0.2 : 0.8;
        const cx = horiz ? b.x0 + w * t : b.x0 + w / 2 + 16, cy = horiz ? b.y0 + h / 2 + 16 : b.y0 + h * t;
        chimney(g, cx, cy);
      }
    }
  }
  g.restore();
  trace(g, pts); g.strokeStyle = C.ink; g.lineWidth = 2.6; g.lineJoin = 'round'; g.stroke();
  // the eaves' front face, a dark band under the south edge
  g.fillStyle = mix(rf.lo, 0, 0.35); g.fillRect(b.x0, b.y1, w, 8); g.strokeStyle = C.ink; g.lineWidth = 2; g.strokeRect(b.x0, b.y1, w, 8);
}

const roofSprites = new Map<string, Sprite>();
export function drawOldtownRoof(g: G, r: MapRoof, _alpha: number, _info: GeoInfo): boolean {
  void _alpha; void _info;
  let s = roofSprites.get(r.id);
  if (!s) {
    const pts = wound(r.points), b = boundsOf(pts);
    s = bake(b.x0 - 24, b.y0 - 40, b.x1 + 24, b.y1 + 40, (c) => roofPaint(c, r, pts));
    roofSprites.set(r.id, s);
  }
  blit(g, s);
  return true;
}

/** Where each roof's chimneys stand (for the smoke), in world coordinates; computed the way roofPaint places them. */
export function chimneysOf(roofs: readonly MapRoof[]): { x: number; y: number; x0: number; y0: number; x1: number; y1: number }[] {
  const out: { x: number; y: number; x0: number; y0: number; x1: number; y1: number }[] = [];
  for (const r of roofs) {
    const id = baseId(r.id);
    if (id === 'church' || id === 'archway') continue;
    const b = boundsOf(r.points), w = b.x1 - b.x0, h = b.y1 - b.y0, horiz = w >= h, seed = Math.round(hashStr(r.id) * 9999);
    const chims = w * h > 200000 ? 2 : 1;
    for (let i = 0; i < chims; i++) {
      const t = chims === 1 ? 0.3 + hash(seed, 7) * 0.4 : i === 0 ? 0.2 : 0.8;
      out.push({ x: horiz ? b.x0 + w * t : b.x0 + w / 2 + 16, y: horiz ? b.y0 + h / 2 + 16 : b.y0 + h * t, x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 });
    }
  }
  return out;
}

/* ---------------------------------------------------------------- doors */

const LEAF: PolyLook = { top: '#7a4a2a', front: '#3f2614', lit: '#9a6a40', shade: '#5a3820' };
const FRAME: PolyLook = { top: C.stone, front: C.stoneFront, lit: C.stoneHi, shade: C.stoneLo };
/** Planked oak with two iron strap hinges and a ring pull; the church's are studded. */
const DOOR: DoorStyle = {
  leaf: LEAF, frame: FRAME, over: hingePins(C.iron),
  deco: (g, len, t, _f, i, n) => {
    g.strokeStyle = 'rgba(20, 10, 4, 0.5)'; g.lineWidth = 1.4; g.beginPath();
    for (let x = -len / 2 + 9; x < len / 2; x += 9) { g.moveTo(x, -t / 2 + 1); g.lineTo(x, t / 2 - 1); }
    g.stroke();
    g.fillStyle = C.iron; g.fillRect(-len / 2 + 4, -t / 2, 3, t); g.fillRect(len / 2 - 7, -t / 2, 3, t);
    const edge = n > 1 ? (i === 0 ? 1 : -1) : 1;
    g.strokeStyle = C.brass; g.lineWidth = 1.6; g.beginPath(); g.arc(edge * (len / 2 - 12), 0, 3, 0, TAU); g.stroke();
  },
};
export function drawOldtownDoor(g: G, d: MapDoor, leaves: readonly DoorLeaf[], open: number, info: GeoInfo): boolean {
  return paintDoor(g, d, leaves, open, info, DOOR);
}
