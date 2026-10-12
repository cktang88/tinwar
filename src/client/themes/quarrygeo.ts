import type { MapPoly, MapRoof, Pt } from '../../shared/geom.ts';
import { BELTS, DIGGERS, HEAPS, PIT, TRUCKS } from '../../shared/maps/quarrygeo.ts';
import type { GeoInfo } from '../geoart.ts';
import { onMapChange } from '../mapscope.ts';
import { drawVehicle } from '../vehicleart.ts';
import { C, TAU, bake, baseId, boundsOf, hash, hashStr, hazard, isTwin, southEdges, text, trace, turn, wound, type Sprite } from './quarrykit.ts';

/**
 * Quarry polygon art: every poly and roof is baked once into a sprite (the engine calls these hooks every frame); the haul truck
 * and the excavator come from the vehicle kit. The pit's ledges are blasted bench faces: banded limestone with a drill line along
 * the crest and scree at the toe. The east twin of each roof is the other building of its pair (the workshop's twin is the stores,
 * the explosives magazine's the detonator store), so each half has its own names.
 */
type G = CanvasRenderingContext2D;

let sprites = new WeakMap<MapPoly, Sprite>();
const roofSprites = new Map<string, Sprite>();
onMapChange(() => { sprites = new WeakMap(); roofSprites.clear(); });

/** Front faces under every south edge, filled with `fill` and inked. */
function fronts(g: G, pts: readonly Pt[], h: number, fill: string, paint?: (q: Pt[]) => void) {
  if (h <= 0) return;
  for (const [a, b] of southEdges(pts)) {
    const q = [a, b, { x: b.x, y: b.y + h }, { x: a.x, y: a.y + h }];
    trace(g, q); g.fillStyle = fill; g.fill();
    if (paint) { g.save(); trace(g, q); g.clip(); paint(q); g.restore(); }
    trace(g, q); g.strokeStyle = C.ink; g.lineWidth = 1.8; g.lineJoin = 'round'; g.stroke();
  }
}
const clipped = (g: G, pts: readonly Pt[], paint: () => void) => { g.save(); trace(g, pts); g.clip(); paint(); g.restore(); };

/* ---------------------------------------------------------------- ledges */

/** A bench face: banded limestone, a drill line along the crest (outer edge), boulders and scree along the toe (inner edge). */
function ledge(g: G, p: MapPoly, pts: Pt[]) {
  const seed = Math.floor(hashStr(baseId(p.id ?? '')) * 1e6) + (isTwin(p.id) ? 77 : 0);
  const o = p.part === 'floor' ? PIT.floor : PIT.mid;
  const h = p.height ?? 22;
  fronts(g, pts, h, C.rockLo, (q) => {
    const b = boundsOf(q);
    g.strokeStyle = 'rgba(30, 26, 20, 0.5)'; g.lineWidth = 1.6;
    for (let x = b.x0 + 4; x < b.x1; x += 9 + hash(seed, x) * 10) { g.beginPath(); g.moveTo(x, b.y0 - 4); g.lineTo(x + (hash(seed, x, 1) - 0.5) * 6, b.y1 + 4); g.stroke(); }
    g.fillStyle = 'rgba(210, 200, 176, 0.16)'; g.fillRect(b.x0, b.y0 + h * 0.35, b.x1 - b.x0, 3);
  });
  trace(g, pts); g.fillStyle = C.rock; g.fill();
  clipped(g, pts, () => {
    // strata as ovals parallel to the bench
    for (let k = 4; k < 55; k += 6 + hash(seed, k) * 5) {
      g.strokeStyle = hash(seed, k, 1) < 0.5 ? 'rgba(70, 64, 52, 0.3)' : 'rgba(200, 192, 170, 0.22)'; g.lineWidth = 2 + hash(seed, k, 2) * 2;
      g.beginPath(); g.ellipse(PIT.x, PIT.y, o.rx - k, o.ry - k, 0, 0, TAU); g.stroke();
    }
    // the crest: a pale lip with the next blast's drill holes along it
    g.strokeStyle = C.rockHi; g.lineWidth = 8; g.beginPath(); g.ellipse(PIT.x, PIT.y, o.rx - 3, o.ry - 3, 0, 0, TAU); g.stroke();
    const b = boundsOf(pts);
    for (let a = 0; a < TAU; a += 0.035) {
      const x = PIT.x + (o.rx - 14) * Math.cos(a), y = PIT.y + (o.ry - 14) * Math.sin(a);
      if (x < b.x0 || x > b.x1 || y < b.y0 || y > b.y1) continue;
      g.fillStyle = 'rgba(40, 36, 30, 0.7)'; g.beginPath(); g.arc(x, y, 2.4, 0, TAU); g.fill();
    }
    // boulders along the toe
    for (let i = 0; i < 60; i++) {
      const a = hash(seed, i, 3) * TAU, r = 7 + hash(seed, i, 4) * 9, k = 30 + hash(seed, i, 5) * 20;
      const x = PIT.x + (o.rx - k) * Math.cos(a), y = PIT.y + (o.ry - k) * Math.sin(a);
      if (x < b.x0 - 20 || x > b.x1 + 20 || y < b.y0 - 20 || y > b.y1 + 20) continue;
      g.fillStyle = hash(seed, i, 6) < 0.5 ? C.rockHi : C.rockLo;
      g.beginPath(); g.moveTo(x - r, y); g.lineTo(x - r * 0.3, y - r * 0.8); g.lineTo(x + r, y - r * 0.2); g.lineTo(x + r * 0.6, y + r * 0.7); g.lineTo(x - r * 0.5, y + r * 0.6); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(28, 31, 38, 0.7)'; g.lineWidth = 1.3; g.stroke();
    }
    // a red-and-white survey pole stuck in the rock now and then
    for (let i = 0; i < 3; i++) {
      const a = hash(seed, i, 9) * TAU, x = PIT.x + (o.rx - 26) * Math.cos(a), y = PIT.y + (o.ry - 26) * Math.sin(a);
      if (x < b.x0 || x > b.x1 || y < b.y0 || y > b.y1) continue;
      g.fillStyle = C.red; g.beginPath(); g.arc(x, y, 5, 0, TAU); g.fill(); g.fillStyle = C.bone; g.beginPath(); g.arc(x, y, 2.4, 0, TAU); g.fill();
    }
  });
  trace(g, pts); g.strokeStyle = C.ink; g.lineWidth = 2.2; g.lineJoin = 'round'; g.stroke();
}

/* ---------------------------------------------------------------- stockpiles, belts, water, tank, crane */

function heap(g: G, p: MapPoly) {
  const hp = HEAPS.find((h) => h.id === baseId(p.id ?? ''));
  if (!hp) return false;
  const c = isTwin(p.id) ? turn(hp) : hp, seed = Math.floor(hashStr(p.id ?? '') * 1e6);
  const fine = hp.grade === 'DUST';
  // a wobbly outline (stone never piles round), spill rolled out past the toe, the cone lit from the north-west
  const edge = (k: number) => { g.beginPath(); for (let i = 0; i < 40; i++) { const a = (i / 40) * TAU, q = hp.r * k * (0.95 + 0.06 * Math.sin(a * 5 + seed) + 0.03 * Math.cos(a * 9 + seed * 2)); g.lineTo(c.x + Math.cos(a) * q, c.y + Math.sin(a) * q); } g.closePath(); };
  for (let i = 0; i < 70; i++) {
    const a = hash(seed, i, 20) * TAU, d = hp.r * (0.98 + hash(seed, i, 21) * 0.3), r = fine ? 1.5 : 2 + hash(seed, i, 22) * 3.5;
    g.fillStyle = hash(seed, i, 23) < 0.5 ? C.gravelHi : C.gravelLo; g.beginPath(); g.arc(c.x + Math.cos(a) * d, c.y + Math.sin(a) * d, r, 0, TAU); g.fill();
  }
  g.fillStyle = 'rgba(16, 18, 24, 0.25)'; edge(1.04); g.fill();
  const grad = g.createRadialGradient(c.x - hp.r * 0.25, c.y - hp.r * 0.3, 2, c.x, c.y, hp.r * 1.05);
  grad.addColorStop(0, fine ? '#e2dac6' : '#cfcabd'); grad.addColorStop(0.5, fine ? '#bdb5a0' : C.gravel); grad.addColorStop(1, fine ? '#857e6c' : '#5e5a52');
  edge(1); g.fillStyle = grad; g.fill();
  g.save(); edge(1); g.clip();
  for (let i = 0; i < hp.r * (fine ? 4 : 9); i++) {
    const a = hash(seed, i, 1) * TAU, d = Math.sqrt(hash(seed, i, 2)) * hp.r, sz = fine ? 1.4 : 2 + hash(seed, i, 3) * 3.2;
    const lit = Math.cos(a + 2.3) * (d / hp.r);
    g.fillStyle = lit > 0.2 ? 'rgba(240, 236, 226, 0.45)' : lit < -0.2 ? 'rgba(30, 28, 24, 0.4)' : (hash(seed, i, 4) < 0.5 ? 'rgba(60, 56, 50, 0.3)' : 'rgba(230, 226, 214, 0.3)');
    g.beginPath(); g.arc(c.x + Math.cos(a) * d, c.y + Math.sin(a) * d, sz, 0, TAU); g.fill();
  }
  // slump runs down from the peak, light on the north-west flanks and dark on the south-east
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * TAU + hash(seed, k) * 0.25, lit = Math.cos(a + 2.3);
    g.strokeStyle = lit > 0 ? 'rgba(250, 246, 236, 0.14)' : 'rgba(30, 28, 24, 0.18)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(c.x + Math.cos(a) * 10, c.y + Math.sin(a) * 10); g.quadraticCurveTo(c.x + Math.cos(a + 0.12) * hp.r * 0.5, c.y + Math.sin(a + 0.12) * hp.r * 0.5, c.x + Math.cos(a) * hp.r, c.y + Math.sin(a) * hp.r); g.stroke();
  }
  // a loader's bucket bite out of the toe, and the rain dark on the windward side
  const bite = hash(seed, 9) * TAU;
  g.fillStyle = 'rgba(30, 28, 24, 0.3)'; g.beginPath(); g.ellipse(c.x + Math.cos(bite) * hp.r, c.y + Math.sin(bite) * hp.r, hp.r * 0.34, hp.r * 0.22, bite, 0, TAU); g.fill();
  g.fillStyle = 'rgba(40, 60, 80, 0.12)'; g.beginPath(); g.arc(c.x + hp.r * 0.45, c.y + hp.r * 0.35, hp.r * 0.75, 0, TAU); g.fill();
  disc(g, c.x - 4, c.y - 4, fine ? 5 : 7, fine ? '#ece6d4' : '#d6d1c4', 0);
  g.restore();
  edge(1); g.strokeStyle = C.ink; g.lineWidth = 2.2; g.stroke();
  // the grade board on its stake
  const sx = c.x - hp.r * 0.7, sy = c.y + hp.r * 0.75;
  g.fillStyle = 'rgba(16, 18, 24, 0.3)'; g.fillRect(sx - 20, sy - 6, 46, 22);
  g.fillStyle = C.bone; g.fillRect(sx - 23, sy - 10, 46, 22); g.strokeStyle = C.ink; g.lineWidth = 1.6; g.strokeRect(sx - 23, sy - 10, 46, 22);
  text(g, hp.grade, sx, sy + 1, 15, C.ink, 0, 1);
  return true;
}

function belt(g: G, p: MapPoly, pts: Pt[]) {
  const bl = BELTS.find((b) => b.id === baseId(p.id ?? ''));
  if (!bl) return false;
  const tw = isTwin(p.id), a0 = tw ? turn({ x: bl.x0, y: bl.y0 }) : { x: bl.x0, y: bl.y0 }, a1 = tw ? turn({ x: bl.x1, y: bl.y1 }) : { x: bl.x1, y: bl.y1 };
  const ang = Math.atan2(a1.y - a0.y, a1.x - a0.x), len = Math.hypot(a1.x - a0.x, a1.y - a0.y), seed = Math.floor(hashStr(p.id ?? '') * 1e6);
  g.save(); g.translate(a0.x, a0.y); g.rotate(ang);
  // A-frame legs below, then the truss: two rails, rollers, the rubber belt carrying stone
  for (let t = 40; t < len - 20; t += 120) { g.fillStyle = C.steelDark; g.fillRect(t - 5, -28, 10, 56); g.strokeStyle = C.ink; g.lineWidth = 1.4; g.strokeRect(t - 5, -28, 10, 56); }
  g.fillStyle = C.steelLo; g.fillRect(0, -22, len, 44);
  g.fillStyle = C.rubber; g.fillRect(0, -15, len, 30);
  g.fillStyle = 'rgba(120, 124, 130, 0.5)'; for (let t = 6; t < len; t += 18) g.fillRect(t, -15, 2, 30);
  for (let i = 0; i < len / 9; i++) { const t = hash(seed, i, 1) * len, v = (hash(seed, i, 2) - 0.5) * 18, r = 2 + hash(seed, i, 3) * 3; g.fillStyle = hash(seed, i, 4) < 0.5 ? C.gravelHi : C.gravel; g.beginPath(); g.arc(t, v, r, 0, TAU); g.fill(); }
  g.fillStyle = C.hivis; g.fillRect(0, -22, len, 5); g.fillRect(0, 17, len, 5);
  g.strokeStyle = C.ink; g.lineWidth = 2; g.strokeRect(0, -22, len, 44);
  // head drum at the discharge end, a pull-wire emergency stop along one side
  g.fillStyle = C.steel; g.fillRect(len - 14, -24, 14, 48); g.strokeRect(len - 14, -24, 14, 48);
  g.strokeStyle = C.red; g.lineWidth = 1.4; g.setLineDash([10, 6]); g.beginPath(); g.moveTo(4, 20); g.lineTo(len - 16, 20); g.stroke(); g.setLineDash([]);
  g.restore();
  void pts;
  return true;
}

function pond(g: G, pts: Pt[]) {
  const b = boundsOf(pts), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  // the muddy bank, then the water
  g.save(); g.translate(0, 0);
  trace(g, pts); g.strokeStyle = C.mud; g.lineWidth = 22; g.lineJoin = 'round'; g.stroke();
  trace(g, pts); g.strokeStyle = 'rgba(120, 104, 80, 0.6)'; g.lineWidth = 10; g.stroke();
  const grad = g.createRadialGradient(cx, cy, 10, cx, cy, Math.max(b.x1 - b.x0, b.y1 - b.y0) / 2);
  grad.addColorStop(0, C.waterLo); grad.addColorStop(0.7, C.water); grad.addColorStop(1, '#5a7a74');
  trace(g, pts); g.fillStyle = grad; g.fill();
  clipped(g, pts, () => {
    // milky silt plume where the pump returns the wash water, and wind ripples
    g.fillStyle = 'rgba(200, 196, 180, 0.18)'; g.beginPath(); g.ellipse(b.x1 - 90, cy - 20, 120, 60, -0.3, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(200, 225, 235, 0.22)'; g.lineWidth = 2; g.lineCap = 'round';
    for (let i = 0; i < 26; i++) { const x = b.x0 + hash(i, 1) * (b.x1 - b.x0), y = b.y0 + hash(i, 2) * (b.y1 - b.y0), w = 14 + hash(i, 3) * 24; g.beginPath(); g.moveTo(x - w, y); g.quadraticCurveTo(x, y - 5, x + w, y); g.stroke(); }
  });
  trace(g, pts); g.strokeStyle = C.ink; g.lineWidth = 2; g.stroke();
  // reeds on the bank, the pump pontoon on its float with a hose snaking ashore, a lifebuoy on its post
  for (let i = 0; i < 40; i++) {
    const q = pts[Math.floor(hash(i, 7) * pts.length)]!, dx = (hash(i, 8) - 0.5) * 30, dy = (hash(i, 9) - 0.5) * 20;
    g.strokeStyle = hash(i, 10) < 0.5 ? C.grass : C.grassHi; g.lineWidth = 2.4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(q.x + dx, q.y + dy + 6); g.lineTo(q.x + dx + (hash(i, 11) - 0.5) * 6, q.y + dy - 9); g.stroke();
  }
  const px = cx + 60, py = cy - 30;
  g.strokeStyle = C.rubber; g.lineWidth = 6; g.beginPath(); g.moveTo(px, py); g.bezierCurveTo(px + 120, py - 40, b.x1 - 40, b.y0 + 20, b.x1 + 30, b.y0 - 10); g.stroke();
  g.fillStyle = 'rgba(16, 18, 24, 0.3)'; g.fillRect(px - 26, py - 16, 56, 38);
  g.fillStyle = C.orange; g.fillRect(px - 30, py - 20, 56, 36); g.strokeStyle = C.ink; g.lineWidth = 1.8; g.strokeRect(px - 30, py - 20, 56, 36);
  g.fillStyle = C.steel; g.fillRect(px - 16, py - 10, 28, 16); g.strokeRect(px - 16, py - 10, 28, 16);
  g.restore();
}

function tank(g: G, p: MapPoly, pts: Pt[]) {
  const b = boundsOf(pts), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, r = (b.x1 - b.x0) / 2, h = p.height ?? 40;
  // the cylinder's side, then the lid with its weld rings, ladder and fill point
  g.fillStyle = '#3f5a4a'; g.beginPath(); g.moveTo(cx - r, cy); g.lineTo(cx - r, cy + h); g.ellipse(cx, cy + h, r, r, 0, Math.PI, 0, true); g.lineTo(cx + r, cy); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255, 255, 255, 0.12)'; g.fillRect(cx - r * 0.7, cy + 4, 8, h + r * 0.5);
  g.strokeStyle = C.ink; g.lineWidth = 2; g.stroke();
  disc(g, cx, cy, r, '#557a62', 2.4);
  for (const k of [0.8, 0.5]) { g.strokeStyle = 'rgba(20, 30, 24, 0.35)'; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, r * k, 0, TAU); g.stroke(); }
  g.fillStyle = 'rgba(255, 255, 255, 0.18)'; g.beginPath(); g.arc(cx - r * 0.3, cy - r * 0.3, r * 0.45, Math.PI, Math.PI * 1.5); g.lineTo(cx, cy); g.fill();
  disc(g, cx + r * 0.3, cy - r * 0.2, 9, C.steel, 1.6);
  text(g, isTwin(p.id) ? 'WATER' : 'DIESEL', cx, cy + 6, 26, C.bone);
  g.strokeStyle = C.steelHi; g.lineWidth = 3; g.beginPath(); g.moveTo(cx - 8, cy + r - 2); g.lineTo(cx - 8, cy + r + h); g.moveTo(cx + 8, cy + r - 2); g.lineTo(cx + 8, cy + r + h); g.stroke();
  for (let y = cy + r + 4; y < cy + r + h; y += 7) { g.beginPath(); g.moveTo(cx - 8, y); g.lineTo(cx + 8, y); g.stroke(); }
}
const disc = (g: G, x: number, y: number, r: number, fill: string, lw: number) => { g.fillStyle = fill; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); if (lw) { g.strokeStyle = C.ink; g.lineWidth = lw; g.stroke(); } };

function craneBase(g: G, pts: Pt[]) {
  const b = boundsOf(pts), w = b.x1 - b.x0;
  fronts(g, pts, 16, C.concreteLo);
  trace(g, pts); g.fillStyle = C.concrete; g.fill();
  hazard(g, b.x0, b.y0, w, 8, 8); hazard(g, b.x0, b.y1 - 8, w, 8, 8);
  // the mast's lattice section standing on its bolts
  const m = 30, mx = b.x0 + w / 2, my = b.y0 + w / 2;
  g.fillStyle = C.hivisLo; g.fillRect(mx - m, my - m, m * 2, m * 2);
  g.strokeStyle = C.hivis; g.lineWidth = 4; g.strokeRect(mx - m, my - m, m * 2, m * 2);
  g.beginPath(); g.moveTo(mx - m, my - m); g.lineTo(mx + m, my + m); g.moveTo(mx + m, my - m); g.lineTo(mx - m, my + m); g.stroke();
  g.strokeStyle = C.ink; g.lineWidth = 1.6; g.strokeRect(mx - m, my - m, m * 2, m * 2);
  for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) disc(g, mx + dx * (m + 12), my + dy * (m + 12), 4, C.steelDark, 1.2);
  trace(g, pts); g.strokeStyle = C.ink; g.lineWidth = 2.2; g.stroke();
}

/* ---------------------------------------------------------------- vehicles */

function vehicle(g: G, p: MapPoly, info: GeoInfo): boolean {
  const id = baseId(p.id ?? ''), tw = isTwin(p.id);
  const spec = p.material === 'qtruck' ? TRUCKS.find((t) => t.id === id) : DIGGERS.find((d) => d.id === id);
  if (!spec) return false;
  const pos = tw ? turn(spec) : spec;
  return drawVehicle(g, p.material === 'qtruck' ? 'dumpTruck' : 'excavator', { x: pos.x, y: pos.y, rot: spec.rot + (tw ? Math.PI : 0), livery: tw ? 'orange' : 'yellow', t: info.now, polys: [p] });
}

/** While a vehicle's sprite bakes, its footprint wears a plain yellow body. */
function vehicleStandIn(g: G, p: MapPoly, pts: Pt[]) {
  fronts(g, pts, 16, C.hivisLo);
  trace(g, pts); g.fillStyle = C.hivis; g.fill(); g.strokeStyle = C.ink; g.lineWidth = 2; g.stroke();
  void p;
}

/* ---------------------------------------------------------------- dispatch */

function paintPoly(g: G, p: MapPoly, pts: Pt[]) {
  switch (p.material) {
    case 'qrock': return ledge(g, p, pts);
    case 'qgravel': return void heap(g, p);
    case 'qbelt': return void belt(g, p, pts);
    case 'qwater': return pond(g, pts);
    case 'qtank': return tank(g, p, pts);
    case 'qcrane': return craneBase(g, pts);
    default: return vehicleStandIn(g, p, pts);
  }
}

export function drawQuarryPoly(g: G, p: MapPoly, info: GeoInfo): boolean {
  if ((p.material === 'qtruck' || p.material === 'qdigger') && vehicle(g, p, info)) return true;
  let s = sprites.get(p);
  if (!s) {
    const pts = wound(p.points), b = boundsOf(pts), pad = 60;
    s = bake(b.x0 - pad, b.y0 - pad, b.x1 + pad, b.y1 + (p.height ?? 14) + pad, (c) => paintPoly(c, p, pts));
    sprites.set(p, s);
  }
  g.drawImage(s.canvas, s.x, s.y);
  return true;
}

/* ---------------------------------------------------------------- roofs */

const ROOF_NAMES: Record<string, readonly [string, string]> = {
  shop: ['WORKSHOP', 'STORES'], control: ['CONTROL', 'PUMP HOUSE'], lab: ['SAMPLE LAB', 'FIRST AID'], office: ['SITE OFFICE', 'ENGINEERS'],
  canteen: ['CANTEEN', 'DRYING ROOM'], weigh: ['WEIGHBRIDGE', 'GATEHOUSE'], magazine: ['EXPLOSIVES', 'DETONATORS'],
};

function roofPaint(g: G, r: MapRoof, pts: Pt[]) {
  const b = boundsOf(pts), w = b.x1 - b.x0, h = b.y1 - b.y0, seed = Math.floor(hashStr(r.id) * 1e6);
  const tw = isTwin(r.id), names = ROOF_NAMES[baseId(r.id)] ?? ['', ''], name = names[tw ? 1 : 0];
  const horiz = w >= h;
  if (r.material === 'cabin') {
    // portacabin roof: white ribbed steel with a gutter lip, a vent and an air-con box; the hire firm's number stencilled on
    g.fillStyle = C.cabinLo; g.fillRect(b.x0, b.y1, w, 10);
    g.fillStyle = '#c4c0b2'; g.fillRect(b.x0, b.y0, w, h);
    g.fillStyle = 'rgba(60, 64, 70, 0.14)';
    if (horiz) for (let x = b.x0 + 6; x < b.x1; x += 12) g.fillRect(x, b.y0, 4, h); else for (let y = b.y0 + 6; y < b.y1; y += 12) g.fillRect(b.x0, y, w, 4);
    g.fillStyle = C.cabinBlue; if (horiz) g.fillRect(b.x0, b.y0, w, 8); else g.fillRect(b.x0, b.y0, 8, h);
    const ax = horiz ? b.x1 - 70 : b.x0 + w / 2 - 22, ay = horiz ? b.y0 + 20 : b.y1 - 70;
    g.fillStyle = 'rgba(16, 18, 24, 0.3)'; g.fillRect(ax + 4, ay + 5, 44, 40);
    g.fillStyle = C.steelHi; g.fillRect(ax, ay, 44, 40); g.strokeStyle = C.ink; g.lineWidth = 1.6; g.strokeRect(ax, ay, 44, 40);
    g.strokeStyle = C.steelLo; g.beginPath(); g.arc(ax + 22, ay + 20, 13, 0, TAU); g.stroke();
    if (hash(seed, 2) < 0.6) { g.fillStyle = 'rgba(70, 90, 50, 0.35)'; g.beginPath(); g.ellipse(b.x0 + w * 0.3, b.y0 + h * 0.6, 26, 14, 0.3, 0, TAU); g.fill(); }
  } else if (r.material === 'bunker') {
    // the magazine: a poured slab roof, lightning rod, a red flag on its mast at each corner
    g.fillStyle = C.concreteLo; g.fillRect(b.x0, b.y1, w, 12);
    g.fillStyle = C.concrete; g.fillRect(b.x0, b.y0, w, h);
    g.strokeStyle = 'rgba(40, 38, 34, 0.3)'; g.lineWidth = 1.5; for (let x = b.x0 + 50; x < b.x1; x += 50) { g.beginPath(); g.moveTo(x, b.y0); g.lineTo(x, b.y1); g.stroke(); }
    hazard(g, b.x0, b.y0, w, 12, 10, C.red, C.bone);
    disc(g, b.x0 + w / 2, b.y0 + h * 0.62, 6, C.steelHi, 1.4);
  } else {
    // the workshop: green corrugated sheet in long runs, translucent roof lights, a vent stack
    g.fillStyle = C.shedLo; g.fillRect(b.x0, b.y1, w, 12);
    g.fillStyle = C.shed; g.fillRect(b.x0, b.y0, w, h);
    g.fillStyle = 'rgba(10, 14, 12, 0.2)'; for (let y = b.y0 + 4; y < b.y1; y += 10) g.fillRect(b.x0, y, w, 4);
    g.fillStyle = 'rgba(230, 240, 230, 0.12)'; for (let y = b.y0 + 8; y < b.y1; y += 10) g.fillRect(b.x0, y, w, 1.6);
    g.fillStyle = 'rgba(220, 230, 200, 0.5)'; for (let x = b.x0 + 80; x < b.x1 - 60; x += 160) g.fillRect(x, b.y0 + 30, 50, h - 60);
    g.strokeStyle = C.shedHi; g.lineWidth = 6; g.beginPath(); g.moveTo(b.x0, b.y0 + h / 2); g.lineTo(b.x1, b.y0 + h / 2); g.stroke();
    disc(g, b.x0 + 60, b.y0 + 50, 14, C.steel, 1.8); disc(g, b.x0 + 60, b.y0 + 50, 6, C.steelDark, 1.2);
  }
  // the name, big, stencilled on the roof
  if (name) {
    const px = Math.min(44, (horiz ? w : h) / (name.length * 0.55));
    text(g, name, b.x0 + w / 2 + 2, b.y0 + h / 2 + 3, px, 'rgba(16, 18, 24, 0.2)', horiz ? 0 : -Math.PI / 2, 3);
    text(g, name, b.x0 + w / 2, b.y0 + h / 2, px, r.material === 'cabin' ? 'rgba(40, 70, 110, 0.85)' : C.bone, horiz ? 0 : -Math.PI / 2, 3);
  }
  g.strokeStyle = C.ink; g.lineWidth = 2.2; g.strokeRect(b.x0, b.y0, w, h);
}

export function drawQuarryRoof(g: G, r: MapRoof, _alpha: number, info: GeoInfo): boolean {
  let s = roofSprites.get(r.id);
  if (!s) {
    const pts = wound(r.points), b = boundsOf(pts);
    s = bake(b.x0 - 8, b.y0 - 8, b.x1 + 8, b.y1 + 20, (c) => roofPaint(c, r, pts));
    roofSprites.set(r.id, s);
  }
  g.drawImage(s.canvas, s.x, s.y);
  // the storm's gloom falls on the roofs too, as on every other roof (roofart.ts)
  if (info.dark > 0) { const b = boundsOf(r.points); g.fillStyle = `rgba(20, 28, 60, ${0.5 * info.dark})`; g.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0 + 10); }
  return true;
}

