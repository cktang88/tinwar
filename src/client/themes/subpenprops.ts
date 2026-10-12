import type { MapPoly, Pt } from '../../shared/geom.ts';
import { MAPS, type MapDef } from '../../shared/maps.ts';
import type { Rect } from '../../shared/sim/movement.ts';
import { blotch, seeded } from '../grain.ts';
import { onMapChange } from '../mapscope.ts';
import { setLight } from '../lighting.ts';
import { FLOOR, INK } from '../palette.ts';
import { reducedMotion } from '../screenfx.ts';
import type { ThemeView } from './registry.ts';

/**
 * Sub Pen's furniture (shared/maps/subpengeo.ts SUBPEN_KIT): the machines, desks, tanks, cranes and bunks that make each district a
 * place. Twin footprints, different costumes: a lathe in the shop is a console bank in control, a trolley in the torpedo store a radio
 * rack in comms. Every piece is baked once into a sprite (the engine calls drawPoly every frame); the floor under them (hazard pads,
 * rails, cable trench, grates, pipe runs, catwalks) is painted into the baked floor; the overhead things (crane jibs, the gantry beam,
 * strip lights) are baked too and laid over the players at part strength.
 */
type G = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const SIZE = 6000;
const FONT = "'Barlow Condensed', 'Arial Narrow', Impact, sans-serif";

const hash = (a: number, b = 0, c = 0): number => {
  let h = (Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663) ^ Math.imul(c | 0, 83492791)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
};
function rr(g: G, x: number, y: number, w: number, h: number, r: number) {
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  g.moveTo(x + k, y);
  g.arcTo(x + w, y, x + w, y + h, k);
  g.arcTo(x + w, y + h, x, y + h, k);
  g.arcTo(x, y + h, x, y, k);
  g.arcTo(x, y, x + w, y, k);
  g.closePath();
}
const ink = (g: G, w = 2) => { g.strokeStyle = INK; g.lineWidth = w; g.stroke(); };
const fillInk = (g: G, color: string, w = 2) => { g.fillStyle = color; g.fill(); ink(g, w); };
function label(g: G, text: string, x: number, y: number, px: number, color: string, rot = 0) {
  g.save(); g.translate(x, y); g.rotate(rot);
  g.font = `700 ${px}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  (g as unknown as { letterSpacing: string }).letterSpacing = `${Math.round(px * 0.1)}px`;
  g.fillStyle = color; g.fillText(text, 0, 0); g.restore();
}

type Look = { top: string; lit: string; shade: string; face: string };
const STEEL: Look = { top: '#6d7783', lit: '#929ca8', shade: '#4f5864', face: '#3f4650' };
const MACHINE: Look = { top: '#4f7a72', lit: '#6f9a90', shade: '#3a5c56', face: '#2c4642' };
const NAVY: Look = { top: '#46506a', lit: '#646f8c', shade: '#333a50', face: '#272d3e' };
const YELLOW: Look = { top: '#c9a23c', lit: '#e0bd5a', shade: '#9c7a26', face: '#6e561c' };
const OLIVE: Look = { top: '#68704e', lit: '#848c66', shade: '#4d5439', face: '#3a3f2b' };
const WOOD: Look = { top: '#8a6a44', lit: '#a5835a', shade: '#6a5032', face: '#4c3924' };
const RED = '#a8493f';

/** A box in the three-quarter view: `face` px of front face under its south edge, a lit north band, a shaded south band, ink. */
function box(g: G, x: number, y: number, w: number, h: number, face: number, c: Look, r = 3) {
  if (face > 0) {
    g.beginPath(); rr(g, x, y + h - r * 2, w, face + r * 2, r); g.fillStyle = c.face; g.fill();
    g.fillStyle = 'rgba(10, 12, 16, 0.32)'; g.fillRect(x + 1, y + h + face - Math.max(3, face * 0.3), w - 2, Math.max(3, face * 0.3));
    g.fillStyle = 'rgba(255, 255, 255, 0.12)'; g.fillRect(x + 1, y + h, w - 2, 2);
    g.beginPath(); rr(g, x, y + h - r * 2, w, face + r * 2, r); ink(g);
  }
  g.beginPath(); rr(g, x, y, w, h, r); g.fillStyle = c.top; g.fill();
  g.save(); g.beginPath(); rr(g, x, y, w, h, r); g.clip();
  g.fillStyle = c.lit; g.fillRect(x, y, w, Math.max(3, h * 0.14));
  g.fillStyle = c.shade; g.fillRect(x, y + h - Math.max(3, h * 0.14), w, Math.max(3, h * 0.14));
  g.restore();
  g.beginPath(); rr(g, x, y, w, h, r); ink(g, 2);
}

/** A standing cylinder: a lit disc over a shaded body that hangs `face` px below it. */
function cylinder(g: G, cx: number, cy: number, r: number, face: number, c: Look) {
  g.beginPath(); g.moveTo(cx - r, cy); g.lineTo(cx - r, cy + face); g.arc(cx, cy + face, r, Math.PI, 0, true); g.lineTo(cx + r, cy); g.closePath();
  const body = g.createLinearGradient(cx - r, 0, cx + r, 0);
  body.addColorStop(0, c.face); body.addColorStop(0.32, c.shade); body.addColorStop(0.55, c.top); body.addColorStop(1, c.face);
  g.fillStyle = body; g.fill(); ink(g, 2);
  g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fillStyle = c.top; g.fill();
  g.save(); g.clip();
  g.fillStyle = c.lit; g.beginPath(); g.arc(cx - r * 0.25, cy - r * 0.3, r * 0.78, 0, TAU); g.fill();
  g.restore();
  g.beginPath(); g.arc(cx, cy, r, 0, TAU); ink(g, 2.2);
}

function rivets(g: G, pts: readonly (readonly [number, number])[], r = 1.6) {
  g.fillStyle = 'rgba(14, 18, 22, 0.6)';
  g.beginPath();
  for (const [x, y] of pts) { g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU); }
  g.fill();
}
function wheel(g: G, x: number, y: number, r: number, color = RED) {
  g.fillStyle = color; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); ink(g, 1.8);
  g.fillStyle = 'rgba(20, 10, 10, 0.55)'; g.beginPath(); g.arc(x, y, r * 0.55, 0, TAU); g.fill();
  g.strokeStyle = color; g.lineWidth = 2; g.beginPath();
  for (let k = 0; k < 3; k++) { const a = (k * TAU) / 6 + 0.3; g.moveTo(x + Math.cos(a) * r * 0.85, y + Math.sin(a) * r * 0.85); g.lineTo(x - Math.cos(a) * r * 0.85, y - Math.sin(a) * r * 0.85); }
  g.stroke();
  g.fillStyle = '#2b2e34'; g.beginPath(); g.arc(x, y, r * 0.22, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255, 255, 255, 0.55)'; g.fillRect(x - r * 0.6, y - r * 0.65, 2.2, 2.2);
}
function gauge(g: G, x: number, y: number, r: number, seed: number) {
  g.fillStyle = '#e2dccb'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); ink(g, 1.6);
  g.strokeStyle = '#c24a3a'; g.lineWidth = 1.6; g.beginPath(); g.arc(x, y, r * 0.72, -0.4, 0.5); g.stroke();
  const a = -2.4 + hash(seed, 7) * 3.2;
  g.strokeStyle = INK; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8); g.stroke();
}
function pipe(g: G, x0: number, y0: number, x1: number, y1: number, w: number, c: string) {
  g.lineCap = 'round';
  g.strokeStyle = INK; g.lineWidth = w + 4; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = Math.max(1.5, w * 0.25); g.beginPath(); g.moveTo(x0 - 1, y0 - w * 0.25); g.lineTo(x1 - 1, y1 - w * 0.25); g.stroke();
  g.lineCap = 'butt';
}
function hazardRect(g: G, x: number, y: number, w: number, h: number, band = 8, alpha = 1) {
  g.save(); g.globalAlpha *= alpha;
  g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = FLOOR.paint; g.fillRect(x, y, w, h);
  g.fillStyle = '#2b2e34';
  for (let k = -h; k < w + h; k += band * 2) { g.beginPath(); g.moveTo(x + k, y + h); g.lineTo(x + k + band, y + h); g.lineTo(x + k + band + h, y); g.lineTo(x + k + h, y); g.closePath(); g.fill(); }
  g.restore();
}
/** A torpedo lying along +x from x0 to x1 at cy, diameter d (in the current transform). */
function fish(g: G, x0: number, x1: number, cy: number, d: number) {
  const nose = d * 0.9;
  g.fillStyle = 'rgba(8, 10, 14, 0.35)'; g.beginPath(); rr(g, x0 + 2, cy - d / 2 + 3, x1 - x0, d, d / 2); g.fill();
  g.beginPath(); rr(g, x0, cy - d / 2, x1 - x0, d, d / 2.4); g.fillStyle = '#9aa5b0'; g.fill();
  g.save(); g.clip();
  g.fillStyle = '#c4ced6'; g.fillRect(x0, cy - d / 2, x1 - x0, d * 0.28);
  g.fillStyle = '#69747f'; g.fillRect(x0, cy + d * 0.2, x1 - x0, d * 0.3);
  g.fillStyle = '#2b2e34'; for (const f of [0.2, 0.25, 0.75]) g.fillRect(x0 + (x1 - x0) * f, cy - d / 2, 3, d);
  g.fillStyle = FLOOR.paint; g.fillRect(x0 + (x1 - x0) * 0.46, cy - d / 2, 5, d);
  g.restore();
  g.beginPath(); rr(g, x0, cy - d / 2, x1 - x0, d, d / 2.4); ink(g, 1.8);
  g.fillStyle = '#d9541f'; g.beginPath(); g.moveTo(x1 - 2, cy - d / 2); g.quadraticCurveTo(x1 + nose, cy - d / 3, x1 + nose, cy); g.quadraticCurveTo(x1 + nose, cy + d / 3, x1 - 2, cy + d / 2); g.closePath(); g.fill(); ink(g, 1.8);
  g.fillStyle = 'rgba(255, 255, 255, 0.5)'; g.fillRect(x1 + 2, cy - d * 0.32, 3, 2.4);
  g.fillStyle = '#69747f'; g.fillRect(x0 - 5, cy - d * 0.42, 6, d * 0.84); g.strokeStyle = INK; g.lineWidth = 1.4; g.strokeRect(x0 - 5, cy - d * 0.42, 6, d * 0.84);
}

const boundsOf = (pts: readonly Pt[]): Rect => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
};

/**
 * Runs `top` in a frame whose +x is the piece's long axis, so one drawing serves a horizontal and a vertical piece: (0, 0) is the
 * footprint's corner, `L` the long side, `T` the short.
 */
function along(g: G, r: Rect, top: (L: number, T: number, vertical: boolean) => void) {
  const vertical = r.h > r.w;
  g.save();
  g.translate(r.x, r.y);
  if (vertical) g.transform(0, 1, 1, 0, 0, 0);
  top(vertical ? r.h : r.w, vertical ? r.w : r.h, vertical);
  g.restore();
}

/* ---------------------------------------------------------------- the pieces */

type Painter = (g: G, p: MapPoly, r: Rect, face: number) => void;

const PAINT: Record<string, Painter> = {
  // A torpedo on a low wheeled trolley, strapped down, a tow bar at one end.
  trolley(g, _p, r) {
    box(g, r.x, r.y, r.w, r.h, 8, { top: '#3a4049', lit: '#525a64', shade: '#2b3037', face: '#22262c' }, 4);
    along(g, r, (L, T) => {
      g.fillStyle = '#16181d';
      for (const fx of [14, L - 26]) for (const fy of [-3, T - 5]) { g.beginPath(); rr(g, fx, fy, 14, 8, 3); g.fill(); }
      hazardRect(g, 3, 3, 10, T - 6, 4);
      hazardRect(g, L - 13, 3, 10, T - 6, 4);
      fish(g, 22, L - 30, T / 2, Math.min(T - 18, 30));
      g.fillStyle = '#2f353d'; for (const fx of [L * 0.3, L * 0.62]) { g.fillRect(fx, 1, 7, T - 2); g.strokeStyle = INK; g.lineWidth = 1.2; g.strokeRect(fx, 1, 7, T - 2); }
      g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.moveTo(0, T / 2); g.lineTo(-14, T / 2); g.stroke();
      g.fillStyle = '#c9a23c'; g.beginPath(); g.arc(-15, T / 2, 4, 0, TAU); g.fill(); ink(g, 1.4);
    });
  },
  // A run of radio cabinets: dials, a strip of lit valves, tape reels, a bundle of cable out of the back.
  radiorack(g, p, r) {
    box(g, r.x, r.y, r.w, r.h, 18, NAVY, 3);
    along(g, r, (L, T) => {
      const n = Math.max(2, Math.round(L / 64)), cw = (L - 8) / n;
      for (let i = 0; i < n; i++) {
        const x = 4 + i * cw, kind = Math.floor(hash(i, L, p.points[0]!.x) * 3);
        g.fillStyle = '#2b3142'; g.fillRect(x + 2, 5, cw - 4, T - 10); g.strokeStyle = INK; g.lineWidth = 1.4; g.strokeRect(x + 2, 5, cw - 4, T - 10);
        if (kind === 0) { gauge(g, x + cw * 0.32, T / 2, Math.min(9, T * 0.18), i); gauge(g, x + cw * 0.7, T / 2, Math.min(7, T * 0.14), i + 9); }
        else if (kind === 1) {
          for (const fx of [0.3, 0.7]) { g.fillStyle = '#1b1e26'; g.beginPath(); g.arc(x + cw * fx, T / 2, Math.min(11, T * 0.2), 0, TAU); g.fill(); ink(g, 1.4); g.fillStyle = '#8c97a3'; g.beginPath(); g.arc(x + cw * fx, T / 2, 3, 0, TAU); g.fill(); }
        } else {
          g.fillStyle = '#0f1a14'; g.fillRect(x + 7, 10, cw - 14, T - 20);
          g.strokeStyle = '#7fe0a0'; g.lineWidth = 1.4; g.beginPath();
          for (let k = 0; k <= 10; k++) { const xx = x + 8 + (k / 10) * (cw - 16), yy = T / 2 + Math.sin(k * 1.7 + i) * (T * 0.14); if (k) g.lineTo(xx, yy); else g.moveTo(xx, yy); }
          g.stroke();
        }
        for (let k = 0; k < 4; k++) { g.fillStyle = (k + i) % 3 === 0 ? '#ff5a48' : (k + i) % 3 === 1 ? '#ffd34d' : '#8fe3d6'; g.fillRect(x + 6 + k * 6, 7, 3, 3); }
      }
      g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.moveTo(L - 6, T - 4); g.quadraticCurveTo(L + 10, T + 6, L + 18, T + 2); g.stroke();
      g.strokeStyle = '#3a3f48'; g.lineWidth = 3; g.stroke();
    });
  },
  // The torpedo hoist: a yellow column with a chain drum, the hook hanging from the arm, a hazard ring painted round its foot.
  hoist(g, _p, r, face) {
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2, R = r.w / 2;
    cylinder(g, cx, cy, R, face, YELLOW);
    g.fillStyle = '#2b2e34'; g.beginPath(); g.arc(cx, cy, R * 0.55, 0, TAU); g.fill(); ink(g, 1.6);
    g.fillStyle = '#8c97a3'; g.beginPath(); rr(g, cx - R * 0.45, cy - 8, R * 0.9, 16, 6); g.fill(); ink(g, 1.6);
    g.strokeStyle = '#4a4f57'; g.lineWidth = 2; g.beginPath(); for (let k = -3; k <= 3; k++) { g.moveTo(cx + k * 4, cy - 7); g.lineTo(cx + k * 4, cy + 7); } g.stroke();
    // The arm out to the east, the chain and hook below its end.
    g.fillStyle = '#c9a23c'; g.beginPath(); rr(g, cx, cy - 7, R + 46, 14, 3); g.fill(); ink(g, 2);
    g.strokeStyle = '#3a3f48'; g.lineWidth = 3; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(cx + R + 38, cy); g.lineTo(cx + R + 38, cy + face + 6); g.stroke(); g.setLineDash([]);
    g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.arc(cx + R + 38, cy + face + 12, 6, -1.2, Math.PI); g.stroke();
    label(g, '2T', cx, cy + face + R * 0.5, 11, '#2b2e34');
  },
  // The aerial mast: a braced lattice tower seen from above, four guy wires out to their anchors, a red lamp at the top.
  mast(g, _p, r, face) {
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2, R = r.w / 2;
    for (const a of [0.75, 2.35, 3.9, 5.5]) {
      const ax = cx + Math.cos(a) * (R + 105), ay = cy + Math.sin(a) * (R + 105);
      g.strokeStyle = 'rgba(20, 24, 30, 0.75)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(cx, cy - face * 0.6); g.lineTo(ax, ay); g.stroke();
      g.fillStyle = '#4f5864'; g.beginPath(); rr(g, ax - 8, ay - 6, 16, 12, 2); g.fill(); ink(g, 1.4);
      g.fillStyle = FLOOR.paint; g.fillRect(ax - 6, ay - 4, 12, 3);
    }
    g.fillStyle = '#3a404a'; g.beginPath(); g.arc(cx, cy + 6, R, 0, TAU); g.fill(); ink(g, 2);
    for (let k = 0; k < 4; k++) {
      const s = R * 1.5 - k * R * 0.28, oy = -k * (face / 4);
      g.strokeStyle = INK; g.lineWidth = 6; g.strokeRect(cx - s / 2, cy - s / 2 + oy, s, s);
      g.strokeStyle = k % 2 ? '#c9ccd1' : '#d9541f'; g.lineWidth = 3; g.strokeRect(cx - s / 2, cy - s / 2 + oy, s, s);
    }
    g.strokeStyle = INK; g.lineWidth = 2; g.beginPath();
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) { g.moveTo(cx + sx * R * 0.75, cy + sy * R * 0.75); g.lineTo(cx + sx * 4, cy + sy * 4 - face); }
    g.stroke();
    g.fillStyle = '#2b2e34'; g.fillRect(cx - 2, cy - face - 24, 4, 26);
    g.fillStyle = '#ff5a48'; g.beginPath(); g.arc(cx, cy - face - 26, 5, 0, TAU); g.fill(); ink(g, 1.4);
  },
  // A valve manifold against the hut wall: a header pipe, three branch valves with wheels, a gauge on each.
  manifold(g, p, r) {
    box(g, r.x, r.y, r.w, r.h, 10, STEEL, 3);
    along(g, r, (L, T) => {
      pipe(g, 8, T * 0.32, L - 8, T * 0.32, 12, '#3a7f86');
      for (let k = 0; k < 3; k++) {
        const x = L * (0.2 + k * 0.3);
        pipe(g, x, T * 0.32, x, T - 8, 8, '#3a7f86');
        wheel(g, x, T * 0.62, 10);
        gauge(g, x + 15, T * 0.24, 6, k + p.points[0]!.y);
      }
    });
  },
  // A two-high bunk: rails, a striped mattress, a pillow, a grey blanket kicked half off, a ladder at the foot.
  bunk(g, p, r) {
    box(g, r.x, r.y, r.w, r.h, 12, { top: '#59616b', lit: '#737c87', shade: '#444b54', face: '#353b43' }, 3);
    along(g, r, (L, T) => {
      g.fillStyle = '#c9c1ad'; g.beginPath(); rr(g, 6, 6, L - 12, T - 12, 4); g.fill(); ink(g, 1.5);
      g.fillStyle = 'rgba(80, 100, 140, 0.35)'; for (let x = 12; x < L - 12; x += 10) g.fillRect(x, 6, 4, T - 12);
      g.fillStyle = '#e8e2d2'; g.beginPath(); rr(g, 9, 10, 26, T - 20, 6); g.fill(); ink(g, 1.4);
      const kick = hash(p.points[0]!.x, p.points[0]!.y) * 20;
      g.fillStyle = '#5d6b5a'; g.beginPath(); g.moveTo(42, 7); g.lineTo(L - 10, 7); g.lineTo(L - 10, T - 7); g.lineTo(52 + kick, T - 7); g.quadraticCurveTo(40 + kick, T / 2, 46, 7); g.closePath(); g.fill(); ink(g, 1.5);
      g.strokeStyle = 'rgba(20, 26, 20, 0.4)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(60 + kick, 10); g.lineTo(L - 16, T - 12); g.moveTo(80 + kick, 10); g.lineTo(L - 30, T - 10); g.stroke();
      g.strokeStyle = '#2b2e34'; g.lineWidth = 3; g.beginPath(); g.moveTo(L - 3, 4); g.lineTo(L - 3, T - 4); g.stroke();
      g.lineWidth = 2; g.beginPath(); for (let y = 10; y < T - 6; y += 10) { g.moveTo(L - 7, y); g.lineTo(L + 1, y); } g.stroke();
    });
  },
  // The flood board: a sloped desk with a lit mimic of both slips, lamps on each sluice, a row of brass levers.
  floodboard(g, _p, r) {
    box(g, r.x, r.y, r.w, r.h, 12, STEEL, 3);
    const x = r.x + 10, y = r.y + 10, w = r.w - 20, h = r.h - 34;
    g.fillStyle = '#16232a'; g.fillRect(x, y, w, h); g.strokeStyle = INK; g.lineWidth = 1.6; g.strokeRect(x, y, w, h);
    g.strokeStyle = '#5fc8d0'; g.lineWidth = 2;
    g.strokeRect(x + 8, y + 8, w * 0.38, h - 16); g.strokeRect(x + w * 0.56, y + 8, w * 0.38, h - 16);
    g.beginPath(); g.moveTo(x + 8 + w * 0.38, y + h / 2); g.lineTo(x + w * 0.56, y + h / 2); g.stroke();
    for (let k = 0; k < 6; k++) { g.fillStyle = k === 2 ? '#ff5a48' : '#7fe0a0'; g.beginPath(); g.arc(x + 14 + k * (w - 28) / 5, y + h - 6, 2.6, 0, TAU); g.fill(); }
    for (let k = 0; k < 7; k++) {
      const lx = r.x + 18 + k * (r.w - 36) / 6, ly = r.y + r.h - 16;
      g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.moveTo(lx, ly + 4); g.lineTo(lx + (k % 2 ? 3 : -3), ly - 6); g.stroke();
      g.fillStyle = '#c9a23c'; g.beginPath(); g.arc(lx + (k % 2 ? 3 : -3), ly - 7, 3, 0, TAU); g.fill(); ink(g, 1.2);
    }
  },
  // The wardroom table: a cloth, plates, mugs, a hand of cards abandoned mid-game, stools round it.
  messtable(g, p, r) {
    g.fillStyle = '#3a3f48';
    for (let k = 0; k < 3; k++) for (const sy of [-1, 1]) { const sx = r.x + r.w * (0.2 + k * 0.3), yy = sy < 0 ? r.y - 12 : r.y + r.h + 20; g.beginPath(); g.arc(sx, yy, 11, 0, TAU); g.fill(); ink(g, 1.6); g.fillStyle = '#8a3a32'; g.beginPath(); g.arc(sx, yy - 1, 7, 0, TAU); g.fill(); g.fillStyle = '#3a3f48'; }
    box(g, r.x, r.y, r.w, r.h, 10, WOOD, 4);
    g.fillStyle = '#e2dccb'; g.beginPath(); rr(g, r.x + 14, r.y + 10, r.w - 28, r.h - 24, 3); g.fill();
    g.strokeStyle = 'rgba(160, 60, 50, 0.45)'; g.lineWidth = 3; g.strokeRect(r.x + 20, r.y + 15, r.w - 40, r.h - 34);
    const rand = seeded((p.points[0]!.x * 7 + p.points[0]!.y) | 0);
    for (let k = 0; k < 4; k++) {
      const px = r.x + 34 + k * (r.w - 68) / 3, py = r.y + (k % 2 ? r.h - 30 : 24);
      g.fillStyle = '#f2efe6'; g.beginPath(); g.arc(px, py, 10, 0, TAU); g.fill(); ink(g, 1.4);
      g.fillStyle = k === 1 ? '#c9a23c' : '#9c5a3a'; g.beginPath(); g.arc(px + rand() * 3 - 1.5, py + rand() * 3 - 1.5, 4.5, 0, TAU); g.fill();
      g.fillStyle = '#d9d2bd'; g.beginPath(); g.arc(px + 15, py - 2, 4.5, 0, TAU); g.fill(); ink(g, 1.2);
      g.fillStyle = '#4a2f1a'; g.beginPath(); g.arc(px + 15, py - 2, 2.5, 0, TAU); g.fill();
    }
    for (let k = 0; k < 5; k++) { g.save(); g.translate(r.x + r.w / 2 - 12 + k * 6, r.y + r.h / 2 - 4); g.rotate(-0.5 + k * 0.25); g.fillStyle = '#f7f4ec'; g.fillRect(-4, -6, 8, 12); g.strokeStyle = INK; g.lineWidth = 1; g.strokeRect(-4, -6, 8, 12); g.fillStyle = k % 2 ? '#c24a3a' : '#2b2e34'; g.fillRect(-1.5, -2, 3, 3); g.restore(); }
  },
  // Valve stands: red and teal pipes up out of the deck into a header, big wheels, a gauge.
  valvestand(g, p, r) {
    box(g, r.x, r.y, r.w, r.h, 14, { top: '#545c66', lit: '#6f7883', shade: '#3e454e', face: '#333941' }, 3);
    along(g, r, (L, T) => {
      pipe(g, 6, T * 0.5, L - 6, T * 0.5, 14, '#a8552e');
      for (let k = 0; k < Math.max(2, Math.round(L / 50)); k++) {
        const x = (L / Math.max(2, Math.round(L / 50))) * (k + 0.5);
        wheel(g, x, T * 0.5, Math.min(14, T * 0.32));
      }
      gauge(g, L - 12, 10, 6, p.points[0]!.x);
    });
    label(g, 'SEACOCK', r.x + r.w / 2, r.y + r.h + 7, 9, 'rgba(226, 220, 203, 0.85)');
  },
  // Crew lockers: tall green-grey doors with vents, a name card on each, one left ajar.
  locker(g, p, r) {
    box(g, r.x, r.y, r.w, r.h, 14, OLIVE, 2);
    along(g, r, (L, T, vertical) => {
      const n = Math.max(2, Math.round(L / 30)), cw = L / n;
      const names = ['DUTCH', 'MAGS', 'PIP', 'ORTIZ', 'KOV', 'SAM'];
      for (let i = 0; i < n; i++) {
        const x = i * cw;
        g.strokeStyle = INK; g.lineWidth = 1.5; g.strokeRect(x + 2, 3, cw - 4, T - 6);
        g.fillStyle = 'rgba(14, 18, 12, 0.45)'; for (let k = 0; k < 3; k++) g.fillRect(x + 6, 7 + k * 4, cw - 12, 2);
        g.fillStyle = '#e2dccb'; g.fillRect(x + 5, T - 14, cw - 10, 6);
        if (!vertical) label(g, names[(i + Math.floor(hash(p.points[0]!.x) * 6)) % 6]!, x + cw / 2, T - 11, 5, '#3b2f1e');
        if (hash(i, p.points[0]!.y) < 0.2) { g.fillStyle = 'rgba(8, 10, 12, 0.6)'; g.fillRect(x + cw - 8, 3, 6, T - 6); }
      }
    });
  },
  // A lathe: the bed with its ways, the headstock and chuck at one end, the carriage and tool post, the tailstock, swarf.
  lathe(g, p, r) {
    box(g, r.x, r.y, r.w, r.h, 14, MACHINE, 3);
    along(g, r, (L, T) => {
      g.fillStyle = '#2f3a38'; g.fillRect(52, T * 0.3, L - 70, T * 0.4); g.strokeStyle = INK; g.lineWidth = 1.4; g.strokeRect(52, T * 0.3, L - 70, T * 0.4);
      g.fillStyle = '#b6c0ca'; g.fillRect(52, T * 0.36, L - 70, 3); g.fillRect(52, T * 0.6, L - 70, 3);
      g.fillStyle = MACHINE.lit; g.beginPath(); rr(g, 4, 4, 46, T - 8, 4); g.fill(); ink(g, 1.8);
      g.fillStyle = '#e2dccb'; g.fillRect(12, 10, 14, 8); g.strokeStyle = INK; g.lineWidth = 1; g.strokeRect(12, 10, 14, 8);
      g.fillStyle = '#8c97a3'; g.beginPath(); g.arc(56, T / 2, T * 0.28, 0, TAU); g.fill(); ink(g, 1.8);
      g.strokeStyle = INK; g.lineWidth = 1.4; g.beginPath(); for (let k = 0; k < 3; k++) { const a = k * TAU / 3; g.moveTo(56, T / 2); g.lineTo(56 + Math.cos(a) * T * 0.26, T / 2 + Math.sin(a) * T * 0.26); } g.stroke();
      const cx = L * 0.55;
      g.fillStyle = '#5c8a80'; g.beginPath(); rr(g, cx - 16, 3, 32, T - 6, 3); g.fill(); ink(g, 1.6);
      g.fillStyle = '#3a3f48'; g.fillRect(cx - 5, T * 0.2, 10, 12); g.strokeStyle = INK; g.lineWidth = 1.2; g.strokeRect(cx - 5, T * 0.2, 10, 12);
      wheel(g, cx + 8, T - 9, 6, '#3a3f48');
      g.fillStyle = MACHINE.lit; g.beginPath(); rr(g, L - 26, 8, 20, T - 16, 3); g.fill(); ink(g, 1.6);
      g.fillStyle = '#c9a23c'; for (let k = 0; k < 7; k++) { const sx = 60 + hash(k, p.points[0]!.x) * (L - 90), sy = T + 4 + hash(k, 3) * 10; g.beginPath(); g.arc(sx, sy, 2.5, 0, Math.PI * 1.4); g.strokeStyle = '#c9b06a'; g.lineWidth = 1.4; g.stroke(); }
    });
  },
  // A console bank: three screens under hoods, a strip of switches, the duty chair pushed back.
  console(g, p, r) {
    box(g, r.x, r.y, r.w, r.h, 16, NAVY, 3);
    along(g, r, (L, T) => {
      const n = Math.max(2, Math.round(L / 70)), cw = (L - 10) / n;
      for (let i = 0; i < n; i++) {
        const x = 5 + i * cw;
        g.fillStyle = '#1b1f2a'; g.beginPath(); rr(g, x + 3, 5, cw - 6, T * 0.55, 3); g.fill(); ink(g, 1.4);
        const kind = (i + Math.floor(hash(p.points[0]!.x, p.points[0]!.y) * 3)) % 3;
        g.fillStyle = kind === 0 ? '#1d3a2c' : kind === 1 ? '#1d2c3a' : '#3a2620'; g.fillRect(x + 7, 9, cw - 14, T * 0.55 - 8);
        g.strokeStyle = kind === 0 ? '#7fe0a0' : kind === 1 ? '#8fd3ff' : '#ff9a70'; g.lineWidth = 1.4;
        if (kind === 0) { g.beginPath(); g.arc(x + cw / 2, 9 + (T * 0.55 - 8) / 2, Math.min(cw, T * 0.55) * 0.3, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(x + cw / 2, 9 + (T * 0.55 - 8) / 2); g.lineTo(x + cw / 2 + 9, 12); g.stroke(); }
        else if (kind === 1) { g.beginPath(); for (let k = 0; k <= 8; k++) { const xx = x + 9 + (k / 8) * (cw - 18), yy = 9 + (T * 0.55 - 8) * (0.5 + 0.35 * Math.sin(k * 1.3 + i)); if (k) g.lineTo(xx, yy); else g.moveTo(xx, yy); } g.stroke(); }
        else { g.fillStyle = '#ff9a70'; for (let k = 0; k < 3; k++) g.fillRect(x + 10, 12 + k * 5, (cw - 20) * (0.4 + 0.5 * hash(k, i)), 2); }
        for (let k = 0; k < 5; k++) { g.fillStyle = (k + i) % 4 === 0 ? '#ff5a48' : (k + i) % 4 === 1 ? '#ffd34d' : '#9aa5b0'; g.fillRect(x + 6 + k * (cw - 12) / 5, T * 0.72, 5, 4); }
      }
      g.fillStyle = '#2b2e34'; g.beginPath(); g.arc(L / 2, T + 18, 11, 0, TAU); g.fill(); ink(g, 1.6);
      g.fillStyle = '#4a5a7a'; g.beginPath(); rr(g, L / 2 - 9, T + 8, 18, 9, 3); g.fill(); ink(g, 1.2);
    });
  },
  // The drill press: a heavy round base, the column, the head with its motor and three spoked feed handles.
  drill(g, _p, r, face) {
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2, R = r.w / 2;
    cylinder(g, cx, cy, R, face * 0.4, MACHINE);
    g.fillStyle = MACHINE.lit; g.beginPath(); rr(g, cx - 16, cy - face * 0.5 - 14, 32, 30, 5); g.fill(); ink(g, 2);
    g.fillStyle = '#3a3f48'; g.beginPath(); g.arc(cx, cy - face * 0.5 - 18, 9, 0, TAU); g.fill(); ink(g, 1.6);
    g.strokeStyle = INK; g.lineWidth = 2.5; g.beginPath();
    for (let k = 0; k < 3; k++) { const a = 0.4 + (k * TAU) / 3; g.moveTo(cx + 14, cy - face * 0.5); g.lineTo(cx + 14 + Math.cos(a) * 16, cy - face * 0.5 + Math.sin(a) * 16); }
    g.stroke();
    g.fillStyle = '#c24a3a'; for (let k = 0; k < 3; k++) { const a = 0.4 + (k * TAU) / 3; g.beginPath(); g.arc(cx + 14 + Math.cos(a) * 16, cy - face * 0.5 + Math.sin(a) * 16, 3, 0, TAU); g.fill(); }
  },
  // The periscope well: a raised ring, the tube with its training handles folded out, the eyepiece box, a hazard ring on the deck.
  periscope(g, _p, r, face) {
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2, R = r.w / 2;
    g.strokeStyle = 'rgba(217, 166, 43, 0.85)'; g.lineWidth = 6; g.setLineDash([10, 8]); g.beginPath(); g.arc(cx, cy + 4, R + 18, 0, TAU); g.stroke(); g.setLineDash([]);
    cylinder(g, cx, cy, R, face, { top: '#5f777c', lit: '#829a9d', shade: '#44585e', face: '#35464c' });
    g.fillStyle = '#2b3338'; g.beginPath(); g.arc(cx, cy, R * 0.6, 0, TAU); g.fill(); ink(g, 1.6);
    g.fillStyle = '#829a9d'; g.beginPath(); rr(g, cx - 12, cy - 22, 24, 30, 5); g.fill(); ink(g, 2);
    g.fillStyle = '#10181c'; g.fillRect(cx - 8, cy + 2, 16, 7); g.fillStyle = '#5fa8a4'; g.fillRect(cx - 6, cy + 3, 4, 3);
    g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.moveTo(cx - 12, cy - 6); g.lineTo(cx - 30, cy - 6); g.moveTo(cx + 12, cy - 6); g.lineTo(cx + 30, cy - 6); g.stroke();
    g.strokeStyle = '#c9a23c'; g.lineWidth = 3; g.stroke();
    label(g, 'ATTACK SCOPE', cx, cy + face + R + 8, 9, 'rgba(226, 220, 203, 0.85)');
  },
  // A workbench: plank top worn dark in the middle, a vice, a hammer, spanners, a coffee tin of bolts, a pegboard edge.
  bench(g, p, r) {
    box(g, r.x, r.y, r.w, r.h, 12, WOOD, 3);
    g.save(); g.beginPath(); g.rect(r.x, r.y, r.w, r.h); g.clip();
    g.strokeStyle = 'rgba(40, 26, 14, 0.4)'; g.lineWidth = 1.4; g.beginPath(); for (let y = r.y + 15; y < r.y + r.h; y += 15) { g.moveTo(r.x, y); g.lineTo(r.x + r.w, y); } g.stroke();
    blotch(g, r.x + r.w * 0.5, r.y + r.h * 0.5, r.w * 0.3, '30, 20, 10', 0.25);
    g.restore();
    g.fillStyle = '#3a3f48'; g.beginPath(); rr(g, r.x + 8, r.y + 8, 30, 22, 3); g.fill(); ink(g, 1.6);
    g.fillStyle = '#8c97a3'; g.fillRect(r.x + 12, r.y + 12, 22, 5); g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(r.x + 23, r.y + 30); g.lineTo(r.x + 23, r.y + 42); g.stroke();
    g.save(); g.translate(r.x + r.w * 0.45, r.y + r.h * 0.4); g.rotate(-0.3);
    g.fillStyle = '#8a6a44'; g.fillRect(-20, -2.5, 30, 5); g.fillStyle = '#3a3f48'; g.fillRect(10, -7, 8, 14); g.strokeStyle = INK; g.lineWidth = 1.2; g.strokeRect(-20, -2.5, 30, 5); g.strokeRect(10, -7, 8, 14);
    g.restore();
    for (let k = 0; k < 3; k++) { g.save(); g.translate(r.x + r.w * 0.66 + k * 12, r.y + r.h * 0.6); g.rotate(0.6 + k * 0.2); g.fillStyle = '#b6c0ca'; g.fillRect(-12, -2, 24, 4); g.beginPath(); g.arc(12, 0, 4, 0, TAU); g.fill(); g.strokeStyle = INK; g.lineWidth = 1; g.strokeRect(-12, -2, 24, 4); g.restore(); }
    g.fillStyle = '#c24a3a'; g.beginPath(); g.arc(r.x + r.w - 20, r.y + 20, 9, 0, TAU); g.fill(); ink(g, 1.4);
    g.fillStyle = '#5a5f66'; g.beginPath(); g.arc(r.x + r.w - 20, r.y + 20, 6, 0, TAU); g.fill();
    label(g, p.id?.includes('~') ? '' : 'ORTIZ', r.x + r.w / 2, r.y + r.h + 6, 8, 'rgba(226, 220, 203, 0.7)');
  },
  // The chart table: a sea chart under glass with a plotted track, parallel rules, dividers, a red lamp and a cold mug.
  chart(g, _p, r) {
    box(g, r.x, r.y, r.w, r.h, 12, WOOD, 3);
    const x = r.x + 8, y = r.y + 8, w = r.w - 16, h = r.h - 22;
    g.fillStyle = '#dfe2cf'; g.fillRect(x, y, w, h);
    g.fillStyle = '#b9cfd2'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + w * 0.42, y); g.quadraticCurveTo(x + w * 0.3, y + h * 0.5, x + w * 0.36, y + h); g.lineTo(x, y + h); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(60, 90, 110, 0.35)'; g.lineWidth = 1; g.beginPath(); for (let k = 1; k < 5; k++) { g.moveTo(x + (w * k) / 5, y); g.lineTo(x + (w * k) / 5, y + h); g.moveTo(x, y + (h * k) / 4); g.lineTo(x + w, y + (h * k) / 4); } g.stroke();
    g.strokeStyle = '#c24a3a'; g.lineWidth = 1.6; g.setLineDash([5, 3]); g.beginPath(); g.moveTo(x + w * 0.2, y + h * 0.8); g.lineTo(x + w * 0.5, y + h * 0.45); g.lineTo(x + w * 0.85, y + h * 0.3); g.stroke(); g.setLineDash([]);
    g.strokeStyle = INK; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + w * 0.62, y + h * 0.2); g.lineTo(x + w * 0.55, y + h * 0.75); g.moveTo(x + w * 0.62, y + h * 0.2); g.lineTo(x + w * 0.72, y + h * 0.72); g.stroke();
    g.fillStyle = 'rgba(80, 60, 30, 0.6)'; g.save(); g.translate(x + w * 0.3, y + h * 0.55); g.rotate(-0.4); g.fillRect(-26, -3, 52, 6); g.restore();
    g.fillStyle = '#e8e2d2'; g.beginPath(); g.arc(x + w - 10, y + h - 6, 6, 0, TAU); g.fill(); ink(g, 1.2);
    g.fillStyle = '#4a2f1a'; g.beginPath(); g.arc(x + w - 10, y + h - 6, 3.5, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255, 255, 255, 0.25)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 6, y + h - 4); g.lineTo(x + w * 0.4, y + 4); g.stroke();
    g.strokeStyle = INK; g.lineWidth = 1.6; g.strokeRect(x, y, w, h);
  },
  // A gantry crane leg: a yellow steel post on a rail bogie, bolted foot, a hazard collar.
  gantry(g, _p, r, face) {
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2, R = r.w / 2;
    g.fillStyle = '#3a3f48'; g.beginPath(); rr(g, cx - R - 8, cy - 10, (R + 8) * 2, 34, 4); g.fill(); ink(g, 1.8);
    g.fillStyle = '#16181d'; for (const sx of [-1, 1]) { g.beginPath(); g.arc(cx + sx * (R + 2), cy + 18, 6, 0, TAU); g.fill(); }
    box(g, cx - R * 0.75, cy - R * 0.75, R * 1.5, R * 1.5, face, YELLOW, 3);
    hazardRect(g, cx - R * 0.75 + 3, cy - R * 0.75 + 3, R * 1.5 - 6, 6, 3);
    rivets(g, [[cx - 8, cy - 2], [cx + 8, cy - 2], [cx - 8, cy + 10], [cx + 8, cy + 10]], 2);
  },
  // A searchlight on a pedestal: a drum with a big lens, cooling fins, aimed out over the yard.
  searchlight(g, _p, r, face) {
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2, R = r.w / 2;
    cylinder(g, cx, cy, R * 0.7, face * 0.6, STEEL);
    g.save(); g.translate(cx, cy - face * 0.45); g.rotate(-0.6);
    g.fillStyle = '#4f5864'; g.beginPath(); rr(g, -16, -15, 30, 30, 6); g.fill(); ink(g, 2);
    g.strokeStyle = 'rgba(14, 18, 22, 0.6)'; g.lineWidth = 1.5; g.beginPath(); for (let k = -10; k <= 6; k += 4) { g.moveTo(k, -14); g.lineTo(k, 14); } g.stroke();
    g.fillStyle = '#f2eccc'; g.beginPath(); g.ellipse(17, 0, 6, 16, 0, 0, TAU); g.fill(); ink(g, 2);
    g.fillStyle = 'rgba(255, 255, 255, 0.8)'; g.fillRect(14, -10, 3, 6);
    g.restore();
  },
  // A fuel bowser: the cab at the south end, the oval tank with bands and a manway, the hose reel, the flammable diamond.
  bowser(g, p, r) {
    const vertical = r.h > r.w;
    g.fillStyle = '#16181d';
    const wheels = vertical ? [[r.x - 4, r.y + 30], [r.x + r.w - 6, r.y + 30], [r.x - 4, r.y + r.h - 70], [r.x + r.w - 6, r.y + r.h - 70], [r.x - 4, r.y + r.h - 34], [r.x + r.w - 6, r.y + r.h - 34]] : [[r.x + 30, r.y - 4], [r.x + 30, r.y + r.h - 6], [r.x + r.w - 70, r.y - 4], [r.x + r.w - 70, r.y + r.h - 6], [r.x + r.w - 34, r.y - 4], [r.x + r.w - 34, r.y + r.h - 6]];
    for (const [wx, wy] of wheels) { g.beginPath(); rr(g, wx!, wy!, vertical ? 10 : 22, vertical ? 22 : 10, 3); g.fill(); }
    // Chassis.
    box(g, r.x + 4, r.y + 4, r.w - 8, r.h - 8, 10, { top: '#2f353d', lit: '#454c57', shade: '#22262c', face: '#1b1e23' }, 3);
    const cab = vertical ? { x: r.x + 6, y: r.y + r.h - 62, w: r.w - 12, h: 56 } : { x: r.x + r.w - 62, y: r.y + 6, w: 56, h: r.h - 12 };
    const tank = vertical ? { x: r.x + 8, y: r.y + 8, w: r.w - 16, h: r.h - 78 } : { x: r.x + 8, y: r.y + 8, w: r.w - 78, h: r.h - 16 };
    // Tank: a long rounded cylinder, lit along its crown.
    g.beginPath(); rr(g, tank.x, tank.y, tank.w, tank.h, Math.min(tank.w, tank.h) / 2); g.fillStyle = '#b8443a'; g.fill();
    g.save(); g.clip();
    if (vertical) { g.fillStyle = '#d4675a'; g.fillRect(tank.x + tank.w * 0.18, tank.y, tank.w * 0.3, tank.h); g.fillStyle = '#7e2e27'; g.fillRect(tank.x + tank.w * 0.75, tank.y, tank.w * 0.25, tank.h); }
    else { g.fillStyle = '#d4675a'; g.fillRect(tank.x, tank.y + tank.h * 0.18, tank.w, tank.h * 0.3); g.fillStyle = '#7e2e27'; g.fillRect(tank.x, tank.y + tank.h * 0.75, tank.w, tank.h * 0.25); }
    g.fillStyle = '#e2dccb'; for (const f of [0.25, 0.75]) { if (vertical) g.fillRect(tank.x, tank.y + tank.h * f, tank.w, 5); else g.fillRect(tank.x + tank.w * f, tank.y, 5, tank.h); }
    g.restore();
    g.beginPath(); rr(g, tank.x, tank.y, tank.w, tank.h, Math.min(tank.w, tank.h) / 2); ink(g, 2);
    const mx = tank.x + tank.w / 2, my = tank.y + tank.h / 2;
    g.fillStyle = '#5a5f66'; g.beginPath(); g.arc(mx, my, 11, 0, TAU); g.fill(); ink(g, 1.6);
    g.fillStyle = '#8c97a3'; g.beginPath(); g.arc(mx - 1, my - 1, 7, 0, TAU); g.fill();
    label(g, 'FUEL', vertical ? mx : tank.x + tank.w * 0.5, vertical ? tank.y + tank.h * 0.38 : my - 1, 13, '#f2eccc', vertical ? -Math.PI / 2 : 0);
    // Cab with its windscreen toward the open end.
    box(g, cab.x, cab.y, cab.w, cab.h, 8, { top: '#c9a23c', lit: '#e0bd5a', shade: '#9c7a26', face: '#6e561c' }, 6);
    g.fillStyle = '#20343a';
    if (vertical) g.fillRect(cab.x + 6, cab.y + cab.h - 18, cab.w - 12, 12); else g.fillRect(cab.x + cab.w - 18, cab.y + 6, 12, cab.h - 12);
    g.fillStyle = 'rgba(160, 220, 230, 0.4)'; if (vertical) g.fillRect(cab.x + 8, cab.y + cab.h - 16, 10, 3); else g.fillRect(cab.x + cab.w - 16, cab.y + 8, 3, 10);
    // Hose reel and hazard diamond at the back.
    const hx = vertical ? r.x + r.w / 2 : r.x + 4, hy = vertical ? r.y + 4 : r.y + r.h / 2;
    g.fillStyle = '#2b2e34'; g.beginPath(); g.arc(hx, hy, 10, 0, TAU); g.fill(); ink(g, 1.6);
    g.strokeStyle = '#16181d'; g.lineWidth = 2; g.beginPath(); g.arc(hx, hy, 6, 0, TAU); g.stroke();
    const dx = vertical ? r.x + r.w - 14 : tank.x + tank.w - 16, dy = vertical ? tank.y + tank.h - 18 : r.y + r.h - 14;
    g.save(); g.translate(dx, dy); g.rotate(Math.PI / 4); g.fillStyle = '#d9541f'; g.fillRect(-6, -6, 12, 12); g.strokeStyle = INK; g.lineWidth = 1.4; g.strokeRect(-6, -6, 12, 12); g.restore();
    void p;
  },
  // A pump skid: a steel base with two motors and their pumps, pipes between, a starter box with a lamp.
  pumpskid(g, p, r) {
    box(g, r.x, r.y, r.w, r.h, 12, { top: '#4a5058', lit: '#5f666f', shade: '#373c43', face: '#2a2e34' }, 3);
    hazardRect(g, r.x + 3, r.y + 3, r.w - 6, 6, 3);
    along(g, r, (L, T) => {
      for (const fx of [0.28, 0.66]) {
        const x = L * fx;
        g.fillStyle = '#3a7f86'; g.beginPath(); rr(g, x - 34, T * 0.22, 46, T * 0.56, T * 0.2); g.fill(); ink(g, 1.8);
        g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x - 30, T * 0.27, 38, 3);
        g.strokeStyle = 'rgba(14, 30, 34, 0.5)'; g.lineWidth = 1.4; g.beginPath(); for (let k = -26; k < 10; k += 6) { g.moveTo(x + k, T * 0.24); g.lineTo(x + k, T * 0.76); } g.stroke();
        g.fillStyle = '#5a5f66'; g.beginPath(); g.arc(x + 22, T / 2, T * 0.2, 0, TAU); g.fill(); ink(g, 1.8);
        g.fillStyle = '#8c97a3'; g.beginPath(); g.arc(x + 20, T / 2 - 2, T * 0.1, 0, TAU); g.fill();
      }
      pipe(g, L * 0.28 + 22, T / 2, L * 0.66 - 34, T / 2, 8, '#a8552e');
      pipe(g, L * 0.66 + 22, T / 2, L - 6, T / 2, 8, '#a8552e');
      g.fillStyle = '#c9a23c'; g.beginPath(); rr(g, 6, 6, 20, T - 12, 3); g.fill(); ink(g, 1.6);
      g.fillStyle = '#7fe0a0'; g.beginPath(); g.arc(16, 14, 3, 0, TAU); g.fill();
    });
    void p;
  },
  // A small upright tank: riveted drum, a domed lid with a vent, a level gauge strip, a painted band and a number.
  smalltank(g, p, r, face) {
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2, R = r.w / 2;
    cylinder(g, cx, cy, R, face, { top: '#8c97a3', lit: '#b6c0ca', shade: '#69747f', face: '#46525c' });
    g.strokeStyle = 'rgba(20, 26, 32, 0.5)'; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, R * 0.62, 0, TAU); g.stroke();
    const studs: [number, number][] = []; for (let k = 0; k < 14; k++) { const a = (k / 14) * TAU; studs.push([cx + Math.cos(a) * R * 0.86, cy + Math.sin(a) * R * 0.86]); }
    rivets(g, studs, 1.6);
    g.fillStyle = '#a8552e'; g.beginPath(); g.arc(cx + R * 0.25, cy - R * 0.2, 8, 0, TAU); g.fill(); ink(g, 1.4);
    g.fillStyle = '#c9a23c'; g.fillRect(cx - R, cy + face * 0.45, R * 2, 7);
    g.strokeStyle = INK; g.lineWidth = 1.2; g.strokeRect(cx - R, cy + face * 0.45, R * 2, 7);
    label(g, p.id?.startsWith('fuel') ? 'DIESEL 2' : 'LUBE OIL', cx, cy + face * 0.45 + 15, 10, '#e2dccb');
  },
  // A sump pump: a round housing sunk in the deck under a grating lid, the motor on top, a discharge pipe off to the side.
  sumppump(g, p, r, face) {
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2, R = r.w / 2;
    cylinder(g, cx, cy, R, face * 0.5, { top: '#4a5560', lit: '#62707c', shade: '#38424b', face: '#2a3238' });
    g.save(); g.beginPath(); g.arc(cx, cy, R * 0.85, 0, TAU); g.clip();
    g.fillStyle = '#171c20'; g.fillRect(cx - R, cy - R, R * 2, R * 2);
    g.fillStyle = '#4f5a61'; for (let y = cy - R; y < cy + R; y += 9) g.fillRect(cx - R, y, R * 2, 4);
    g.restore();
    g.beginPath(); g.arc(cx, cy, R * 0.85, 0, TAU); ink(g, 1.8);
    cylinder(g, cx + 4, cy - 6, R * 0.38, face * 0.5, { top: '#3a7f86', lit: '#5aa0a6', shade: '#2c6268', face: '#204a4e' });
    g.fillStyle = '#c9a23c'; g.beginPath(); g.arc(cx + 4, cy - 6, 5, 0, TAU); g.fill(); ink(g, 1.2);
    pipe(g, cx + R * 0.7, cy + 8, cx + R + 26, cy + 8, 10, '#3a7f86');
    wheel(g, cx + R + 16, cy + 8, 8);
    void p;
  },
  // A torpedo loading crane's pedestal: a yellow base, the slewing ring and the operator's cab (the jib is overhead, see OVERHEAD).
  crane(g, _p, r, face) {
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2, R = r.w / 2;
    cylinder(g, cx, cy, R, face, YELLOW);
    g.strokeStyle = '#2b2e34'; g.lineWidth = 6; g.beginPath(); g.arc(cx, cy, R * 0.72, 0, TAU); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, R * 0.72 - 2, Math.PI, Math.PI * 1.6); g.stroke();
    const studs: [number, number][] = []; for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; studs.push([cx + Math.cos(a) * R * 0.88, cy + Math.sin(a) * R * 0.88]); }
    rivets(g, studs, 1.8);
    g.fillStyle = '#d4b24a'; g.beginPath(); rr(g, cx - 16, cy - 20, 30, 26, 5); g.fill(); ink(g, 2);
    g.fillStyle = '#10181c'; g.fillRect(cx - 12, cy - 16, 22, 9); g.fillStyle = '#5fa8a4'; g.fillRect(cx - 10, cy - 15, 6, 4);
    g.fillStyle = '#3a3f48'; g.beginPath(); rr(g, cx - 10, cy + 6, 22, 14, 3); g.fill(); ink(g, 1.6);
    label(g, 'SWL 3T', cx, cy + face + R * 0.55, 10, '#2b2e34');
  },
};

/** Extra room round a piece's footprint for what it draws outside it (guy wires, chairs, the hoist's arm, the crane cab's label). */
const PAD: Record<string, number> = { mast: 160, hoist: 100, messtable: 40, console: 40, pumpskid: 40, sumppump: 50 };

type Sprite = { canvas: HTMLCanvasElement; x: number; y: number };
let sprites = new WeakMap<MapPoly, Sprite>();
onMapChange(() => { sprites = new WeakMap(); });

function bake(x0: number, y0: number, x1: number, y1: number, paint: (g: G) => void): Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(x1 - x0));
  canvas.height = Math.max(1, Math.ceil(y1 - y0));
  const g = canvas.getContext('2d')!;
  g.translate(-x0, -y0);
  g.lineJoin = 'round';
  paint(g);
  return { canvas, x: x0, y: y0 };
}

/** Draws one furniture polygon from its baked sprite; false when the shape is not ours. */
export function drawKitPoly(g: G, p: MapPoly): boolean {
  const paint = p.shape ? PAINT[p.shape] : undefined;
  if (!paint) return false;
  let s = sprites.get(p);
  if (!s) {
    const r = boundsOf(p.points), face = p.height ?? 14, pad = 30 + (PAD[p.shape!] ?? 0);
    s = bake(r.x - pad, r.y - pad - face, r.x + r.w + pad, r.y + r.h + face + pad, (c) => paint(c, p, r, face));
    sprites.set(p, s);
  }
  g.drawImage(s.canvas, s.x, s.y);
  return true;
}

/* ---------------------------------------------------------------- overhead: jibs, the gantry beam, strip lights */

const kitOf = (map: MapDef, shape: string) => (map.polys ?? []).filter((p) => p.shape === shape);
const centre = (p: MapPoly) => { const b = boundsOf(p.points); return { x: b.x + b.w / 2, y: b.y + b.h / 2 }; };

/** The ceiling's strip lights (west half; the east gets their half turn). Each hangs over a lane, out of the way of the wall lamps. */
const STRIPS: readonly { x: number; y: number; rot: number }[] = [
  { x: 700, y: 650, rot: 0 }, { x: 1650, y: 900, rot: 0 }, { x: 1650, y: 3000, rot: Math.PI / 2 }, { x: 1100, y: 3800, rot: Math.PI / 2 },
  { x: 1550, y: 5730, rot: 0 }, { x: 1100, y: 4950, rot: 0 }, { x: 2700, y: 5450, rot: Math.PI / 2 }, { x: 2650, y: 650, rot: Math.PI / 2 },
];
export const stripLights = (): { x: number; y: number; rot: number }[] => STRIPS.flatMap((s) => [s, { x: SIZE - s.x, y: SIZE - s.y, rot: s.rot }]);

function paintJib(g: G, x: number, y: number, ang: number, len: number) {
  g.save(); g.translate(x, y); g.rotate(ang);
  g.fillStyle = 'rgba(8, 12, 16, 0.25)'; g.fillRect(10, 14, len, 16);
  g.fillStyle = '#d4b24a'; g.beginPath(); rr(g, -26, -11, len + 26, 22, 4); g.fill(); ink(g, 2.5);
  g.fillStyle = 'rgba(255, 255, 255, 0.25)'; g.fillRect(-24, -9, len + 22, 4);
  g.strokeStyle = INK; g.lineWidth = 1.6; g.beginPath();
  for (let k = 0; k < len - 10; k += 22) { g.moveTo(k, -9); g.lineTo(k + 11, 9); g.lineTo(k + 22, -9); }
  g.stroke();
  g.fillStyle = '#3a3f48'; g.beginPath(); rr(g, -40, -16, 26, 32, 4); g.fill(); ink(g, 2);
  // Trolley, hook and the sling with a fish in it.
  g.fillStyle = '#3a3f48'; g.beginPath(); rr(g, len - 30, -14, 22, 28, 3); g.fill(); ink(g, 1.8);
  g.rotate(-ang);
  const hx = Math.cos(ang) * (len - 19), hy = Math.sin(ang) * (len - 19);
  g.strokeStyle = '#2b2e34'; g.lineWidth = 2; g.beginPath(); g.moveTo(hx - 3, hy); g.lineTo(hx - 3, hy + 34); g.moveTo(hx + 3, hy); g.lineTo(hx + 3, hy + 34); g.stroke();
  g.fillStyle = '#c9a23c'; g.beginPath(); rr(g, hx - 30, hy + 32, 60, 7, 2); g.fill(); ink(g, 1.4);
  g.restore();
}

function paintGantryBeam(g: G, a: { x: number; y: number }, b: { x: number; y: number }) {
  const y = a.y - 46, x0 = Math.min(a.x, b.x) - 20, x1 = Math.max(a.x, b.x) + 20;
  g.fillStyle = 'rgba(8, 12, 16, 0.22)'; g.fillRect(x0 + 14, y + 40, x1 - x0, 20);
  g.fillStyle = '#c9a23c'; g.beginPath(); rr(g, x0, y - 12, x1 - x0, 24, 3); g.fill(); ink(g, 2.5);
  g.fillStyle = '#9c7a26'; g.fillRect(x0 + 2, y + 4, x1 - x0 - 4, 6);
  g.fillStyle = 'rgba(255, 255, 255, 0.28)'; g.fillRect(x0 + 2, y - 10, x1 - x0 - 4, 4);
  hazardRect(g, x0 + 2, y - 3, 30, 6, 3); hazardRect(g, x1 - 32, y - 3, 30, 6, 3);
  const mx = (x0 + x1) / 2 + 60;
  g.fillStyle = '#3a3f48'; g.beginPath(); rr(g, mx - 22, y - 18, 44, 36, 4); g.fill(); ink(g, 2);
  g.fillStyle = '#d9541f'; g.fillRect(mx - 16, y - 13, 10, 6);
  g.strokeStyle = '#2b2e34'; g.lineWidth = 2; g.beginPath(); g.moveTo(mx, y + 18); g.lineTo(mx, y + 60); g.stroke();
  g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.arc(mx, y + 66, 6, -1.2, Math.PI); g.stroke();
  label(g, 'SWL 5T', (x0 + x1) / 2 - 120, y, 12, '#2b2e34');
}

function paintStrip(g: G, x: number, y: number, rot: number) {
  g.save(); g.translate(x, y); g.rotate(rot);
  g.strokeStyle = 'rgba(20, 24, 30, 0.6)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-26, 0); g.lineTo(-40, -30); g.moveTo(26, 0); g.lineTo(40, -30); g.stroke();
  g.fillStyle = '#3a3f48'; g.beginPath(); rr(g, -34, -7, 68, 14, 4); g.fill(); ink(g, 2);
  g.fillStyle = '#f2f0d8'; g.fillRect(-28, -3, 56, 6);
  g.fillStyle = 'rgba(255, 255, 255, 0.9)'; g.fillRect(-26, -2, 20, 2);
  g.restore();
}

const overheadSprites = new WeakMap<MapDef, Sprite[]>();
function overheadOf(map: MapDef): Sprite[] {
  const hit = overheadSprites.get(map);
  if (hit) return hit;
  const out: Sprite[] = [];
  for (const c of kitOf(map, 'crane')) {
    const p = centre(c), ang = p.y < SIZE / 2 ? Math.PI / 2 + (p.x < 1500 ? -0.35 : 0.35) : -Math.PI / 2 + (p.x > 4500 ? -0.35 : 0.35), len = 230;
    out.push(bake(p.x - len - 60, p.y - len - 60, p.x + len + 60, p.y + len + 80, (g) => paintJib(g, p.x, p.y, ang, len)));
  }
  const legs = kitOf(map, 'gantry').map(centre);
  if (legs.length >= 2) {
    const [a, b] = [legs[0]!, legs[1]!];
    out.push(bake(Math.min(a.x, b.x) - 60, a.y - 100, Math.max(a.x, b.x) + 60, a.y + 60, (g) => paintGantryBeam(g, a, b)));
  }
  for (const s of stripLights()) out.push(bake(s.x - 50, s.y - 50, s.x + 50, s.y + 50, (g) => paintStrip(g, s.x, s.y, s.rot)));
  overheadSprites.set(map, out);
  return out;
}

/** The overhead layer: drawn over the players at part strength, so a jib or the gantry reads as above them without hiding anyone. */
export function drawOverhead(ctx: G, view: ThemeView, map: MapDef) {
  ctx.save();
  ctx.globalAlpha = 0.78;
  for (const s of overheadOf(map)) {
    if (s.x + s.canvas.width < view.x0 || s.x > view.x1 || s.y + s.canvas.height < view.y0 || s.y > view.y1) continue;
    ctx.drawImage(s.canvas, s.x, s.y);
  }
  ctx.restore();
}

/** Strip light pools and their lights: cool white under each fitting, a slow hum of flicker, one unit buzzing on the blink. */
export function drawStripGlow(ctx: G, now: number, view: ThemeView) {
  const calm = reducedMotion();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const [i, s] of stripLights().entries()) {
    if (s.x + 240 < view.x0 || s.x - 240 > view.x1 || s.y + 240 < view.y0 || s.y - 240 > view.y1) continue;
    const bad = i === 5 && !calm && Math.sin(now * 0.0031) * Math.sin(now * 0.0177) > 0.55;
    const f = bad ? 0.25 : 0.94 + (calm ? 0 : 0.06 * Math.sin(now * 0.003 + i));
    const grad = ctx.createRadialGradient(s.x, s.y + 20, 10, s.x, s.y + 20, 230);
    grad.addColorStop(0, `rgba(226, 240, 255, ${(0.2 * f).toFixed(3)})`);
    grad.addColorStop(1, 'rgba(226, 240, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(s.x - 230, s.y - 210, 460, 460);
    setLight(`subpen:strip:${i}`, { x: s.x, y: s.y, radius: 320, color: '#e2f0ff', intensity: 0.7 * f, flicker: 0.05, size: 10, inside: 30 });
  }
  ctx.restore();
}

/* ---------------------------------------------------------------- the floor under the furniture */

const subpen = (): MapDef => MAPS.subpen;

function grating(g: G, x: number, y: number, w: number, h: number, alpha = 1) {
  g.save(); g.globalAlpha *= alpha;
  g.fillStyle = '#171c20'; g.fillRect(x, y, w, h);
  g.fillStyle = '#4f5a61';
  if (w >= h) for (let xx = x + 3; xx < x + w - 3; xx += 9) g.fillRect(xx, y + 2, 4, h - 4);
  else for (let yy = y + 3; yy < y + h - 3; yy += 9) g.fillRect(x + 2, yy, w - 4, 4);
  g.strokeStyle = INK; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, w - 2, h - 2);
  g.restore();
}
function rail(g: G, x0: number, y0: number, x1: number, y1: number, gauge = 26) {
  const len = Math.hypot(x1 - x0, y1 - y0), a = Math.atan2(y1 - y0, x1 - x0);
  g.save(); g.translate(x0, y0); g.rotate(a);
  g.fillStyle = 'rgba(40, 32, 26, 0.55)'; for (let s = 0; s < len; s += 22) g.fillRect(s, -gauge / 2 - 7, 9, gauge + 14);
  for (const o of [-gauge / 2, gauge / 2]) { g.fillStyle = '#1c2126'; g.fillRect(0, o - 3, len, 6); g.fillStyle = '#9aa5b0'; g.fillRect(0, o - 2, len, 2.5); }
  g.restore();
}
function floorPipe(g: G, pts: readonly (readonly [number, number])[], w: number, color: string) {
  g.lineJoin = 'round'; g.lineCap = 'round';
  g.strokeStyle = 'rgba(8, 12, 16, 0.35)'; g.lineWidth = w + 6; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x + 4, y + 6) : g.moveTo(x + 4, y + 6))); g.stroke();
  g.strokeStyle = INK; g.lineWidth = w + 4; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
  g.strokeStyle = color; g.lineWidth = w; g.stroke();
  g.strokeStyle = 'rgba(255, 255, 255, 0.28)'; g.lineWidth = Math.max(1.5, w * 0.25); g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x - 1, y - w * 0.25) : g.moveTo(x - 1, y - w * 0.25))); g.stroke();
  // Flanges every so often along each run.
  g.fillStyle = '#3a3f48';
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1]!, [bx, by] = pts[i]!, len = Math.hypot(bx - ax, by - ay);
    for (let s = 60; s < len - 30; s += 120) { const t = s / len, x = ax + (bx - ax) * t, y = ay + (by - ay) * t; const v = Math.abs(bx - ax) < Math.abs(by - ay); g.fillRect(v ? x - w / 2 - 3 : x - 3, v ? y - 3 : y - w / 2 - 3, v ? w + 6 : 6, v ? 6 : w + 6); }
  }
  g.lineCap = 'butt';
}
function trench(g: G, pts: readonly (readonly [number, number])[]) {
  g.lineJoin = 'miter'; g.lineCap = 'square';
  g.strokeStyle = '#5c6670'; g.lineWidth = 34; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
  g.strokeStyle = '#11161a'; g.lineWidth = 24; g.stroke();
  for (const [c, off] of [['#c24a3a', -6], ['#3a7f86', 0], ['#c9a23c', 6]] as const) {
    g.strokeStyle = c; g.lineWidth = 3.5; g.beginPath();
    pts.forEach(([x, y], i) => { const n = i ? pts[i - 1]! : pts[1]!; const v = Math.abs(n[0] - x) < Math.abs(n[1] - y); const px = v ? x + off : x, py = v ? y : y + off; if (i) g.lineTo(px, py); else g.moveTo(px, py); });
    g.stroke();
  }
  // Grating covers over every other stretch.
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1]!, [bx, by] = pts[i]!, len = Math.hypot(bx - ax, by - ay), v = Math.abs(bx - ax) < Math.abs(by - ay);
    for (let s = 40; s < len - 60; s += 160) { const t = s / len, x = ax + (bx - ax) * t, y = ay + (by - ay) * t; grating(g, v ? x - 14 : x, v ? y : y - 14, v ? 28 : 70, v ? 70 : 28, 0.95); }
  }
  g.lineCap = 'butt';
}

/** Hazard paint round a footprint: a striped border `pad` px out from the piece, or a dashed swing circle for round ones. */
function padUnder(g: G, p: MapPoly) {
  const r = boundsOf(p.points), round = p.points.length > 4;
  if (round) {
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2, R = r.w / 2 + 22;
    g.strokeStyle = 'rgba(217, 166, 43, 0.5)'; g.lineWidth = 6; g.setLineDash([16, 12]);
    g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.stroke(); g.setLineDash([]);
    return;
  }
  const m = 14;
  g.save(); g.beginPath(); g.rect(r.x - m, r.y - m, r.w + m * 2, r.h + m * 2); g.rect(r.x - m + 8, r.y - m + 8, r.w + m * 2 - 16, r.h + m * 2 - 16); g.clip('evenodd');
  hazardRect(g, r.x - m, r.y - m, r.w + m * 2, r.h + m * 2, 7, 0.55);
  g.restore();
}

/** What a place's floor tells: rails, trenches, pipes, grates, catwalks and the furniture's hazard pads. Baked once with the floor. */
export function paintKitFloor(g: G, seed: number) {
  const map = subpen(), T = (x: number, y: number): [number, number] => [SIZE - x, SIZE - y];
  const turnAll = (pts: readonly (readonly [number, number])[]) => pts.map(([x, y]) => T(x, y));
  // Dock catwalks: a grating walk along the dock side of each slip's outer wall, yellow nosing on the edge.
  for (const [x0, x1] of [[150, 800], [950, 1850], [2000, 2650]] as const) {
    for (const [x, y, w] of [[x0, 1490, x1 - x0], [SIZE - x1, SIZE - 1490 - 60, x1 - x0]] as const) {
      grating(g, x + 10, y, w - 20, 56, 0.85);
      g.fillStyle = 'rgba(217, 166, 43, 0.75)'; g.fillRect(x + 10, y === 1490 ? y - 4 : y + 56, w - 20, 4);
    }
  }
  // Torpedo store: a narrow-gauge track out of the blast door, past the trolley and up to the slip's south gate.
  rail(g, 950, 3075, 1600, 3075); rail(g, 1612, 3088, 1612, 2560); rail(g, 1600, 2572, 2125, 2572); rail(g, 2125, 2585, 2125, 2440);
  // Comms: the cable trench from the mast to the radio racks and on to the comms block.
  trench(g, turnAll([[1900, 3300], [1900, 3500], [1350, 3500], [1350, 3800], [1500, 3800]]));
  trench(g, turnAll([[1610, 2710], [1610, 2560], [1300, 2560]]));
  // Flood control: the big pump's mains out to the slip and to the pit, valve stands on the way.
  floorPipe(g, [[1800, 3900], [2000, 3900], [2000, 3850], [2200, 3850]], 16, '#3a7f86');
  floorPipe(g, [[1650, 3800], [1650, 3700], [1420, 3700]], 12, '#a8552e');
  floorPipe(g, [[1800, 4050], [1980, 4050], [1980, 4180]], 12, '#a8552e');
  // Machine shop: the gantry's rails, swarf by the lathes, oil under the bench. Control (east): rubber matting by the consoles.
  rail(g, 1300, 5600, 1300, 5990, 34); rail(g, 2000, 5600, 2000, 5990, 34);
  g.fillStyle = 'rgba(20, 22, 30, 0.45)'; g.fillRect(SIZE - 1190, SIZE - 5250, 260, 60); g.fillRect(SIZE - 1960, SIZE - 5180, 60, 240);
  g.fillStyle = 'rgba(20, 22, 30, 0.35)'; g.fillRect(SIZE - 1170, SIZE - 5710, 240, 130);
  const rand = seeded(seed ^ 0x51ab);
  for (let k = 0; k < 40; k++) { const x = 940 + rand() * 260, y = 5220 + rand() * 40; g.strokeStyle = 'rgba(201, 176, 106, 0.6)'; g.lineWidth = 1.2; g.beginPath(); g.arc(x, y, 2 + rand() * 2, 0, Math.PI * 1.3); g.stroke(); }
  blotch(g, 1050, 5650, 90, '10, 10, 14', 0.25);
  // Fuel depot: pipework on sleepers from the tanks to the fill point, a spill tray, a no-smoking stencil. Sump yard (east): drain grates.
  floorPipe(g, [[2600, 4810], [2600, 5000], [2650, 5000], [2650, 5690]], 12, '#b8443a');
  floorPipe(g, [[2740, 5790], [2660, 5790]], 12, '#b8443a');
  floorPipe(g, turnAll([[2600, 1105], [2600, 1300], [2900, 1300], [2900, 1450]]), 12, '#b8443a');
  floorPipe(g, turnAll([[2780, 200], [2950, 200], [2950, 90]]), 10, '#b8443a');
  hazardRect(g, 2520, 5940, 140, 14, 7, 0.6);
  for (const [x, y] of [[2700, 300], [2900, 700], [2600, 1350], [3050, 1300], [3300, 800], [2750, 500]] as const) grating(g, x - 60, y - 36, 120, 72, 0.9);
  for (const [x, y] of [[SIZE - 2700, SIZE - 300], [SIZE - 2900, SIZE - 700], [SIZE - 2600, SIZE - 1350], [SIZE - 3050, SIZE - 1300], [SIZE - 3300, SIZE - 800]] as const) {
    g.fillStyle = 'rgba(184, 68, 58, 0.18)'; g.beginPath(); g.arc(x, y, 34, 0, TAU); g.fill();
  }
  // Hazard pads under every piece.
  for (const p of map.polys ?? []) if (p.shape && PAINT[p.shape] && p.shape !== 'bunk' && p.shape !== 'messtable' && p.shape !== 'locker') padUnder(g, p);
  // Floor stencils that name what a place is for.
  const stencilText = (text: string, x: number, y: number, px: number, rot = 0) => label(g, text, x, y, px, 'rgba(226, 220, 203, 0.32)', rot);
  stencilText('PUMP ROOM', 540, 3995, 20); stencilText('WARDROOM', SIZE - 570, SIZE - 3800, 22);
  stencilText('NO NAKED FLAME', 2780, 5570, 20, -Math.PI / 2); stencilText('SUMP 3', 2600, 955, 20);
  stencilText('TORPEDO ROAD', 1320, 3135, 20); stencilText('CABLE TRENCH - NO STEP', SIZE - 1620, SIZE - 3550, 18);
  for (const [x, y] of [[1100, 1420], [2200, 1430]] as const) { stencilText('KEEP CLEAR - CRANE', x, y - 88, 16); stencilText('KEEP CLEAR - CRANE', SIZE - x, SIZE - y + 100, 16); }
  stencilText('GANTRY 5T', 1650, 5960, 20); stencilText('PLOT', SIZE - 1050, SIZE - 5540, 20);
}
