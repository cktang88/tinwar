import type { FloorPlan } from '../floor.ts';
import { BREACHES, C, GATES, GATE_NAMES, MID, OUT_DIRS, PLACE, SIZE, TAU, TOWERS, hash, hazard, hexA, rr, seeded, shade, text } from './outpostkit.ts';
import { WIRE } from '../../shared/maps/outpost.ts';

/**
 * The Outpost's ground, baked once. Outside the wire: desert dust and scrub, roads in to each gate with their tyre ruts, mortar
 * craters, trampled concertina, blood trails and drag marks where the horde came in and what it took. Inside: packed gravel
 * round the base's places (each with its own ground: the helipad's pad, the motor pool's oil-stained bays, the fuel point's
 * spill berm, mess tables, stretchers by the med tent), the parade ground's concrete with the TOC's sandbag ring painted round
 * the core, and the stencilled names a soldier would paint. The lettering, the stories and the paint all keep off the lanes.
 */
type G = CanvasRenderingContext2D;
type R = () => number;

const IN0 = WIRE.in, IN1 = SIZE - WIRE.in, OUT0 = WIRE.out, OUT1 = SIZE - WIRE.out;
/** The parade ground the squad builds on. */
const YARD = { x0: 1000, y0: 1000, x1: 2000, y1: 2000 } as const;

function grit(g: G, rand: R, x0: number, y0: number, w: number, h: number, n: number, dark: string, light: string) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = rand() < 0.6 ? dark : light;
    const s = 1 + rand() * 2;
    g.fillRect(x0 + rand() * w, y0 + rand() * h, s, s);
  }
}
function blot(g: G, x: number, y: number, r: number, fill: string, rand: R, squash = 0.7) {
  g.fillStyle = fill; g.beginPath();
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU, q = r * (0.7 + rand() * 0.45); g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q * squash); }
  g.closePath(); g.fill();
}
/** A scrub bush: a few dark-green blobs with a lit side. */
function scrub(g: G, x: number, y: number, r: number, rand: R) {
  shade(g, x, y, r, r * 0.6, 0.2);
  for (let i = 0; i < 4; i++) {
    const a = rand() * TAU, d = rand() * r * 0.5;
    g.fillStyle = i < 2 ? C.scrub : C.scrubHi; g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, r * (0.45 + rand() * 0.3), 0, TAU); g.fill();
  }
  g.strokeStyle = 'rgba(20, 24, 12, 0.5)'; g.lineWidth = 1; g.beginPath(); g.arc(x, y, r * 0.9, 0, TAU); g.stroke();
}
/** A mortar crater: a scorched dish with a lit far lip and thrown dirt round it. */
function crater(g: G, x: number, y: number, r: number, rand: R) {
  for (let i = 0; i < 14; i++) { const a = rand() * TAU, d = r * (1 + rand() * 0.8); g.fillStyle = rand() < 0.5 ? C.dustLo : C.dustDeep; g.fillRect(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, 3, 3); }
  g.fillStyle = 'rgba(30, 24, 18, 0.55)'; g.beginPath(); g.ellipse(x, y, r, r * 0.82, 0, 0, TAU); g.fill();
  g.fillStyle = 'rgba(12, 10, 8, 0.45)'; g.beginPath(); g.ellipse(x + r * 0.08, y + r * 0.1, r * 0.6, r * 0.5, 0, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(200, 180, 140, 0.25)'; g.lineWidth = 2.5; g.beginPath(); g.ellipse(x, y, r, r * 0.82, 0, Math.PI * 0.95, Math.PI * 1.85); g.stroke();
}
/** Two pairs of ruts along a path, over a band of worn track. */
function track(g: G, pts: readonly { x: number; y: number }[], width: number) {
  const path = () => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); };
  g.lineCap = 'round'; g.lineJoin = 'round';
  path(); g.strokeStyle = hexA(C.road, 0.6); g.lineWidth = width; g.stroke();
  path(); g.strokeStyle = hexA(C.roadHi, 0.25); g.lineWidth = width * 0.6; g.stroke();
  for (const off of [-0.28, 0.28]) {
    g.beginPath();
    pts.forEach((p, i) => {
      const a = pts[Math.max(0, i - 1)]!, b = pts[Math.min(pts.length - 1, i + 1)]!, l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const x = p.x - ((b.y - a.y) / l) * width * off, y = p.y + ((b.x - a.x) / l) * width * off;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    });
    g.strokeStyle = 'rgba(30, 26, 20, 0.3)'; g.lineWidth = 12; g.stroke();
    g.strokeStyle = 'rgba(30, 26, 20, 0.3)'; g.lineWidth = 2.5; g.setLineDash([5, 7]); g.stroke(); g.setLineDash([]);
  }
}
/** A trail of blood drops and smears from `a` to `b`, thinning out: something was dragged, or crawled. */
function bloodTrail(g: G, a: { x: number; y: number }, b: { x: number; y: number }, rand: R, drag = false) {
  const n = Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 14);
  const nx = -(b.y - a.y), ny = b.x - a.x, l = Math.hypot(nx, ny) || 1;
  if (drag) {
    g.strokeStyle = 'rgba(40, 30, 22, 0.28)'; g.lineWidth = 16; g.lineCap = 'round';
    g.beginPath(); g.moveTo(a.x, a.y); g.quadraticCurveTo((a.x + b.x) / 2 + (nx / l) * 30, (a.y + b.y) / 2 + (ny / l) * 30, b.x, b.y); g.stroke();
  }
  for (let i = 0; i <= n; i++) {
    const t = i / n, wob = Math.sin(t * 9) * 10 + (drag ? Math.sin(t * Math.PI) * 30 : 0);
    const x = a.x + (b.x - a.x) * t + (nx / l) * wob, y = a.y + (b.y - a.y) * t + (ny / l) * wob;
    const fade = 0.75 - t * 0.45;
    g.fillStyle = `rgba(${drag ? 94 : 110}, 20, 18, ${fade})`;
    if (rand() < 0.4) { g.beginPath(); g.ellipse(x, y, 5 + rand() * 6, 2 + rand() * 3, Math.atan2(b.y - a.y, b.x - a.x), 0, TAU); g.fill(); }
    else { g.beginPath(); g.arc(x + (rand() - 0.5) * 8, y + (rand() - 0.5) * 8, 1.5 + rand() * 2.5, 0, TAU); g.fill(); }
  }
}
/** A pool of old blood, dark at its heart. */
function pool(g: G, x: number, y: number, r: number, rand: R) {
  blot(g, x, y, r, 'rgba(70, 14, 14, 0.6)', rand, 0.75);
  blot(g, x + 2, y + 1, r * 0.6, 'rgba(40, 8, 8, 0.55)', rand, 0.75);
  for (let i = 0; i < 6; i++) { const a = rand() * TAU, d = r * (1.1 + rand() * 0.6); g.fillStyle = 'rgba(90, 18, 16, 0.55)'; g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.75, 1.5 + rand() * 2, 0, TAU); g.fill(); }
}
/** Claw rakes in the dirt. */
function rakes(g: G, x: number, y: number, a: number, len: number) {
  g.save(); g.translate(x, y); g.rotate(a);
  for (let i = -1; i <= 1; i++) {
    g.strokeStyle = 'rgba(24, 18, 12, 0.5)'; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-len / 2, i * 7); g.quadraticCurveTo(0, i * 7 + 3, len / 2, i * 8); g.stroke();
    g.strokeStyle = 'rgba(200, 180, 140, 0.22)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(-len / 2 + 2, i * 7 - 2); g.quadraticCurveTo(0, i * 7 + 1, len / 2 - 2, i * 8 - 2); g.stroke();
  }
  g.restore();
}
/** A trampled coil of concertina wire: loops along a line, broken where it was pushed through. */
function concertina(g: G, x0: number, y0: number, x1: number, y1: number, rand: R) {
  const len = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / len, uy = (y1 - y0) / len;
  g.lineWidth = 1.2;
  for (let t = 0; t < len; t += 6) {
    if (Math.sin(t * 0.021 + x0) > 0.82) continue;
    const x = x0 + ux * t, y = y0 + uy * t;
    g.strokeStyle = rand() < 0.15 ? 'rgba(110, 30, 26, 0.6)' : 'rgba(176, 182, 186, 0.6)';
    g.beginPath(); g.ellipse(x, y, 8, 5.5, Math.atan2(uy, ux) + 0.6, 0, TAU); g.stroke();
  }
  g.fillStyle = 'rgba(60, 50, 40, 0.8)';
  for (let t = 0; t < len; t += 60) g.fillRect(x0 + ux * t - 2, y0 + uy * t - 2, 4, 4);
}
/** A helmet, dropped. */
function helmet(g: G, x: number, y: number) { shade(g, x, y, 8, 6, 0.3); g.fillStyle = C.oliveLo; g.beginPath(); g.ellipse(x, y, 8, 7, 0.3, 0, TAU); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 1.2; g.stroke(); g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.ellipse(x - 2, y - 2, 4, 3, 0.3, 0, TAU); g.fill(); }
/** A scatter of brass. */
function brass(g: G, x: number, y: number, r: number, n: number, rand: R) { for (let i = 0; i < n; i++) { const a = rand() * TAU, d = rand() * r; g.fillStyle = rand() < 0.5 ? '#c9a24a' : '#9c7a30'; g.save(); g.translate(x + Math.cos(a) * d, y + Math.sin(a) * d); g.rotate(rand() * 3); g.fillRect(-2.5, -1, 5, 2); g.restore(); } }
/** A floodlight pole's foot on the floor: a concrete block, the pole's shadow, its cable. */
function poleFoot(g: G, x: number, y: number) {
  shade(g, x, y, 10, 7, 0.35);
  g.fillStyle = C.slabLo; g.fillRect(x - 9, y - 9, 18, 18); g.strokeStyle = C.ink; g.lineWidth = 1.4; g.strokeRect(x - 9, y - 9, 18, 18);
  g.fillStyle = C.steelDark; g.beginPath(); g.arc(x, y, 4, 0, TAU); g.fill();
}
/** A stencilled place name with a dark under-stroke. */
function stencil(g: G, s: string, x: number, y: number, px: number, rot = 0, fill: string = C.paintDim) {
  text(g, s, x + 1.5, y + 1.5, px, 'rgba(20, 18, 14, 0.35)', rot, Math.round(px / 6));
  text(g, s, x, y, px, fill, rot, Math.round(px / 6));
}

/* ------------------------------------------------------------------ ground */

function ground(g: G, rand: R) {
  // dust everywhere, blotched light and dark
  g.fillStyle = C.dust; g.fillRect(0, 0, SIZE, SIZE);
  for (let i = 0; i < 260; i++) blot(g, rand() * SIZE, rand() * SIZE, 30 + rand() * 120, rand() < 0.5 ? hexA(C.dustHi, 0.2) : hexA(C.dustLo, 0.22), rand, 0.6 + rand() * 0.4);
  grit(g, rand, 0, 0, SIZE, SIZE, 26000, 'rgba(40, 34, 26, 0.35)', 'rgba(220, 200, 160, 0.2)');
  // inside the wire: packed gravel, a shade cooler
  g.fillStyle = C.gravel; g.fillRect(IN0, IN0, IN1 - IN0, IN1 - IN0);
  for (let i = 0; i < 120; i++) blot(g, IN0 + rand() * (IN1 - IN0), IN0 + rand() * (IN1 - IN0), 30 + rand() * 90, rand() < 0.5 ? hexA(C.gravelHi, 0.2) : hexA(C.gravelLo, 0.25), rand);
  grit(g, rand, IN0, IN0, IN1 - IN0, IN1 - IN0, 16000, 'rgba(40, 38, 34, 0.4)', 'rgba(220, 216, 200, 0.22)');
  // a dirt berm under the HESCO line, inside and out
  g.strokeStyle = hexA(C.dustDeep, 0.5); g.lineWidth = 34; g.strokeRect(OUT0 + 25, OUT0 + 25, OUT1 - OUT0 - 50, OUT1 - OUT0 - 50);
}

function yard(g: G, rand: R) {
  // the parade ground's concrete, in poured bays with expansion joints
  const { x0, y0, x1, y1 } = YARD;
  g.fillStyle = C.slab; g.fillRect(x0, y0, x1 - x0, y1 - y0);
  for (let bx = x0; bx < x1; bx += 100) for (let by = y0; by < y1; by += 100) { g.fillStyle = hash(bx, by) < 0.5 ? hexA(C.slabHi, 0.18) : hexA(C.slabLo, 0.2); g.fillRect(bx, by, 100, 100); }
  grit(g, rand, x0, y0, x1 - x0, y1 - y0, 7000, 'rgba(40, 40, 40, 0.3)', 'rgba(230, 228, 220, 0.18)');
  g.strokeStyle = 'rgba(30, 30, 30, 0.35)'; g.lineWidth = 1.5;
  g.beginPath(); for (let k = x0; k <= x1; k += 100) { g.moveTo(k, y0); g.lineTo(k, y1); g.moveTo(x0, k - x0 + y0); g.lineTo(x1, k - x0 + y0); } g.stroke();
  // cracks and old stains
  for (let i = 0; i < 22; i++) {
    let x = x0 + rand() * (x1 - x0), y = y0 + rand() * (y1 - y0);
    g.strokeStyle = 'rgba(30, 30, 28, 0.4)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 5; k++) { x += (rand() - 0.5) * 40; y += (rand() - 0.5) * 40; g.lineTo(x, y); }
    g.stroke();
  }
  for (let i = 0; i < 10; i++) blot(g, x0 + rand() * (x1 - x0), y0 + rand() * (y1 - y0), 10 + rand() * 20, 'rgba(30, 28, 26, 0.18)', rand);
  g.strokeStyle = C.ink; g.lineWidth = 2; g.strokeRect(x0, y0, x1 - x0, y1 - y0);
  // the TOC: a sandbag ring painted round the core (flat: the squad's own walls go on it), its slab and the name
  g.fillStyle = hexA(C.slabLo, 0.5); g.fillRect(MID - 110, MID - 110, 220, 220);
  g.strokeStyle = hexA(C.bag, 0.55); g.lineWidth = 12; g.setLineDash([22, 4]); g.strokeRect(MID - 104, MID - 104, 208, 208); g.setLineDash([]);
  g.strokeStyle = 'rgba(30, 28, 18, 0.5)'; g.lineWidth = 1.5; g.strokeRect(MID - 110, MID - 110, 220, 220); g.strokeRect(MID - 98, MID - 98, 196, 196);
  stencil(g, 'TOC  ·  BASTION ACTUAL', MID, MID - 245, 26);
  stencil(g, 'HOLD THE LINE', MID, MID + 250, 20, 0, 'rgba(214, 176, 58, 0.5)');
  // the rally arrows painted from each gate in to the TOC
  g.fillStyle = 'rgba(214, 176, 58, 0.4)';
  for (let q = 0; q < 4; q++) {
    const d = OUT_DIRS[q]!;
    for (const k of [420, 360]) {
      const cx = MID + d.x * k, cy = MID + d.y * k, a = Math.atan2(-d.y, -d.x);
      g.save(); g.translate(cx, cy); g.rotate(a); g.beginPath(); g.moveTo(14, 0); g.lineTo(-10, -14); g.lineTo(-4, 0); g.lineTo(-10, 14); g.closePath(); g.fill(); g.restore();
    }
  }
  // the four fallback nests' firing steps and brass
  for (const [cx, cy] of [[1080, 1080], [1920, 1080], [1920, 1920], [1080, 1920]] as const) brass(g, cx + (cx < MID ? 70 : -70), cy + (cy < MID ? 70 : -70), 30, 26, rand);
}

function roads(g: G) {
  // a road in from each edge to its gate, then on in to the parade ground
  for (let q = 0; q < 4; q++) {
    const gate = GATES[q]!, d = OUT_DIRS[q]!;
    const edge = { x: gate.x + d.x * 700, y: gate.y + d.y * 700 };
    const inner = { x: gate.x - d.x * 360, y: gate.y - d.y * 360 };
    track(g, [edge, gate, inner], 110);
  }
  // the perimeter road inside the wire
  g.strokeStyle = hexA(C.road, 0.3); g.lineWidth = 60; g.strokeRect(IN0 + 50, IN0 + 50, IN1 - IN0 - 100, IN1 - IN0 - 100);
}

function wireAndGates(g: G, rand: R) {
  // concertina ringing the outside of the wire, trampled through in a dozen places, and the gates' painted names and barrier booms
  const ring = OUT0 - 70;
  const sides: [number, number, number, number][] = [[ring, ring, SIZE - ring, ring], [SIZE - ring, ring, SIZE - ring, SIZE - ring], [SIZE - ring, SIZE - ring, ring, SIZE - ring], [ring, SIZE - ring, ring, ring]];
  sides.forEach(([x0, y0, x1, y1], q) => {
    const gate = GATES[q]!, breach = BREACHES[q]!;
    const len = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / len, uy = (y1 - y0) / len;
    let from = 0;
    const cuts = [gate, breach].map((p) => (p.x - x0) * ux + (p.y - y0) * uy).sort((a, b) => a - b);
    for (const c of cuts) { if (c - 140 > from) concertina(g, x0 + ux * from, y0 + uy * from, x0 + ux * (c - 140), y0 + uy * (c - 140), rand); from = c + 140; }
    if (from < len) concertina(g, x0 + ux * from, y0 + uy * from, x1, y1, rand);
  });
  for (let q = 0; q < 4; q++) {
    const gate = GATES[q]!, d = OUT_DIRS[q]!, breach = BREACHES[q]!;
    const across = { x: -d.y, y: d.x }, rot = q % 2 ? Math.PI / 2 : 0;
    // the gate's name on the road just inside, and hazard paint on the HESCO ends
    stencil(g, GATE_NAMES[q]!, gate.x - d.x * 120, gate.y - d.y * 120, 22, rot);
    for (const s of [-1, 1]) {
      const ex = gate.x + across.x * s * 112 - (q % 2 ? 0 : 12), ey = gate.y + across.y * s * 112 - (q % 2 ? 12 : 0);
      hazard(g, ex - (q % 2 ? 25 : 0), ey - (q % 2 ? 0 : 25), q % 2 ? 50 : 24, q % 2 ? 24 : 50, 6);
    }
    // the barrier boom, swung open and snapped
    g.save(); g.translate(gate.x + across.x * 95 + d.x * 60, gate.y + across.y * 95 + d.y * 60); g.rotate(Math.atan2(d.y, d.x) + 0.35);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(4, -2, 150, 8);
    hazard(g, 0, -5, 150, 9, 9, C.red, C.white); g.strokeStyle = C.ink; g.lineWidth = 1.4; g.strokeRect(0, -5, 150, 9);
    g.restore();
    // the breach: sand spilled from the burst baskets, rakes and blood where the horde poured through
    for (let i = 0; i < 9; i++) blot(g, breach.x + across.x * (rand() - 0.5) * 140 + d.x * (rand() - 0.3) * 90, breach.y + across.y * (rand() - 0.5) * 140 + d.y * (rand() - 0.3) * 90, 18 + rand() * 22, hexA(C.hescoHi, 0.45), rand);
    for (let i = 0; i < 3; i++) rakes(g, breach.x + across.x * (rand() - 0.5) * 100 + d.x * 70, breach.y + across.y * (rand() - 0.5) * 100 + d.y * 70, Math.atan2(d.y, d.x) + (rand() - 0.5), 40);
    pool(g, breach.x - d.x * 60 + across.x * 30, breach.y - d.y * 60 + across.y * 30, 14, rand);
    stencil(g, 'BREACH', breach.x - d.x * 110, breach.y - d.y * 110, 16, rot, 'rgba(210, 60, 46, 0.55)');
    // blood trails from out in the dust, through the gate and the breach
    bloodTrail(g, { x: gate.x + d.x * 520 + across.x * 40, y: gate.y + d.y * 520 + across.y * 40 }, { x: gate.x + d.x * 80, y: gate.y + d.y * 80 }, rand);
    bloodTrail(g, { x: breach.x + d.x * 420, y: breach.y + d.y * 420 }, { x: breach.x - d.x * 150, y: breach.y - d.y * 150 }, rand, true);
  }
}

/* ------------------------------------------------------------------ the base's places */

function helipad(g: G) {
  const { x, y, r } = PLACE.helipad;
  shade(g, x, y, r + 6, r + 6, 0.25);
  g.fillStyle = C.slabLo; g.beginPath(); g.arc(x, y, r + 6, 0, TAU); g.fill();
  g.fillStyle = C.slab; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  g.strokeStyle = C.yellow; g.lineWidth = 6; g.beginPath(); g.arc(x, y, r - 12, 0, TAU); g.stroke();
  g.strokeStyle = C.ink; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r + 6, 0, TAU); g.stroke();
  text(g, 'H', x, y + 4, 110, C.paint, 0, 0);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; g.fillStyle = C.steelDark; g.beginPath(); g.arc(x + Math.cos(a) * (r + 2), y + Math.sin(a) * (r + 2), 4, 0, TAU); g.fill(); }
  stencil(g, 'LZ BASTION', x, y + r + 26, 16);
  // skid marks and the windsock's post
  g.strokeStyle = 'rgba(20, 20, 20, 0.25)'; g.lineWidth = 6; g.beginPath(); g.moveTo(x - 50, y - 30); g.lineTo(x + 40, y - 40); g.moveTo(x - 46, y + 30); g.lineTo(x + 44, y + 20); g.stroke();
  poleFoot(g, x + r + 50, y - r + 10);
}

function messArea(g: G, rand: R) {
  // tables and benches outside the mess tent, a cooking fire's ring of stones, a coffee urn
  for (const [tx, ty] of [[790, 950], [900, 950]] as const) {
    shade(g, tx + 30, ty + 15, 40, 14, 0.25);
    g.fillStyle = C.woodLo; g.fillRect(tx, ty - 10, 70, 6); g.fillRect(tx, ty + 34, 70, 6);
    g.fillStyle = C.wood; rr(g, tx - 2, ty, 74, 28, 3); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 1.4; g.stroke();
    g.strokeStyle = 'rgba(40, 26, 12, 0.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(tx, ty + 9); g.lineTo(tx + 70, ty + 9); g.moveTo(tx, ty + 18); g.lineTo(tx + 70, ty + 18); g.stroke();
    for (let i = 0; i < 3; i++) { g.fillStyle = rand() < 0.5 ? C.steelHi : C.oliveHi; g.beginPath(); g.arc(tx + 10 + i * 24, ty + 14, 4, 0, TAU); g.fill(); }
  }
  // a tray upset in the rush, and a spilled pot
  blot(g, 980, 990, 14, 'rgba(120, 80, 40, 0.4)', rand);
  stencil(g, 'CHOW', 875, 720 - 8, 14);
}

function commsArea(g: G) {
  // the mast's guy wires out to their anchors, a generator and its cable
  const m = { x: 2225, y: 825 };
  g.strokeStyle = 'rgba(30, 30, 30, 0.5)'; g.lineWidth = 1.2;
  for (const [ax, ay] of [[2225, 720], [2310, 900], [2150, 900]] as const) { g.beginPath(); g.moveTo(m.x, m.y); g.lineTo(ax, ay); g.stroke(); g.fillStyle = C.steelDark; g.fillRect(ax - 3, ay - 3, 6, 6); }
  g.strokeStyle = '#1a1a1a'; g.lineWidth = 3; g.beginPath(); g.moveTo(2075, 850); g.quadraticCurveTo(2120, 920, 2200, 840); g.stroke();
  // a field radio set down, its handset dangling, on a crate
  g.fillStyle = C.crate; g.fillRect(1985, 880, 30, 22); g.strokeStyle = C.ink; g.lineWidth = 1.2; g.strokeRect(1985, 880, 30, 22);
  g.fillStyle = C.oliveLo; g.fillRect(1990, 884, 20, 14);
}

function motorPool(g: G, rand: R) {
  // painted bays round the trucks and oil stains in them; a tyre stack and a jack left out
  g.strokeStyle = 'rgba(232, 226, 204, 0.4)'; g.lineWidth = 3;
  for (const by of [975, 1575]) { g.strokeRect(2025, by, 250, 150); }
  for (const [x, y] of [[2140, 1060], [2180, 1670], [2100, 1050]] as const) blot(g, x, y, 16 + rand() * 10, 'rgba(14, 14, 16, 0.4)', rand);
  stencil(g, 'MOTOR POOL', 2150, 1170, 20);
  for (const [x, y] of [[2300, 1520], [2318, 1500]] as const) { g.fillStyle = C.rubber; g.beginPath(); g.arc(x, y, 13, 0, TAU); g.fill(); g.fillStyle = '#3a3c40'; g.beginPath(); g.arc(x, y, 6, 0, TAU); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 1.2; g.beginPath(); g.arc(x, y, 13, 0, TAU); g.stroke(); }
}

function fuelPoint(g: G, rand: R) {
  // an earth berm round the bladder, the spill in it, and the warning
  g.strokeStyle = hexA(C.dustDeep, 0.7); g.lineWidth = 14; rr(g, 1830, 2130, 190, 140, 24); g.stroke();
  blot(g, 1900, 2265, 22, 'rgba(20, 22, 26, 0.45)', rand);
  g.fillStyle = 'rgba(120, 160, 190, 0.18)'; g.beginPath(); g.ellipse(1895, 2262, 10, 4, 0, 0, TAU); g.fill();
  stencil(g, 'NO SMOKING', 1925, 2100, 15, 0, 'rgba(210, 60, 46, 0.6)');
  stencil(g, 'FUEL POINT', 1925, 2300, 14);
}

function medArea(g: G, rand: R) {
  // stretchers laid out by the med tent, a red cross painted on the gravel for the helicopters that did not come
  for (const [sx, sy] of [[2020, 2110], [2020, 2190]] as const) {
    shade(g, sx, sy + 8, 26, 10, 0.25);
    g.fillStyle = C.oliveLo; rr(g, sx - 30, sy, 60, 20, 3); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 1.3; g.stroke();
    g.fillStyle = C.steelLo; g.fillRect(sx - 36, sy + 3, 6, 3); g.fillRect(sx + 30, sy + 3, 6, 3); g.fillRect(sx - 36, sy + 14, 6, 3); g.fillRect(sx + 30, sy + 14, 6, 3);
  }
  pool(g, 2018, 2200, 9, rand);
  g.fillStyle = hexA(C.white, 0.8); g.fillRect(2060, 1975, 70, 70); g.fillStyle = hexA(C.red, 0.85); g.fillRect(2085, 1981, 20, 58); g.fillRect(2066, 2000, 58, 20);
  stencil(g, 'AID STATION', 2175, 2290, 14);
  // bloody bandages
  for (let i = 0; i < 5; i++) { g.fillStyle = rand() < 0.5 ? 'rgba(230, 226, 214, 0.8)' : 'rgba(160, 50, 40, 0.7)'; g.fillRect(2000 + rand() * 60, 2240 + rand() * 30, 8, 3); }
}

function depotArea(g: G, rand: R) {
  // pallets laid out and a forklift's tyre marks; an empty pallet or two
  for (const [px, py] of [[1000, 2240], [1240, 2100]] as const) {
    g.fillStyle = C.woodLo; g.fillRect(px, py, 50, 40); g.fillStyle = C.wood;
    for (let k = 0; k < 5; k++) g.fillRect(px, py + k * 8 + 1, 50, 5);
    g.strokeStyle = C.ink; g.lineWidth = 1.2; g.strokeRect(px, py, 50, 40);
  }
  stencil(g, 'SUPPLY', 1150, 2060, 16);
  grit(g, rand, 1080, 2080, 140, 140, 120, 'rgba(60, 40, 20, 0.4)', 'rgba(200, 170, 120, 0.3)');
}

function barracksArea(g: G) {
  // duckboards along the barracks tents, a clothesline, footlockers
  g.fillStyle = C.woodLo;
  for (let y = 1160; y < 1390; y += 18) { g.fillRect(912, y, 30, 12); }
  for (let y = 1860; y < 1990; y += 18) { g.fillRect(912, y, 30, 12); }
  g.strokeStyle = 'rgba(232, 226, 204, 0.4)'; g.lineWidth = 1; g.beginPath(); g.moveTo(700, 1450); g.lineTo(890, 1470); g.stroke();
  for (let i = 0; i < 5; i++) { g.fillStyle = i % 2 ? C.olive : C.tan; g.fillRect(710 + i * 34, 1452 + i * 3.5, 14, 18); }
  for (const [x, y] of [[960, 1200], [960, 1260], [960, 1880]] as const) { g.fillStyle = C.oliveLo; g.fillRect(x, y, 26, 16); g.strokeStyle = C.ink; g.lineWidth = 1.2; g.strokeRect(x, y, 26, 16); }
  stencil(g, 'AMMO', 800, 2290, 14, 0, 'rgba(214, 176, 58, 0.6)');
}

/* ------------------------------------------------------------------ outside the wire */

function outskirts(g: G, rand: R) {
  // scrub and craters wherever the roads and the stories are not
  const clear = (x: number, y: number, r: number) => {
    if (x > OUT0 - 120 - r && x < OUT1 + 120 + r && y > OUT0 - 120 - r && y < OUT1 + 120 + r) return false;
    if (GATES.some((p) => Math.abs(p.x - x) < 90 + r && Math.abs(p.y - y) < 900) && GATES.some((p) => Math.hypot(p.x - x, p.y - y) < 900)) return false;
    return true;
  };
  for (let i = 0; i < 70; i++) { const x = 120 + rand() * (SIZE - 240), y = 120 + rand() * (SIZE - 240); if (clear(x, y, 20)) scrub(g, x, y, 9 + rand() * 9, rand); }
  for (let i = 0; i < 22; i++) { const x = 140 + rand() * (SIZE - 280), y = 140 + rand() * (SIZE - 280), r = 18 + rand() * 22; if (clear(x, y, r)) crater(g, x, y, r, rand); }

  // the supply drop that came down wide: its canopy spread over the dust, the shrouds out to the crates
  const dp = PLACE.drop;
  g.fillStyle = 'rgba(200, 196, 170, 0.75)';
  const cp = { x: dp.x - 140, y: dp.y + 250 };
  g.beginPath(); g.moveTo(cp.x - 90, cp.y - 40); g.quadraticCurveTo(cp.x + 10, cp.y - 120, cp.x + 90, cp.y - 30); g.quadraticCurveTo(cp.x + 70, cp.y + 80, cp.x - 20, cp.y + 90); g.quadraticCurveTo(cp.x - 30, cp.y + 10, cp.x - 90, cp.y - 40); g.fill();
  g.strokeStyle = 'rgba(120, 116, 96, 0.6)'; g.lineWidth = 1.5;
  for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(cp.x - 80 + i * 28, cp.y - 40 - i * 6); g.quadraticCurveTo(cp.x, cp.y + 10, cp.x - 10 + i * 14, cp.y + 80); g.stroke(); }
  g.strokeStyle = 'rgba(40, 36, 30, 0.45)'; g.lineWidth = 1;
  for (const [cx, cy] of [[dp.x - 10, dp.y + 40], [dp.x + 40, dp.y + 50], [dp.x - 85, dp.y + 115]] as const) { g.beginPath(); g.moveTo(cx, cy); g.lineTo(cp.x + 10, cp.y - 60); g.stroke(); }
  stencil(g, 'DROP ZONE', dp.x + 20, dp.y - 170, 18);
  bloodTrail(g, { x: dp.x + 60, y: dp.y + 80 }, { x: dp.x + 300, y: dp.y + 420 }, rand, true);

  // Checkpoint Alpha: the boom's post, sandbag spill, a helmet and brass where they held, and they did not
  const a = PLACE.alpha;
  brass(g, a.x - 160, a.y + 40, 40, 40, rand); helmet(g, a.x + 90, a.y + 60); pool(g, a.x + 130, a.y + 140, 16, rand);
  stencil(g, 'CHECKPOINT ALPHA', a.x - 150, a.y - 70, 18);
  stencil(g, 'STOP', a.x, a.y + 210, 22, 0, 'rgba(210, 60, 46, 0.55)');
  rakes(g, a.x + 180, a.y + 30, 1.2, 46);

  // the convoy: scorch marks under the wrecks and a trail of debris back up the road
  const cv = PLACE.convoy;
  for (const [x, y, r] of [[2650, 1100, 90], [2700, 1775, 80], [2550, 1475, 50]] as const) { blot(g, x, y, r, 'rgba(14, 12, 10, 0.45)', rand); blot(g, x, y, r * 0.6, 'rgba(10, 8, 6, 0.4)', rand); }
  for (let i = 0; i < 26; i++) { g.fillStyle = rand() < 0.5 ? C.steelDark : C.rust; g.fillRect(cv.x - 120 + rand() * 300, cv.y - 400 + rand() * 800, 3 + rand() * 6, 2 + rand() * 4); }
  stencil(g, 'CONVOY 6', 2700, 1350, 16, Math.PI / 2);

  // the crashed helicopter: the gouge it ploughed in from the west, its rotor blades flung out, the fire it burned in
  const h = PLACE.heli;
  g.strokeStyle = 'rgba(30, 24, 18, 0.45)'; g.lineWidth = 50; g.lineCap = 'round'; g.beginPath(); g.moveTo(h.x - 210, h.y - 140); g.quadraticCurveTo(h.x - 160, h.y - 40, h.x - 60, h.y); g.stroke();
  blot(g, h.x + 40, h.y + 20, 150, 'rgba(14, 12, 10, 0.4)', rand);
  g.strokeStyle = C.steelDark; g.lineWidth = 8; g.lineCap = 'butt';
  for (const [x0, y0, x1, y1] of [[h.x + 80, h.y - 130, h.x + 250, h.y - 200], [h.x + 30, h.y + 110, h.x + 180, h.y + 250], [h.x - 120, h.y + 120, h.x - 140, h.y + 270]] as const) { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
  stencil(g, 'DUSTOFF 2-1', h.x + 40, h.y - 170, 15);
  helmet(g, h.x + 220, h.y + 90); bloodTrail(g, { x: h.x + 190, y: h.y + 60 }, { x: 560, y: 1620 }, rand, true);

  // Checkpoint Bravo, overrun: blood everywhere, a body bag, the sign kicked over
  const b = PLACE.bravo;
  pool(g, b.x - 120, b.y - 20, 22, rand); pool(g, b.x + 40, b.y + 90, 14, rand);
  g.fillStyle = '#1e2420'; rr(g, b.x - 260, b.y + 140, 80, 28, 10); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 1.4; g.stroke();
  g.strokeStyle = 'rgba(200, 190, 160, 0.4)'; g.lineWidth = 1; g.beginPath(); g.moveTo(b.x - 255, b.y + 154); g.lineTo(b.x - 185, b.y + 154); g.stroke();
  for (let i = 0; i < 6; i++) rakes(g, b.x - 200 + rand() * 400, b.y - 60 + rand() * 200, rand() * 3, 36 + rand() * 20);
  brass(g, b.x + 230, b.y - 10, 50, 60, rand);
  stencil(g, 'CHECKPOINT BRAVO', b.x + 120, b.y + 250, 18);
  g.save(); g.translate(b.x - 40, b.y + 30); g.rotate(0.9); g.fillStyle = C.white; g.fillRect(-26, -16, 52, 32); g.strokeStyle = C.ink; g.lineWidth = 1.4; g.strokeRect(-26, -16, 52, 32); text(g, 'HALT', 0, 1, 14, C.red, 0, 1); g.restore();

  // the toppled tower: where it stood, its timbers
  const t = PLACE.tower;
  blot(g, t.x, t.y, 120, 'rgba(14, 12, 10, 0.3)', rand);
  for (let i = 0; i < 10; i++) { g.fillStyle = C.woodLo; g.save(); g.translate(t.x - 120 + rand() * 240, t.y - 120 + rand() * 240); g.rotate(rand() * 3); g.fillRect(-14, -3, 28, 6); g.restore(); }
  stencil(g, 'T5', t.x + 90, t.y - 110, 18);

  // the burn pit: ash, the last of its fire, the cans; and what they were burning
  const p = PLACE.pit;
  blot(g, p.x, p.y, 90, 'rgba(30, 28, 26, 0.7)', rand); blot(g, p.x, p.y, 60, 'rgba(12, 10, 10, 0.75)', rand);
  for (let i = 0; i < 40; i++) { const a2 = rand() * TAU, d = rand() * 60; g.fillStyle = rand() < 0.2 ? 'rgba(255, 138, 58, 0.6)' : rand() < 0.5 ? C.ash : 'rgba(200, 196, 190, 0.4)'; g.fillRect(p.x + Math.cos(a2) * d, p.y + Math.sin(a2) * d * 0.7, 3, 3); }
  stencil(g, 'BURN PIT', p.x, p.y - 120, 16);

  // the APC off the north-east track: scorched ground, its tracks thrown
  const ap = PLACE.apc;
  blot(g, ap.x, ap.y, 140, 'rgba(14, 12, 10, 0.35)', rand);
  g.fillStyle = C.rubber; for (let i = 0; i < 9; i++) g.fillRect(ap.x - 160 + i * 18, ap.y + 120 + Math.sin(i) * 6, 12, 22);

  // drag marks and a few pools out in the dust: the horde does not leave much
  for (let i = 0; i < 9; i++) {
    const x = 160 + rand() * (SIZE - 320), y = 160 + rand() * (SIZE - 320);
    if (!clear(x, y, 40)) continue;
    pool(g, x, y, 10 + rand() * 10, rand);
    if (rand() < 0.6) bloodTrail(g, { x, y }, { x: x + (rand() - 0.5) * 300, y: y + (rand() - 0.5) * 300 }, rand, rand() < 0.5);
  }
}

/* ------------------------------------------------------------------ the floor */

export function paintOutpostFloor(g: CanvasRenderingContext2D, size: number, _seed: number, _plan: FloorPlan): void {
  if (size !== SIZE) { g.fillStyle = C.dust; g.fillRect(0, 0, size, size); return; }
  const rand = seeded(0x0b457);
  ground(g, rand);
  roads(g);
  yard(g, rand);
  helipad(g);
  messArea(g, rand);
  commsArea(g);
  motorPool(g, rand);
  fuelPoint(g, rand);
  medArea(g, rand);
  depotArea(g, rand);
  barracksArea(g);
  wireAndGates(g, rand);
  outskirts(g, rand);
  // floodlight poles round the parade ground and at the gates
  for (const p of FLOODS) poleFoot(g, p.x, p.y);
  // brass under the towers, from nights of shooting
  for (const t of TOWERS) brass(g, t.x + (t.x < MID ? 70 : -70), t.y + (t.y < MID ? 70 : -70), 30, 30, rand);
}

/** The floodlight poles: one at each corner of the parade ground, and one inside each gate. */
export const FLOODS: readonly { x: number; y: number }[] = [
  { x: 975, y: 1300 }, { x: 1700, y: 975 }, { x: 2025, y: 1700 }, { x: 1300, y: 2025 },
  ...GATES.map((p, q) => ({ x: p.x - OUT_DIRS[q]!.x * 90 + OUT_DIRS[q]!.y * 135, y: p.y - OUT_DIRS[q]!.y * 90 - OUT_DIRS[q]!.x * 135 })),
];
