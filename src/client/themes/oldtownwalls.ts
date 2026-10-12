import type { Solid, SolidKind } from '../tilt.ts';
import { C, CEL, TAU, baseId, hash, hashStr, hexA, insideWall, isTwin, openSides, roofAt, yardAt, type Open } from './oldtownkit.ts';

/**
 * Old Town's four rect walls, each painted whole into its sprite: the half-timbered house wall (limewash between dark oak, the
 * wall plate and its posts on top, braces and lit windows on the front face, each house in its own wash), dressed stone (the
 * church, the quays, the sluice and the town wall: coursed ashlar with moss at the foot), furniture (by shape and by room: beds,
 * tables, shelves of bread or jars, the bar, wash tubs, barrels, horse stalls, the post counter) and stalls, fences and benches
 * (striped awnings in the market, fish on ice at the quay, a flower-boxed fence round the beer garden).
 */
type G = CanvasRenderingContext2D;
type Rect = { x: number; y: number; w: number; h: number };

export const OLDTOWN_FACE = { otwall: 18, otstone: 16, otfurn: 10, otstall: 10 } as const;

const rects = (g: G, list: readonly Rect[]) => { g.beginPath(); for (const r of list) g.rect(r.x, r.y, r.w, r.h); };

function strips(s: Rect, o: Open, t: number): Record<'n' | 'e' | 's' | 'w', Rect[]> {
  return {
    n: o.spans.n.map(([a, b]) => ({ x: s.x + a, y: s.y, w: b - a, h: t })),
    s: o.spans.s.map(([a, b]) => ({ x: s.x + a, y: s.y + s.h - t, w: b - a, h: t })),
    w: o.spans.w.map(([a, b]) => ({ x: s.x, y: s.y + a, w: t, h: b - a })),
    e: o.spans.e.map(([a, b]) => ({ x: s.x + s.w - t, y: s.y + a, w: t, h: b - a })),
  };
}

function celBands(g: G, s: Rect, o: Open, e = 4) {
  const st = strips(s, o, e);
  g.fillStyle = CEL.light; rects(g, [...st.n, ...st.w]); g.fill();
  g.fillStyle = CEL.dark; rects(g, [...st.s, ...st.e]); g.fill();
}

/** The ink outline, only along the stretches of edge that meet open air. */
function outlineOpen(g: G, s: Rect, o: Open, width = 2) {
  g.strokeStyle = C.ink; g.lineWidth = width; g.lineCap = 'square';
  g.beginPath();
  for (const [a, b] of o.spans.n) { g.moveTo(s.x + a, s.y); g.lineTo(s.x + b, s.y); }
  for (const [a, b] of o.spans.s) { g.moveTo(s.x + a, s.y + s.h); g.lineTo(s.x + b, s.y + s.h); }
  for (const [a, b] of o.spans.w) { g.moveTo(s.x, s.y + a); g.lineTo(s.x, s.y + b); }
  for (const [a, b] of o.spans.e) { g.moveTo(s.x + s.w, s.y + a); g.lineTo(s.x + s.w, s.y + b); }
  g.stroke();
}

/** Front-face rects under each open stretch of the south edge, filled and outlined; returns them for detailing. */
function southFace(g: G, s: Rect, o: Open, fh: number, fill: string, foot: string): Rect[] {
  const list = o.spans.s.map(([a, b]) => ({ x: s.x + a, y: s.y + s.h, w: b - a, h: fh }));
  g.fillStyle = fill; rects(g, list); g.fill();
  g.fillStyle = foot; rects(g, list.map((q) => ({ ...q, y: q.y + fh * 0.7, h: fh * 0.3 }))); g.fill();
  return list;
}
function faceInk(g: G, list: readonly Rect[]) {
  g.strokeStyle = C.ink; g.lineWidth = 2; g.lineJoin = 'miter';
  g.beginPath();
  for (const q of list) { g.moveTo(q.x, q.y); g.lineTo(q.x, q.y + q.h); g.lineTo(q.x + q.w, q.y + q.h); g.lineTo(q.x + q.w, q.y); }
  g.stroke();
}
const clipTo = (g: G, list: readonly Rect[], paint: () => void) => { g.save(); rects(g, list); g.clip(); paint(); g.restore(); };

/* ------------------------------------------------------------ half-timbered wall */

const WASHES = [C.plaster, C.plasterRose, C.plasterOchre, C.plasterBlue, C.plasterSage, C.plaster] as const;
/** Each house wears its own limewash; a twin wears another, so the two halves do not read as copies. */
function washOf(s: Rect): string {
  const id = roofAt(s.x + s.w / 2, s.y + s.h / 2);
  if (!id) return C.plaster;
  return WASHES[Math.floor(hashStr(baseId(id) + (isTwin(id) ? '~' : '')) * WASHES.length)]!;
}

function otwall(g: G, s: Solid) {
  const o = openSides('otwall', s), fh = OLDTOWN_FACE.otwall;
  const { x, y, w, h } = s;
  const wash = washOf(s);
  // The front face: limewash framed in oak, a post on every grid line, braces in some bays and a lit window in others.
  const faces = southFace(g, s, o, fh, wash, 'rgba(60, 44, 28, 0.25)');
  clipTo(g, faces, () => {
    for (const q of faces) {
      g.fillStyle = C.beam; g.fillRect(q.x, q.y, q.w, 3); g.fillRect(q.x, q.y + fh - 4, q.w, 4);
      for (let px = Math.ceil(q.x / 50) * 50; px <= q.x + q.w; px += 50) g.fillRect(px - 3, q.y, 6, fh);
      for (let bx = Math.floor(q.x / 50) * 50; bx < q.x + q.w; bx += 50) {
        const k = hash(bx, q.y, 11);
        if (k < 0.34) {
          g.strokeStyle = C.beam; g.lineWidth = 4; g.beginPath();
          if (k < 0.17) { g.moveTo(bx + 3, q.y + fh - 3); g.lineTo(bx + 47, q.y + 3); } else { g.moveTo(bx + 3, q.y + 3); g.lineTo(bx + 47, q.y + fh - 3); }
          g.stroke();
        } else if (k < 0.62) {
          // a little leaded window, lamplit from inside
          g.fillStyle = C.beamLo; g.fillRect(bx + 15, q.y + 4, 20, 10);
          g.fillStyle = k < 0.5 ? C.window : '#7f8f9a'; g.fillRect(bx + 17, q.y + 5, 16, 8);
          g.fillStyle = C.beamLo; g.fillRect(bx + 24, q.y + 5, 2, 8); g.fillRect(bx + 17, q.y + 8, 16, 1.6);
        }
      }
    }
  });
  faceInk(g, faces);
  // The top: the wall plate, oak along each open edge with limewash between and a post across on every grid line.
  g.fillStyle = wash; g.fillRect(x, y, w, h);
  g.fillStyle = 'rgba(120, 96, 60, 0.12)';
  for (let i = 0; i < (w * h) / 500; i++) g.fillRect(x + hash(x, y, i) * w, y + hash(y, x, i) * h, 3, 2);
  const st = strips(s, o, 9);
  g.fillStyle = C.beam; rects(g, [...st.n, ...st.s, ...st.w, ...st.e]); g.fill();
  g.fillStyle = C.beamHi; rects(g, [...st.n, ...st.w].map((r) => (r.w > r.h ? { ...r, h: 2 } : { ...r, w: 2 }))); g.fill();
  g.fillStyle = C.beam;
  if (w >= h) for (let px = Math.ceil(x / 50) * 50; px <= x + w; px += 50) g.fillRect(Math.max(x, px - 4), y, Math.min(8, x + w - (px - 4)), h);
  else for (let py = Math.ceil(y / 50) * 50; py <= y + h; py += 50) g.fillRect(x, Math.max(y, py - 4), w, Math.min(8, y + h - (py - 4)));
  // pegs
  g.fillStyle = C.beamLo;
  if (w >= h) for (let px = Math.ceil(x / 50) * 50; px <= x + w; px += 50) { g.fillRect(px - 1.5, y + h / 2 - 1.5, 3, 3); }
  else for (let py = Math.ceil(y / 50) * 50; py <= y + h; py += 50) { g.fillRect(x + w / 2 - 1.5, py - 1.5, 3, 3); }
  celBands(g, s, o);
  outlineOpen(g, s, o);
}

/* ------------------------------------------------------------ dressed stone */

function ashlar(g: G, r: Rect, course: number, seed: number, horiz: boolean) {
  // coursed blocks: each a shade apart, joints a darker hairline-free 2 px
  const along = horiz ? r.w : r.h, across = horiz ? r.h : r.w;
  for (let c = 0, row = 0; c < across; c += course, row++) {
    let a = -(hash(seed, row) * 40);
    while (a < along) {
      const len = 34 + hash(seed, row, Math.round(a)) * 36;
      const k = hash(seed + 7, row, Math.round(a));
      g.fillStyle = k < 0.3 ? 'rgba(255, 248, 230, 0.1)' : k > 0.75 ? 'rgba(20, 18, 14, 0.12)' : 'rgba(0,0,0,0)';
      if (horiz) g.fillRect(r.x + a, r.y + c, len, course); else g.fillRect(r.x + c, r.y + a, course, len);
      g.fillStyle = 'rgba(40, 36, 30, 0.45)';
      if (horiz) g.fillRect(r.x + a, r.y + c, 2, course); else g.fillRect(r.x + c, r.y + a, course, 2);
      a += len;
    }
    g.fillStyle = 'rgba(40, 36, 30, 0.45)';
    if (c > 0) { if (horiz) g.fillRect(r.x, r.y + c, r.w, 2); else g.fillRect(r.x + c, r.y, 2, r.h); }
  }
}

function otstone(g: G, s: Solid) {
  const o = openSides('otstone', s), fh = OLDTOWN_FACE.otstone;
  const { x, y, w, h } = s;
  const trough = yardAt(x + w / 2, y + h / 2)?.yard.id === 'wellcourt';
  const seed = Math.round(x * 7 + y * 3);
  const faces = southFace(g, s, o, fh, C.stoneFront, 'rgba(30, 40, 24, 0.3)');
  clipTo(g, faces, () => {
    for (const q of faces) ashlar(g, q, 8, seed + 3, true);
    g.fillStyle = hexA(C.moss, 0.55);
    for (const q of faces) for (let mx = q.x + 4; mx < q.x + q.w; mx += 14 + hash(seed, mx) * 30) { g.beginPath(); g.ellipse(mx, q.y + fh, 6 + hash(seed, mx, 2) * 8, 4, 0, 0, TAU); g.fill(); }
  });
  faceInk(g, faces);
  g.fillStyle = C.stone; g.fillRect(x, y, w, h);
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  ashlar(g, s, 25, seed, w >= h);
  // a little moss and lichen on the tops
  for (let i = 0; i < Math.max(1, (w * h) / 2500); i++) {
    const mx = x + hash(seed, i, 1) * w, my = y + hash(seed, i, 2) * h;
    g.fillStyle = hash(seed, i, 3) < 0.6 ? hexA(C.moss, 0.4) : 'rgba(200, 190, 120, 0.3)';
    g.beginPath(); g.ellipse(mx, my, 4 + hash(seed, i, 4) * 6, 3 + hash(seed, i, 5) * 3, hash(seed, i, 6) * 3, 0, TAU); g.fill();
  }
  g.restore();
  if (trough) {
    // the horse trough: water inside a stone rim, a spout at one end
    g.fillStyle = C.waterLo; g.fillRect(x + 8, y + 8, w - 16, h - 16);
    g.fillStyle = 'rgba(160, 210, 220, 0.3)'; g.fillRect(x + 12, y + 11, w - 40, 4);
    g.strokeStyle = C.ink; g.lineWidth = 1.6; g.strokeRect(x + 8, y + 8, w - 16, h - 16);
    g.fillStyle = C.iron; g.fillRect(x + w - 14, y + h / 2 - 4, 12, 8);
  }
  celBands(g, s, o);
  outlineOpen(g, s, o);
}

/* ------------------------------------------------------------ furniture */

type Ctx = { room: string | null; twin: boolean };
const ctxOf = (s: Rect): Ctx => { const id = roofAt(s.x + s.w / 2, s.y + s.h / 2); return { room: id ? baseId(id) : null, twin: isTwin(id ?? undefined) }; };

function slab(g: G, s: Rect, top: string, front: string, fh: number = OLDTOWN_FACE.otfurn, r = 4) {
  g.fillStyle = 'rgba(14, 16, 24, 0.3)'; g.beginPath(); g.roundRect(s.x + 3, s.y + 5, s.w, s.h + fh, r); g.fill();
  g.fillStyle = front; g.beginPath(); g.roundRect(s.x, s.y + fh * 0.4, s.w, s.h + fh * 0.6, r); g.fill();
  g.strokeStyle = C.ink; g.lineWidth = 2; g.stroke();
  g.fillStyle = top; g.beginPath(); g.roundRect(s.x, s.y, s.w, s.h, r); g.fill(); g.stroke();
  g.fillStyle = 'rgba(255, 244, 214, 0.18)'; g.fillRect(s.x + 3, s.y + 2, s.w - 6, 3);
}

function planks(g: G, s: Rect, horiz: boolean, color = 'rgba(30, 18, 8, 0.35)') {
  g.strokeStyle = color; g.lineWidth = 1.5; g.beginPath();
  if (horiz) for (let yy = s.y + 10; yy < s.y + s.h - 2; yy += 10) { g.moveTo(s.x + 3, yy); g.lineTo(s.x + s.w - 3, yy); }
  else for (let xx = s.x + 10; xx < s.x + s.w - 2; xx += 10) { g.moveTo(xx, s.y + 3); g.lineTo(xx, s.y + s.h - 3); }
  g.stroke();
}

function bed(g: G, s: Rect, seed: number) {
  const horiz = s.w > s.h;
  slab(g, s, C.oakLo, C.beamLo);
  const quilt = [C.wool, C.woolBlue, C.woolGreen, C.woolGold][Math.floor(hash(seed, 1) * 4)]!;
  const inset = { x: s.x + 6, y: s.y + 6, w: s.w - 12, h: s.h - 12 };
  g.fillStyle = C.linen; g.beginPath(); g.roundRect(inset.x, inset.y, inset.w, inset.h, 6); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 1.6; g.stroke();
  // the quilt over two thirds of it, in patchwork, and a pillow at the head (by the wall)
  const q = horiz ? { x: inset.x + inset.w * 0.33, y: inset.y, w: inset.w * 0.67, h: inset.h } : { x: inset.x, y: inset.y + inset.h * 0.33, w: inset.w, h: inset.h * 0.67 };
  g.fillStyle = quilt; g.beginPath(); g.roundRect(q.x, q.y, q.w, q.h, 5); g.fill(); g.stroke();
  g.fillStyle = 'rgba(255, 244, 214, 0.22)';
  for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) if ((i + j) % 2 === 0) g.fillRect(q.x + (i * q.w) / 6, q.y + (j * q.h) / 6, q.w / 6, q.h / 6);
  const p = horiz ? { x: inset.x + 6, y: inset.y + inset.h / 2 - 18, w: 26, h: 36 } : { x: inset.x + inset.w / 2 - 18, y: inset.y + 6, w: 36, h: 26 };
  g.fillStyle = '#f4efe2'; g.beginPath(); g.roundRect(p.x, p.y, p.w, p.h, 8); g.fill(); g.stroke();
}

function table(g: G, s: Rect, seed: number, outdoor: boolean) {
  slab(g, s, outdoor ? C.pine : C.oak, outdoor ? C.pineLo : C.oakLo, 8, 6);
  planks(g, s, s.w < s.h, 'rgba(30, 18, 8, 0.25)');
  // what is on it: tankards and plates, a candle, bread
  const n = Math.max(2, Math.round((s.w * s.h) / 2500));
  for (let i = 0; i < n; i++) {
    const px = s.x + 12 + hash(seed, i, 2) * (s.w - 24), py = s.y + 12 + hash(seed, i, 3) * (s.h - 24);
    const k = hash(seed, i, 4);
    if (k < 0.4) { g.fillStyle = '#d9d2c0'; g.beginPath(); g.arc(px, py, 7, 0, TAU); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 1.2; g.stroke(); g.fillStyle = C.bread; g.beginPath(); g.arc(px, py, 3.4, 0, TAU); g.fill(); }
    else if (k < 0.8) { g.fillStyle = '#8a8f98'; g.beginPath(); g.arc(px, py, 5, 0, TAU); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 1.2; g.stroke(); g.fillStyle = '#f2e6c4'; g.beginPath(); g.arc(px, py, 3, 0, TAU); g.fill(); }
    else { g.fillStyle = '#efe6cf'; g.fillRect(px - 2, py - 2, 4, 4); g.fillStyle = C.lampHot; g.beginPath(); g.arc(px, py - 3, 2, 0, TAU); g.fill(); }
  }
}

function shelf(g: G, s: Rect, seed: number, goods: 'bread' | 'jars' | 'books' | 'bottles' | 'cloth' | 'letters' | 'tools') {
  slab(g, s, C.oakLo, C.beamLo, 10, 2);
  const horiz = s.w >= s.h, len = horiz ? s.w : s.h;
  for (let a = 6, i = 0; a < len - 8; i++) {
    const k = hash(seed, i, 5), sz = goods === 'bread' ? 13 : goods === 'books' ? 7 : goods === 'cloth' ? 16 : 9;
    const cx = horiz ? s.x + a + sz / 2 : s.x + s.w / 2, cy = horiz ? s.y + s.h / 2 : s.y + a + sz / 2;
    g.strokeStyle = C.ink; g.lineWidth = 1.2;
    if (goods === 'bread') { g.fillStyle = k < 0.5 ? C.bread : C.breadHi; g.beginPath(); g.ellipse(cx, cy, 6.5, 9, horiz ? 0 : Math.PI / 2, 0, TAU); g.fill(); g.stroke(); g.strokeStyle = 'rgba(80, 40, 10, 0.6)'; g.beginPath(); g.moveTo(cx - 3, cy - 3); g.lineTo(cx + 3, cy + 3); g.stroke(); }
    else if (goods === 'jars') { g.fillStyle = ['#6a9a84', '#b4524a', '#c9a23c', '#4a6a8e', '#d9d2c0'][Math.floor(k * 5)]!; g.beginPath(); g.arc(cx, cy, 4.5, 0, TAU); g.fill(); g.stroke(); g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(cx - 2, cy - 3, 2, 2); }
    else if (goods === 'books') { g.fillStyle = ['#7a2f2a', '#2f4a6a', '#4a5a2f', '#6a4a2a', '#5a2a4a'][Math.floor(k * 5)]!; if (horiz) g.fillRect(cx - 3, s.y + 6, 6, s.h - 12); else g.fillRect(s.x + 6, cy - 3, s.w - 12, 6); }
    else if (goods === 'bottles') { g.fillStyle = k < 0.5 ? '#3f6a4a' : '#6a3a2a'; g.beginPath(); g.arc(cx, cy, 4, 0, TAU); g.fill(); g.stroke(); }
    else if (goods === 'cloth') { g.fillStyle = [C.wool, C.woolBlue, C.woolGreen, C.woolGold, C.linen][Math.floor(k * 5)]!; g.beginPath(); g.roundRect(cx - 7, cy - 7, 14, 14, 3); g.fill(); g.stroke(); }
    else if (goods === 'letters') { g.fillStyle = k < 0.6 ? '#efe6cf' : '#d9c28a'; g.fillRect(cx - 5, cy - 4, 10, 8); g.strokeRect(cx - 5, cy - 4, 10, 8); g.fillStyle = '#9a3a2a'; g.fillRect(cx - 1.5, cy - 1.5, 3, 3); }
    else { g.fillStyle = C.iron; g.fillRect(cx - 2, cy - 7, 4, 14); g.fillStyle = C.oakHi; g.fillRect(cx - 2, cy + 2, 4, 6); }
    a += sz + 3;
  }
}

function barrels(g: G, s: Rect, seed: number) {
  // a stack of casks lying in a rack: round ends showing, hoops and bungs
  slab(g, s, '#5f4a30', C.beamLo, 8, 3);
  const r = 11;
  for (let yy = s.y + r + 3; yy < s.y + s.h - r + 2; yy += r * 2 + 1) for (let xx = s.x + r + 3; xx < s.x + s.w - r + 2; xx += r * 2 + 1) {
    g.fillStyle = hash(seed, xx, yy) < 0.5 ? C.oak : C.oakHi; g.beginPath(); g.arc(xx, yy, r, 0, TAU); g.fill();
    g.strokeStyle = C.iron; g.lineWidth = 2.4; g.beginPath(); g.arc(xx, yy, r - 2, 0, TAU); g.stroke();
    g.strokeStyle = C.ink; g.lineWidth = 1.4; g.beginPath(); g.arc(xx, yy, r, 0, TAU); g.stroke();
    g.fillStyle = C.beamLo; g.beginPath(); g.arc(xx + 3, yy - 2, 2, 0, TAU); g.fill();
  }
}

function tub(g: G, s: Rect, seed: number) {
  // a wooden wash tub (or a copper bath on the other side), suds on the water
  slab(g, s, '#6a6058', '#3f3a34', 8, 6);
  const cx = s.x + s.w / 2, cy = s.y + s.h / 2, r = Math.min(s.w, s.h) / 2 - 6;
  g.fillStyle = C.oak; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 2; g.stroke();
  g.strokeStyle = C.iron; g.lineWidth = 2.4; g.beginPath(); g.arc(cx, cy, r - 2, 0, TAU); g.stroke();
  g.fillStyle = '#7fa9b4'; g.beginPath(); g.arc(cx, cy, r - 6, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255, 255, 255, 0.75)';
  for (let i = 0; i < 9; i++) { const a = hash(seed, i) * TAU, d = hash(seed, i, 2) * (r - 10); g.beginPath(); g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 3 + hash(seed, i, 3) * 4, 0, TAU); g.fill(); }
}

function linens(g: G, s: Rect, seed: number) {
  table(g, s, seed, false);
  for (let i = 0; i < 3; i++) { const px = s.x + 8 + i * ((s.w - 16) / 3), col = [C.linen, '#d8e2ea', '#efe0d0'][i]!; g.fillStyle = col; g.beginPath(); g.roundRect(px, s.y + 8, (s.w - 16) / 3 - 4, s.h - 16, 3); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 1.2; g.stroke(); }
}

function horseStall(g: G, s: Rect, seed: number) {
  // a stall partition: a low plank wall with hay heaped against it and a bucket
  slab(g, s, C.oakLo, C.beamLo, 10, 2);
  planks(g, s, s.w < s.h, 'rgba(20, 12, 4, 0.45)');
  g.fillStyle = '#d0b060';
  for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(s.x + hash(seed, i) * s.w, s.y + s.h + 8 + hash(seed, i, 2) * 8, 10, 5, 0, 0, TAU); g.fill(); }
}

/** Does a long piece stand with its long side against a wall (a shelf) rather than out in the room (a counter)? */
function againstWall(s: Rect): boolean {
  const solid = (x: number, y: number) => insideWall('otwall', x, y) || insideWall('otstone', x, y);
  return s.w >= s.h ? solid(s.x + s.w / 2, s.y - 10) || solid(s.x + s.w / 2, s.y + s.h + 10) : solid(s.x - 10, s.y + s.h / 2) || solid(s.x + s.w + 10, s.y + s.h / 2);
}

function counter(g: G, s: Rect, seed: number, room: string | null, twin: boolean) {
  slab(g, s, room === 'tavern' ? '#6a3f22' : C.oak, C.beamLo, 10, 3);
  planks(g, s, s.w < s.h, 'rgba(30, 18, 8, 0.3)');
  const horiz = s.w >= s.h, len = horiz ? s.w : s.h;
  for (let a = 14, i = 0; a < len - 10; a += 26 + hash(seed, i) * 20, i++) {
    const cx = horiz ? s.x + a : s.x + s.w / 2, cy = horiz ? s.y + s.h / 2 : s.y + a;
    if (room === 'tavern') { disc(g, cx, cy, 6, '#c9a24a', 1.4); g.fillStyle = '#f6eed6'; g.beginPath(); g.arc(cx, cy, 3.6, 0, TAU); g.fill(); }
    else if (room === 'bakery' && !twin) { g.fillStyle = C.breadHi; g.beginPath(); g.ellipse(cx, cy, 9, 6, 0.3, 0, TAU); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 1.2; g.stroke(); }
    else if (room === 'bakery') { g.fillStyle = '#c86a5a'; g.beginPath(); g.ellipse(cx, cy, 9, 6, 0.3, 0, TAU); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 1.2; g.stroke(); g.fillStyle = '#efd8c8'; g.beginPath(); g.arc(cx + 3, cy, 2, 0, TAU); g.fill(); }
    else if (room === 'posthouse') { g.fillStyle = '#efe6cf'; g.fillRect(cx - 6, cy - 4, 12, 8); g.strokeStyle = C.ink; g.lineWidth = 1.2; g.strokeRect(cx - 6, cy - 4, 12, 8); }
    else if (room === 'apothecary') { disc(g, cx, cy, 4.5, ['#6a9a84', '#b4524a', '#c9a23c'][i % 3]!, 1.2); }
    else { g.fillStyle = '#d9d2c0'; g.beginPath(); g.arc(cx, cy, 5, 0, TAU); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 1.2; g.stroke(); }
  }
}

function disc(g: G, x: number, y: number, r: number, fill: string, lw: number) { g.fillStyle = fill; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.strokeStyle = C.ink; g.lineWidth = lw; g.stroke(); }

/** Benches and a trestle in the beer garden; every other outdoor piece of furniture is a market table. */
function beerBench(g: G, s: Rect, seed: number) {
  g.fillStyle = 'rgba(14, 16, 24, 0.28)'; g.fillRect(s.x + 3, s.y - 14, s.w, s.h + 34);
  for (const by of [s.y - 16, s.y + s.h + 6]) { g.fillStyle = C.pineLo; g.fillRect(s.x + 4, by, s.w - 8, 10); g.strokeStyle = C.ink; g.lineWidth = 1.6; g.strokeRect(s.x + 4, by, s.w - 8, 10); }
  table(g, s, seed, true);
}

function otfurn(g: G, s: Solid) {
  const { room, twin } = ctxOf(s);
  const seed = Math.round(s.x * 3 + s.y * 5);
  const cw = Math.round(s.w / 50), ch = Math.round(s.h / 50), big = Math.max(cw, ch), small = Math.min(cw, ch);
  if (!room) { beerBench(g, s, seed); return; }
  if (room === 'laundry') { if (cw === 2 && ch === 2) tub(g, s, seed); else if (small === 1 && big >= 3) shelf(g, s, seed, twin ? 'bottles' : 'cloth'); else linens(g, s, seed); return; }
  if (room === 'cooper') { if (twin && small === 1) shelf(g, s, seed, 'tools'); else if (small === 1) counter(g, s, seed, room, twin); else barrels(g, s, seed); return; }
  if (room === 'stable') { horseStall(g, s, seed); return; }
  if (small === 1 && big >= 3) {
    if (room === 'tavern' || room === 'bakery' || room === 'posthouse' || room === 'apothecary') {
      // the long pieces along a room's middle are counters; those against a wall are shelves
      if (againstWall(s)) shelf(g, s, seed, room === 'bakery' ? (twin ? 'tools' : 'bread') : 'jars'); else counter(g, s, seed, room, twin);
      return;
    }
    shelf(g, s, seed, room === 'weaver' || room === 'clothhall' ? 'cloth' : room === 'guild' || room === 'counting' || room === 'merchant' ? 'books' : room === 'cafe' ? 'jars' : hash(seed, 3) < 0.5 ? 'books' : 'bottles');
    return;
  }
  if (small === 2 && big === 3) { bed(g, s, seed); return; }
  if (small === 1) { // chests and cupboards
    slab(g, s, C.oakLo, C.beamLo, 10, 3);
    g.strokeStyle = C.iron; g.lineWidth = 3; g.beginPath();
    if (s.w >= s.h) { g.moveTo(s.x + 12, s.y + 3); g.lineTo(s.x + 12, s.y + s.h - 3); g.moveTo(s.x + s.w - 12, s.y + 3); g.lineTo(s.x + s.w - 12, s.y + s.h - 3); }
    else { g.moveTo(s.x + 3, s.y + 12); g.lineTo(s.x + s.w - 3, s.y + 12); g.moveTo(s.x + 3, s.y + s.h - 12); g.lineTo(s.x + s.w - 3, s.y + s.h - 12); }
    g.stroke(); g.fillStyle = C.brass; g.fillRect(s.x + s.w / 2 - 3, s.y + s.h / 2 - 3, 6, 6);
    return;
  }
  table(g, s, seed, false);
}

/* ------------------------------------------------------------ stalls, fences, benches */

function awningStall(g: G, s: Rect, seed: number, colour: string) {
  // the counter, goods on its front half, and a striped awning over the back half with a scalloped hem
  slab(g, s, C.pine, C.pineLo, 10, 3);
  const horiz = s.w >= s.h;
  const goods = [['#c9a23c', '#b4524a', '#6a8a4a'], ['#e0a860', '#c88a4a', '#efe6cf'], ['#9a3a5a', '#6a3a7a', '#c9a23c']][Math.floor(hash(seed, 9) * 3)]!;
  for (let i = 0; i < 14; i++) {
    const px = s.x + 8 + hash(seed, i, 1) * (s.w - 16), py = horiz ? s.y + s.h * 0.55 + hash(seed, i, 2) * s.h * 0.35 : s.y + 8 + hash(seed, i, 2) * (s.h - 16);
    if (!horiz && px < s.x + s.w * 0.5) continue;
    disc(g, px, py, 4 + hash(seed, i, 3) * 2, goods[i % 3]!, 1);
  }
  const a = horiz ? { x: s.x - 6, y: s.y - 10, w: s.w + 12, h: s.h * 0.55 + 10 } : { x: s.x - 10, y: s.y - 6, w: s.w * 0.5 + 10, h: s.h + 12 };
  g.fillStyle = 'rgba(14, 16, 24, 0.3)'; g.fillRect(a.x + 4, a.y + 6, a.w, a.h);
  g.fillStyle = '#efe6cf'; g.fillRect(a.x, a.y, a.w, a.h);
  g.fillStyle = colour;
  if (horiz) for (let xx = a.x; xx < a.x + a.w; xx += 24) g.fillRect(xx, a.y, 12, a.h);
  else for (let yy = a.y; yy < a.y + a.h; yy += 24) g.fillRect(a.x, yy, a.w, 12);
  // scalloped hem along the front edge
  g.fillStyle = colour;
  if (horiz) for (let xx = a.x + 6; xx < a.x + a.w; xx += 12) { g.beginPath(); g.arc(xx, a.y + a.h, 6, 0, Math.PI); g.fill(); }
  else for (let yy = a.y + 6; yy < a.y + a.h; yy += 12) { g.beginPath(); g.arc(a.x + a.w, yy, 6, -Math.PI / 2, Math.PI / 2); g.fill(); }
  g.fillStyle = 'rgba(255, 244, 214, 0.2)'; g.fillRect(a.x, a.y, a.w, 3);
  g.strokeStyle = C.ink; g.lineWidth = 2; g.strokeRect(a.x, a.y, a.w, a.h);
}

function fishStall(g: G, s: Rect, seed: number) {
  slab(g, s, '#8a8f98', '#4f5560', 10, 3);
  for (let i = 0; i < Math.floor((s.w * s.h) / 260); i++) {
    const px = s.x + 8 + hash(seed, i) * (s.w - 16), py = s.y + 8 + hash(seed, i, 2) * (s.h - 16);
    g.fillStyle = 'rgba(220, 240, 250, 0.7)'; g.fillRect(px - 4, py - 4, 8, 8);
  }
  for (let i = 0; i < Math.floor((s.w * s.h) / 520); i++) {
    const px = s.x + 12 + hash(seed, i, 4) * (s.w - 24), py = s.y + 10 + hash(seed, i, 5) * (s.h - 20), a = hash(seed, i, 6) * TAU;
    g.save(); g.translate(px, py); g.rotate(a);
    g.fillStyle = hash(seed, i, 7) < 0.5 ? '#a8b4bd' : '#c9b49a'; g.beginPath(); g.ellipse(0, 0, 11, 4, 0, 0, TAU); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 1.2; g.stroke();
    g.beginPath(); g.moveTo(10, 0); g.lineTo(16, -4); g.lineTo(16, 4); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = C.ink; g.beginPath(); g.arc(-7, -1, 1, 0, TAU); g.fill();
    g.restore();
  }
}

function fence(g: G, s: Rect, seed: number) {
  // a picket fence with a planted box along its inner side: geraniums
  const horiz = s.w >= s.h;
  g.fillStyle = 'rgba(14, 16, 24, 0.28)'; g.fillRect(s.x + 3, s.y + 6, s.w, s.h);
  const box = horiz ? { x: s.x + 2, y: s.y + 14, w: s.w - 4, h: s.h - 22 } : { x: s.x + 14, y: s.y + 2, w: s.w - 22, h: s.h - 4 };
  g.fillStyle = C.oakLo; g.fillRect(box.x, box.y, box.w, box.h); g.strokeStyle = C.ink; g.lineWidth = 1.6; g.strokeRect(box.x, box.y, box.w, box.h);
  g.fillStyle = '#3f2e1e'; g.fillRect(box.x + 3, box.y + 3, box.w - 6, box.h - 6);
  for (let i = 0; i < (horiz ? s.w : s.h) / 9; i++) {
    const px = horiz ? box.x + 6 + i * 9 : box.x + box.w / 2 + (hash(seed, i) - 0.5) * 8, py = horiz ? box.y + box.h / 2 + (hash(seed, i) - 0.5) * 8 : box.y + 6 + i * 9;
    g.fillStyle = i % 3 === 0 ? C.grassLo : C.grassHi; g.beginPath(); g.arc(px, py, 5, 0, TAU); g.fill();
    if (hash(seed, i, 3) < 0.45) { g.fillStyle = hash(seed, i, 4) < 0.6 ? '#d9443a' : '#f0e6d0'; g.beginPath(); g.arc(px + 1, py - 1, 2.6, 0, TAU); g.fill(); }
  }
  // the pickets and rail
  g.fillStyle = '#d8ccb0';
  if (horiz) { g.fillRect(s.x, s.y + 4, s.w, 5); for (let xx = s.x + 3; xx < s.x + s.w; xx += 10) { g.fillRect(xx, s.y, 6, 13); } }
  else { g.fillRect(s.x + 4, s.y, 5, s.h); for (let yy = s.y + 3; yy < s.y + s.h; yy += 10) { g.fillRect(s.x, yy, 13, 6); } }
  g.strokeStyle = C.ink; g.lineWidth = 1.4; g.beginPath();
  if (horiz) { g.moveTo(s.x, s.y); g.lineTo(s.x + s.w, s.y); g.moveTo(s.x, s.y + 13); g.lineTo(s.x + s.w, s.y + 13); } else { g.moveTo(s.x, s.y); g.lineTo(s.x, s.y + s.h); g.moveTo(s.x + 13, s.y); g.lineTo(s.x + 13, s.y + s.h); }
  g.stroke();
}

/** A park bench: slatted seat, iron ends, a backrest along its north side. */
function bench(g: G, s: Rect) {
  g.fillStyle = 'rgba(14, 16, 24, 0.28)'; g.fillRect(s.x + 4, s.y + 8, s.w, s.h);
  g.fillStyle = C.pine; g.fillRect(s.x + 2, s.y + 14, s.w - 4, s.h - 18);
  g.strokeStyle = 'rgba(40, 24, 10, 0.5)'; g.lineWidth = 1.5; g.beginPath();
  for (let yy = s.y + 22; yy < s.y + s.h - 4; yy += 8) { g.moveTo(s.x + 4, yy); g.lineTo(s.x + s.w - 4, yy); }
  g.stroke();
  g.strokeStyle = C.ink; g.lineWidth = 1.8; g.strokeRect(s.x + 2, s.y + 14, s.w - 4, s.h - 18);
  g.fillStyle = C.pineLo; g.fillRect(s.x + 2, s.y + 4, s.w - 4, 9); g.strokeRect(s.x + 2, s.y + 4, s.w - 4, 9);
  g.fillStyle = C.iron; for (const ex of [s.x, s.x + s.w - 7]) { g.fillRect(ex, s.y + 2, 7, s.h - 4); g.strokeRect(ex, s.y + 2, 7, s.h - 4); }
}

const AWNINGS = [C.awnRed, C.awnGreen, C.awnBlue, C.awnGold] as const;
function otstall(g: G, s: Solid) {
  const seed = Math.round(s.x * 5 + s.y * 3);
  const at = yardAt(s.x + s.w / 2, s.y + s.h / 2);
  if (at?.yard.id === 'beergarden') { fence(g, s, seed); return; }
  if (at?.yard.id === 'quay') { fishStall(g, s, seed); return; }
  if (at?.yard.id === 'wellcourt') { bench(g, s); return; }
  awningStall(g, s, seed, AWNINGS[Math.floor(hash(seed, 1) * AWNINGS.length)]!);
}

export const OLDTOWN_WALLS: Partial<Record<SolidKind, (ctx: CanvasRenderingContext2D, s: Solid) => void>> = { otwall, otstone, otfurn, otstall };
