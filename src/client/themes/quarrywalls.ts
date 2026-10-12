import type { Solid, SolidKind } from '../tilt.ts';
import { C, CEL, TAU, hash, hazard, openSides, text, type Open } from './quarrykit.ts';

/**
 * The Quarry's five rect walls, each painted whole into its sprite: rock ledge (blasted limestone, strata and scree), cut stone
 * blocks (sawn faces, half drill holes along the splits, a spray-painted lot number), steel plant (hi-vis yellow machinery with
 * walkways and hazard edges), portacabin walls (white ribbed sheet with a blue band and windows) and the corrugated steel shed.
 * The ink outline sits only on edges that meet open air.
 */
type G = CanvasRenderingContext2D;
type Rect = { x: number; y: number; w: number; h: number };

export const QUARRY_FACE = { qledge: 18, qblock: 16, qplant: 18, qcabin: 16, qshed: 18 } as const;

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
/** Ink along the open stretches of the outline only, so joined runs of one material read as one mass. */
function outlineOpen(g: G, s: Rect, o: Open, width = 2) {
  g.strokeStyle = C.ink; g.lineWidth = width; g.lineCap = 'square';
  g.beginPath();
  for (const [a, b] of o.spans.n) { g.moveTo(s.x + a, s.y); g.lineTo(s.x + b, s.y); }
  for (const [a, b] of o.spans.s) { g.moveTo(s.x + a, s.y + s.h); g.lineTo(s.x + b, s.y + s.h); }
  for (const [a, b] of o.spans.w) { g.moveTo(s.x, s.y + a); g.lineTo(s.x, s.y + b); }
  for (const [a, b] of o.spans.e) { g.moveTo(s.x + s.w, s.y + a); g.lineTo(s.x + s.w, s.y + b); }
  g.stroke();
}
/** A front-face rect over each open stretch of the south edge, with its ink sides and base line. */
function southFace(g: G, s: Rect, o: Open, fh: number, fill: string, low: string): Rect[] {
  const list = o.spans.s.map(([a, b]) => ({ x: s.x + a, y: s.y + s.h, w: b - a, h: fh }));
  g.fillStyle = fill; rects(g, list); g.fill();
  g.fillStyle = 'rgba(255, 248, 228, 0.12)'; rects(g, list.map((q) => ({ ...q, h: 2 }))); g.fill();
  g.fillStyle = low; rects(g, list.map((q) => ({ ...q, y: q.y + fh * 0.62, h: fh * 0.38 }))); g.fill();
  g.strokeStyle = C.ink; g.lineWidth = 2; g.lineJoin = 'miter';
  g.beginPath();
  for (const q of list) { g.moveTo(q.x, q.y); g.lineTo(q.x, q.y + fh); g.lineTo(q.x + q.w, q.y + fh); g.lineTo(q.x + q.w, q.y); }
  g.stroke();
  return list;
}
const clipTo = (g: G, list: readonly Rect[], paint: () => void) => { g.save(); rects(g, list); g.clip(); paint(); g.restore(); };

/* ------------------------------------------------------------------ rock ledge */

/** Blasted limestone left standing: faceted boulders on top, strata banding, a fractured face and scree at its foot. */
function qledge(g: G, s: Solid) {
  const o = openSides('qledge', s), fh = QUARRY_FACE.qledge;
  const { x, y, w, h } = s, seed = Math.round(x * 7 + y * 3);
  const faces = southFace(g, s, o, fh, C.rockLo, 'rgba(20, 16, 12, 0.35)');
  clipTo(g, faces, () => {
    g.strokeStyle = 'rgba(20, 16, 12, 0.5)'; g.lineWidth = 1.6; g.lineCap = 'round';
    for (const q of faces) {
      for (let cx = q.x + 6 + hash(seed, q.x) * 14; cx < q.x + q.w - 4; cx += 14 + hash(seed, cx) * 20) { g.beginPath(); g.moveTo(cx, q.y); g.lineTo(cx + (hash(seed, cx, 2) - 0.5) * 8, q.y + fh); g.stroke(); }
      g.fillStyle = 'rgba(200, 192, 170, 0.14)'; g.fillRect(q.x, q.y + fh * 0.3, q.w, 2);
    }
  });
  g.fillStyle = C.rock; g.fillRect(x, y, w, h);
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  // strata running along the long axis
  const horiz = w >= h;
  g.fillStyle = 'rgba(70, 64, 54, 0.22)';
  for (let k = 0; k < (horiz ? h : w); k += 9 + hash(seed, k) * 8) { if (horiz) g.fillRect(x, y + k, w, 2.5); else g.fillRect(x + k, y, 2.5, h); }
  // boulders: faceted polygons, lit on the north-west
  const n = Math.max(3, Math.round((w * h) / 700));
  for (let i = 0; i < n; i++) {
    const cx = x + hash(seed, i, 1) * w, cy = y + hash(seed, i, 2) * h, r = 9 + hash(seed, i, 3) * 13, k = 5 + Math.floor(hash(seed, i, 4) * 3);
    const pts: [number, number][] = [];
    for (let j = 0; j < k; j++) { const a = (j / k) * TAU + hash(seed, i, j + 5) * 0.6, q = r * (0.75 + hash(seed, i, j + 9) * 0.35); pts.push([cx + Math.cos(a) * q, cy + Math.sin(a) * q * 0.85]); }
    g.fillStyle = hash(seed, i, 20) < 0.5 ? C.rockHi : C.rock;
    g.beginPath(); pts.forEach(([px, py], j) => (j ? g.lineTo(px, py) : g.moveTo(px, py))); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(28, 31, 38, 0.6)'; g.lineWidth = 1.4; g.stroke();
    g.fillStyle = 'rgba(255, 248, 228, 0.22)'; g.beginPath(); g.moveTo(pts[0]![0], pts[0]![1]); g.lineTo(cx, cy); g.lineTo(pts[pts.length - 1]![0], pts[pts.length - 1]![1]); g.closePath(); g.fill();
  }
  // a weed or two in the cracks, and the rain pooling in a hollow
  for (let i = 0; i < Math.round((w + h) / 120); i++) {
    g.fillStyle = hash(seed, i, 30) < 0.5 ? C.grass : C.grassHi;
    g.beginPath(); g.arc(x + 6 + hash(seed, i, 31) * (w - 12), y + 6 + hash(seed, i, 32) * (h - 12), 3 + hash(seed, i, 33) * 2, 0, TAU); g.fill();
  }
  celBands(g, s, o, 4);
  g.restore();
  outlineOpen(g, s, o);
  // scree at the foot
  for (const [a, b] of o.spans.s) {
    for (let i = 0; i < Math.round((b - a) / 40); i++) {
      const cx = x + a + 4 + hash(seed, i, 40) * (b - a - 8), cy = y + h + fh - 3 + hash(seed, i, 41) * 4, r = 2.5 + hash(seed, i, 42) * 3;
      g.fillStyle = hash(seed, i, 43) < 0.5 ? C.rockHi : C.rockLo;
      g.beginPath(); g.moveTo(cx - r, cy + r * 0.5); g.lineTo(cx - r * 0.3, cy - r); g.lineTo(cx + r, cy - r * 0.2); g.lineTo(cx + r * 0.7, cy + r * 0.6); g.closePath(); g.fill();
      g.strokeStyle = C.ink; g.lineWidth = 1.2; g.stroke();
    }
  }
}

/* ------------------------------------------------------------------ cut stone block */

/** A sawn block of limestone: each wall rect is one block, numbered in spray paint, with half drill holes where it was split. */
function qblock(g: G, s: Solid) {
  const o = openSides('qblock', s), fh = QUARRY_FACE.qblock;
  const { x, y, w, h } = s, seed = Math.round(x * 5 + y * 11);
  const tint = hash(seed, 1);
  const top = tint < 0.33 ? C.lime : tint < 0.66 ? C.sawn : '#d0c8b2';
  const faces = southFace(g, s, o, fh, C.limeDeep, 'rgba(40, 34, 24, 0.28)');
  clipTo(g, faces, () => {
    // half drill holes running down the split face
    for (const q of faces) {
      for (let cx = q.x + 7; cx < q.x + q.w - 4; cx += 11) {
        g.fillStyle = 'rgba(50, 44, 32, 0.45)'; g.fillRect(cx - 2, q.y + 2, 4, fh - 4);
        g.fillStyle = 'rgba(255, 250, 230, 0.3)'; g.fillRect(cx + 2, q.y + 2, 1.4, fh - 4);
      }
    }
  });
  g.fillStyle = top; g.fillRect(x, y, w, h);
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  // the wire saw's fine parallel marks, across the short axis
  g.strokeStyle = 'rgba(120, 110, 86, 0.22)'; g.lineWidth = 1;
  g.beginPath();
  if (w >= h) for (let k = x + 3; k < x + w; k += 4 + hash(seed, k) * 3) { g.moveTo(k, y); g.lineTo(k + 3, y + h); }
  else for (let k = y + 3; k < y + h; k += 4 + hash(seed, k) * 3) { g.moveTo(x, k); g.lineTo(x + w, k + 3); }
  g.stroke();
  // fossil-grey veins and a few pits
  g.strokeStyle = 'rgba(110, 100, 80, 0.35)'; g.lineWidth = 1.4;
  for (let i = 0; i < 2; i++) { g.beginPath(); let px = x + hash(seed, i, 3) * w, py = y; g.moveTo(px, py); for (let k = 0; k < 4; k++) { px += (hash(seed, i, k + 4) - 0.5) * 30; py += h / 4; g.lineTo(px, py); } g.stroke(); }
  g.fillStyle = 'rgba(90, 80, 60, 0.35)';
  for (let i = 0; i < (w * h) / 400; i++) g.fillRect(x + hash(seed, i, 9) * w, y + hash(seed, i, 10) * h, 2, 2);
  // half drill holes along one open edge: the line it was split from the bench
  const holes = (x0: number, y0: number, dx: number, dy: number, len: number) => {
    for (let t = 6; t < len - 4; t += 11) { g.fillStyle = 'rgba(70, 62, 44, 0.55)'; g.beginPath(); g.arc(x0 + dx * t, y0 + dy * t, 3, 0, TAU); g.fill(); }
  };
  if (o.n) holes(x, y + 1, 1, 0, w); else if (o.w) holes(x + 1, y, 0, 1, h);
  // the lot number in spray paint, and a ring of red where the next cut is marked
  if (w >= 90 && h >= 90) {
    const lot = `${['B', 'K', 'L', 'Q'][Math.floor(hash(seed, 12) * 4)]}-${100 + Math.floor(hash(seed, 13) * 900)}`;
    text(g, lot, x + w / 2, y + h / 2, Math.min(30, w * 0.24), 'rgba(40, 70, 130, 0.62)', (hash(seed, 14) - 0.5) * 0.4, 1);
    g.strokeStyle = 'rgba(184, 67, 47, 0.55)'; g.lineWidth = 3; g.setLineDash([8, 6]);
    g.beginPath(); if (w >= h) { g.moveTo(x + w * 0.72, y + 6); g.lineTo(x + w * 0.72, y + h - 6); } else { g.moveTo(x + 6, y + h * 0.72); g.lineTo(x + w - 6, y + h * 0.72); } g.stroke(); g.setLineDash([]);
  } else if (hash(seed, 15) < 0.6) {
    g.fillStyle = 'rgba(40, 70, 130, 0.55)'; g.beginPath(); g.arc(x + w * 0.5, y + h * 0.5, 5, 0, TAU); g.fill();
  }
  celBands(g, s, o, 4);
  g.restore();
  // chipped corners where it was dragged
  g.fillStyle = C.limeLo;
  if (o.n && o.w) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 7, y); g.lineTo(x, y + 6); g.closePath(); g.fill(); }
  if (o.s && o.e) { g.beginPath(); g.moveTo(x + w, y + h); g.lineTo(x + w - 8, y + h); g.lineTo(x + w, y + h - 6); g.closePath(); g.fill(); }
  outlineOpen(g, s, o);
}

/* ------------------------------------------------------------------ steel plant */

/** The jaw crusher and its kin: a hi-vis yellow steel body with a feed hopper full of rock, a grated walkway and a handrail. */
function qplant(g: G, s: Solid) {
  const o = openSides('qplant', s), fh = QUARRY_FACE.qplant;
  const { x, y, w, h } = s, seed = Math.round(x * 3 + y * 13);
  const faces = southFace(g, s, o, fh, C.hivisLo, 'rgba(30, 22, 10, 0.35)');
  clipTo(g, faces, () => {
    for (const q of faces) {
      // panel seams and a hazard kick plate along the foot
      g.fillStyle = 'rgba(30, 22, 10, 0.35)'; for (let cx = q.x + 40; cx < q.x + q.w; cx += 50) g.fillRect(cx, q.y, 2, fh);
      hazard(g, q.x, q.y + fh - 5, q.w, 5, 6, C.hivis, C.ink);
    }
  });
  g.fillStyle = C.hivis; g.fillRect(x, y, w, h);
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  // steel deck plates
  g.strokeStyle = 'rgba(80, 60, 20, 0.45)'; g.lineWidth = 1.6;
  g.beginPath(); for (let k = x + 50; k < x + w; k += 50) { g.moveTo(k, y); g.lineTo(k, y + h); } g.stroke();
  for (let px = x + 6; px < x + w; px += 25) for (let py = y + 6; py < y + h; py += 25) { g.fillStyle = 'rgba(40, 30, 10, 0.5)'; g.beginPath(); g.arc(px, py, 1.6, 0, TAU); g.fill(); }
  if (w >= 200 && h >= 150) {
    // the crusher: a hopper (a funnel of rock) over the jaw, a motor and flywheel on the side, a grated walkway round the top
    const hx = x + w * 0.12, hy = y + h * 0.12, hw = w * 0.5, hh = h * 0.62;
    g.fillStyle = C.steelLo; g.fillRect(hx, hy, hw, hh);
    g.fillStyle = C.steelDark; g.beginPath(); g.moveTo(hx + 10, hy + 10); g.lineTo(hx + hw - 10, hy + 10); g.lineTo(hx + hw * 0.62, hy + hh - 10); g.lineTo(hx + hw * 0.38, hy + hh - 10); g.closePath(); g.fill();
    for (let i = 0; i < 26; i++) {
      const rx = hx + 16 + hash(seed, i, 1) * (hw - 32), ry = hy + 14 + hash(seed, i, 2) * (hh - 34), r = 5 + hash(seed, i, 3) * 9;
      g.fillStyle = hash(seed, i, 4) < 0.5 ? C.rockHi : C.rock; g.beginPath(); g.moveTo(rx - r, ry); g.lineTo(rx - r * 0.2, ry - r * 0.9); g.lineTo(rx + r, ry - r * 0.3); g.lineTo(rx + r * 0.6, ry + r * 0.8); g.lineTo(rx - r * 0.5, ry + r * 0.7); g.closePath(); g.fill();
      g.strokeStyle = C.ink; g.lineWidth = 1.2; g.stroke();
    }
    g.strokeStyle = C.ink; g.lineWidth = 2.4; g.strokeRect(hx, hy, hw, hh);
    hazard(g, hx, hy - 8, hw, 8, 7);
    // motor housing and flywheel
    const mx = x + w * 0.7, my = y + h * 0.18;
    g.fillStyle = C.steel; g.fillRect(mx, my, w * 0.22, h * 0.3); g.strokeStyle = C.ink; g.lineWidth = 2; g.strokeRect(mx, my, w * 0.22, h * 0.3);
    g.fillStyle = 'rgba(255, 255, 255, 0.25)'; for (let k = 0; k < 5; k++) g.fillRect(mx + 4, my + 6 + k * 9, w * 0.22 - 8, 2);
    const fx = x + w * 0.8, fy = y + h * 0.7, fr = Math.min(w, h) * 0.16;
    g.fillStyle = C.steelDark; g.beginPath(); g.arc(fx, fy, fr, 0, TAU); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 2.4; g.stroke();
    g.strokeStyle = C.steelHi; g.lineWidth = 3; for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx + Math.cos(a) * fr * 0.85, fy + Math.sin(a) * fr * 0.85); g.stroke(); }
    disc(g, fx, fy, fr * 0.25, C.orange, 1.6);
    // walkway grating along the south side, with its orange handrail
    const wy = y + h - 30;
    g.fillStyle = C.steelDark; g.fillRect(x + 6, wy, w - 12, 22);
    g.strokeStyle = 'rgba(160, 170, 180, 0.5)'; g.lineWidth = 1; g.beginPath(); for (let k = x + 8; k < x + w - 8; k += 5) { g.moveTo(k, wy); g.lineTo(k, wy + 22); } g.stroke();
    g.strokeStyle = C.orange; g.lineWidth = 3; g.beginPath(); g.moveTo(x + 6, wy); g.lineTo(x + w - 6, wy); g.stroke();
    text(g, 'DANGER  MOVING JAWS', x + w * 0.37, y + h * 0.84, 15, 'rgba(28, 31, 38, 0.85)');
  } else {
    // a smaller unit: a switch cabinet with a status lamp
    g.fillStyle = C.steel; g.fillRect(x + 6, y + 6, w - 12, h - 12); g.strokeStyle = C.ink; g.lineWidth = 1.6; g.strokeRect(x + 6, y + 6, w - 12, h - 12);
    disc(g, x + w - 14, y + 14, 4, '#7fe0a0', 1.2);
  }
  celBands(g, s, o, 4);
  g.restore();
  outlineOpen(g, s, o, 2.4);
}
const disc = (g: G, x: number, y: number, r: number, fill: string, lw: number) => { g.fillStyle = fill; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.strokeStyle = C.ink; g.lineWidth = lw; g.stroke(); };

/* ------------------------------------------------------------------ portacabin */

/** A portacabin's wall: an off-white ribbed sheet capped in steel, a blue band at waist height and a window in every bay that faces south. */
function qcabin(g: G, s: Solid) {
  const o = openSides('qcabin', s), fh = QUARRY_FACE.qcabin;
  const { x, y, w, h } = s, seed = Math.round(x * 9 + y * 7);
  const faces = southFace(g, s, o, fh, C.cabinLo, 'rgba(30, 34, 40, 0.18)');
  clipTo(g, faces, () => {
    for (const q of faces) {
      g.fillStyle = 'rgba(40, 44, 50, 0.16)'; for (let cx = q.x + 3; cx < q.x + q.w; cx += 7) g.fillRect(cx, q.y, 2.4, fh);
      g.fillStyle = C.cabinBlue; g.fillRect(q.x, q.y + fh * 0.45, q.w, 3);
      for (let cx = q.x + 24; cx < q.x + q.w - 30; cx += 70) { g.fillStyle = C.glass; g.fillRect(cx, q.y + 3, 26, fh * 0.38); g.fillStyle = 'rgba(200, 225, 240, 0.4)'; g.fillRect(cx + 2, q.y + 4, 8, 3); g.strokeStyle = C.ink; g.lineWidth = 1.2; g.strokeRect(cx, q.y + 3, 26, fh * 0.38); }
    }
  });
  g.fillStyle = C.cabin; g.fillRect(x, y, w, h);
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  // ribs across the wall's top, a steel cap down its middle, corner posts at the ends
  const horiz = w >= h;
  g.fillStyle = 'rgba(60, 64, 70, 0.14)';
  if (horiz) for (let k = x + 4; k < x + w; k += 8) g.fillRect(k, y, 3, h); else for (let k = y + 4; k < y + h; k += 8) g.fillRect(x, k, w, 3);
  g.fillStyle = C.cabinHi; if (horiz) g.fillRect(x, y + h / 2 - 5, w, 10); else g.fillRect(x + w / 2 - 5, y, 10, h);
  g.fillStyle = C.cabinBlue; if (horiz) g.fillRect(x, y + h / 2 - 1.5, w, 3); else g.fillRect(x + w / 2 - 1.5, y, 3, h);
  g.fillStyle = C.steelLo;
  for (const [cx, cy] of [[x, y], [x + w - 12, y], [x, y + h - 12], [x + w - 12, y + h - 12]] as const) if ((cx === x ? o.w : o.e) || (cy === y ? o.n : o.s)) g.fillRect(cx, cy, 12, 12);
  // rust weeping from a bolt or two, and a hire company sticker
  if (hash(seed, 1) < 0.5) { g.fillStyle = 'rgba(150, 80, 40, 0.35)'; g.fillRect(x + hash(seed, 2) * (w - 6), y + hash(seed, 3) * (h - 14), 3, 14); }
  celBands(g, s, o, 4);
  g.restore();
  outlineOpen(g, s, o);
}

/* ------------------------------------------------------------------ steel shed */

/** Corrugated steel cladding in faded green on a steel portal frame, rust streaks below the joints. */
function qshed(g: G, s: Solid) {
  const o = openSides('qshed', s), fh = QUARRY_FACE.qshed;
  const { x, y, w, h } = s, seed = Math.round(x * 13 + y * 5);
  const faces = southFace(g, s, o, fh, C.shedLo, 'rgba(14, 20, 16, 0.3)');
  clipTo(g, faces, () => {
    for (const q of faces) {
      g.fillStyle = 'rgba(10, 14, 12, 0.28)'; for (let cx = q.x + 2; cx < q.x + q.w; cx += 8) g.fillRect(cx, q.y, 3.4, fh);
      g.fillStyle = 'rgba(230, 240, 230, 0.14)'; for (let cx = q.x + 5; cx < q.x + q.w; cx += 8) g.fillRect(cx, q.y, 1.4, fh);
      g.fillStyle = 'rgba(120, 60, 30, 0.45)'; for (let k = 0; k < q.w / 40; k++) g.fillRect(q.x + hash(seed, k, 1) * q.w, q.y, 2.4, 4 + hash(seed, k, 2) * (fh - 4));
    }
  });
  g.fillStyle = C.shed; g.fillRect(x, y, w, h);
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  const horiz = w >= h;
  g.fillStyle = 'rgba(10, 14, 12, 0.2)';
  if (horiz) for (let k = x + 3; k < x + w; k += 9) g.fillRect(k, y, 3.6, h); else for (let k = y + 3; k < y + h; k += 9) g.fillRect(x, k, w, 3.6);
  g.fillStyle = 'rgba(230, 240, 230, 0.14)';
  if (horiz) for (let k = x + 6; k < x + w; k += 9) g.fillRect(k, y, 1.6, h); else for (let k = y + 6; k < y + h; k += 9) g.fillRect(x, k, w, 1.6);
  // portal frame posts every 150 px
  const len = horiz ? w : h;
  for (let t = 0; t <= len; t += 150) {
    const px = horiz ? x + Math.min(t, w - 14) : x, py = horiz ? y : y + Math.min(t, h - 14);
    g.fillStyle = C.steelLo; g.fillRect(px, py, horiz ? 14 : w, horiz ? h : 14);
    g.strokeStyle = 'rgba(28, 31, 38, 0.7)'; g.lineWidth = 1.4; g.strokeRect(px, py, horiz ? 14 : w, horiz ? h : 14);
  }
  if (hash(seed, 3) < 0.6) { g.fillStyle = 'rgba(140, 70, 34, 0.32)'; g.beginPath(); g.ellipse(x + hash(seed, 4) * w, y + hash(seed, 5) * h, 16, 8, 0.4, 0, TAU); g.fill(); }
  celBands(g, s, o, 4);
  g.restore();
  outlineOpen(g, s, o);
}

export const QUARRY_WALLS: Partial<Record<SolidKind, (ctx: CanvasRenderingContext2D, s: Solid) => void>> = { qledge, qblock, qplant, qcabin, qshed };
