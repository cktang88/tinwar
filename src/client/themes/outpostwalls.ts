import type { Solid, SolidKind } from '../tilt.ts';
import { C, CEL, MID, PLACE, TAU, hash, hazard, openSides, rr, text, type Open } from './outpostkit.ts';

/**
 * The Outpost's nine rect walls, each painted whole into its sprite: HESCO barriers (wire mesh baskets of packed dirt, concertina
 * wire along the outer edge, claw marks and torn liners where the horde has been at them), sandbags, the watchtowers and the radio
 * mast, canvas tents (the mess, the barracks, the medical tent with its red cross), containers and cabins (the comms shack, the
 * checkpoint booths, the ammo container), the motor pool's trucks, supply crates, fuel bladders and drums, and the burned-out
 * wrecks outside the wire (an APC, trucks, a humvee, the crashed helicopter, the toppled tower). The ink outline sits only on
 * edges that meet open air, so joined runs of one material read as one mass.
 */
type G = CanvasRenderingContext2D;
type Rect = { x: number; y: number; w: number; h: number };

export const OUTPOST_FACE = { ophesco: 16, opbags: 12, optower: 20, optent: 14, opcont: 16, optruck: 12, opcrate: 12, opfuel: 8, opwreck: 12 } as const;

const rects = (g: G, list: readonly Rect[]) => { g.beginPath(); for (const r of list) g.rect(r.x, r.y, r.w, r.h); };
const near = (s: Rect, p: { x: number; y: number }, d: number) => Math.hypot(s.x + s.w / 2 - p.x, s.y + s.h / 2 - p.y) < d;
const seedOf = (s: Rect, k = 1) => Math.round(s.x * 7 * k + s.y * 13 + s.w * 3 + s.h);

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
  g.fillStyle = 'rgba(255, 244, 220, 0.1)'; rects(g, list.map((q) => ({ ...q, h: 2 }))); g.fill();
  g.fillStyle = low; rects(g, list.map((q) => ({ ...q, y: q.y + fh * 0.62, h: fh * 0.38 }))); g.fill();
  g.strokeStyle = C.ink; g.lineWidth = 2; g.lineJoin = 'miter';
  g.beginPath();
  for (const q of list) { g.moveTo(q.x, q.y); g.lineTo(q.x, q.y + fh); g.lineTo(q.x + q.w, q.y + fh); g.lineTo(q.x + q.w, q.y); }
  g.stroke();
  return list;
}
const clipTo = (g: G, list: readonly Rect[], paint: () => void) => { g.save(); rects(g, list); g.clip(); paint(); g.restore(); };
const clipRect = (g: G, s: Rect, paint: () => void) => { g.save(); g.beginPath(); g.rect(s.x, s.y, s.w, s.h); g.clip(); paint(); g.restore(); };
/** A whole-solid face: the front of a free-standing thing (a tent, a truck), on its full south edge. */
const wholeFace = (s: Rect): Open => ({ n: true, e: true, s: true, w: true, spans: { n: [[0, s.w]], s: [[0, s.w]], w: [[0, s.h]], e: [[0, s.h]] } });

/** Three parallel claw rakes, ragged and pale where they bit through. */
function claws(g: G, x: number, y: number, a: number, len: number) {
  g.save(); g.translate(x, y); g.rotate(a);
  for (let i = -1; i <= 1; i++) {
    g.strokeStyle = 'rgba(20, 14, 10, 0.55)'; g.lineWidth = 2.2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-len / 2, i * 5); g.quadraticCurveTo(0, i * 5 + 2, len / 2, i * 6 + 1); g.stroke();
    g.strokeStyle = 'rgba(235, 220, 190, 0.35)'; g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(-len / 2 + 2, i * 5 - 1.2); g.quadraticCurveTo(0, i * 5 + 0.8, len / 2 - 2, i * 6 - 0.2); g.stroke();
  }
  g.restore();
}
/** A dark bloody handprint smear. */
function smear(g: G, x: number, y: number, r: number, a: number) {
  g.save(); g.translate(x, y); g.rotate(a);
  g.fillStyle = 'rgba(94, 20, 20, 0.6)';
  g.beginPath(); g.ellipse(0, 0, r, r * 0.55, 0, 0, TAU); g.fill();
  g.fillStyle = 'rgba(94, 20, 20, 0.45)';
  for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(r * 0.9 + i * 2, (i - 1) * r * 0.35, r * 0.5, r * 0.12, 0.1 * (i - 1), 0, TAU); g.fill(); }
  g.restore();
}

/* ------------------------------------------------------------------ HESCO */

/**
 * HESCO bastions: square wire-mesh baskets lined with geotextile and packed with dirt, set edge to edge. Each 50 px is one basket,
 * mounded on top, its mesh grid and corner posts showing; a coil of concertina wire runs along the edge facing out from the base.
 */
function ophesco(g: G, s: Solid) {
  const o = openSides('ophesco', s, ['optower']), fh = OUTPOST_FACE.ophesco;
  const { x, y, w, h } = s, seed = seedOf(s);
  const horiz = w >= h, len = horiz ? w : h, n = Math.round(len / 50);
  const faces = southFace(g, s, o, fh, C.hescoLo, 'rgba(40, 30, 16, 0.35)');
  clipTo(g, faces, () => {
    for (const q of faces) {
      // the mesh's verticals and a band of liner showing through
      g.strokeStyle = 'rgba(50, 46, 40, 0.65)'; g.lineWidth = 1;
      g.beginPath();
      for (let cx = q.x + 5; cx < q.x + q.w; cx += 7.5) { g.moveTo(cx, q.y); g.lineTo(cx, q.y + fh); }
      g.moveTo(q.x, q.y + fh * 0.5); g.lineTo(q.x + q.w, q.y + fh * 0.5);
      g.stroke();
      g.fillStyle = 'rgba(20, 16, 10, 0.55)';
      for (let cx = q.x + 50 - ((q.x - x) % 50); cx < q.x + q.w; cx += 50) g.fillRect(cx - 1.5, q.y, 3, fh);
    }
  });
  g.fillStyle = C.hesco; g.fillRect(x, y, w, h);
  clipRect(g, s, () => {
    for (let i = 0; i < n; i++) {
      const bx = horiz ? x + i * 50 : x, by = horiz ? y : y + i * 50, bw = horiz ? 50 : w, bh = horiz ? h : 50;
      const t = hash(seed, i);
      // the dirt fill, mounded: lit north-west, a darker heart
      g.fillStyle = t < 0.33 ? C.hescoHi : t < 0.66 ? C.hesco : '#a89262';
      g.fillRect(bx + 3, by + 3, bw - 6, bh - 6);
      const grd = g.createRadialGradient(bx + bw * 0.42, by + bh * 0.4, 2, bx + bw / 2, by + bh / 2, bw * 0.6);
      grd.addColorStop(0, 'rgba(120, 100, 64, 0.0)'); grd.addColorStop(1, 'rgba(70, 56, 34, 0.35)');
      g.fillStyle = grd; g.fillRect(bx + 3, by + 3, bw - 6, bh - 6);
      // pebbles and a tuft of weed that took root
      for (let k = 0; k < 6; k++) { g.fillStyle = hash(seed, i, k) < 0.5 ? 'rgba(70, 58, 40, 0.5)' : 'rgba(220, 205, 170, 0.35)'; g.fillRect(bx + 6 + hash(seed, i, k + 9) * (bw - 12), by + 6 + hash(seed, i, k + 19) * (bh - 12), 2, 2); }
      if (hash(seed, i, 40) < 0.25) { g.fillStyle = C.scrub; g.beginPath(); g.arc(bx + 10 + hash(seed, i, 41) * (bw - 20), by + 10 + hash(seed, i, 42) * (bh - 20), 4, 0, TAU); g.fill(); }
      // the mesh: a fine grid over the liner's lip, and the basket's own frame
      g.strokeStyle = 'rgba(60, 58, 52, 0.55)'; g.lineWidth = 0.9;
      g.beginPath();
      for (let k = 7.5; k < bw; k += 7.5) { g.moveTo(bx + k, by); g.lineTo(bx + k, by + 4); g.moveTo(bx + k, by + bh - 4); g.lineTo(bx + k, by + bh); }
      for (let k = 7.5; k < bh; k += 7.5) { g.moveTo(bx, by + k); g.lineTo(bx + 4, by + k); g.moveTo(bx + bw - 4, by + k); g.lineTo(bx + bw, by + k); }
      g.stroke();
      g.strokeStyle = 'rgba(40, 38, 34, 0.8)'; g.lineWidth = 1.6; g.strokeRect(bx + 1.5, by + 1.5, bw - 3, bh - 3);
      g.fillStyle = C.mesh;
      for (const [px, py] of [[bx + 2, by + 2], [bx + bw - 2, by + 2], [bx + 2, by + bh - 2], [bx + bw - 2, by + bh - 2]] as const) g.fillRect(px - 2, py - 2, 4, 4);
      // a torn liner spilling sand, here and there
      if (hash(seed, i, 50) < 0.18) {
        g.fillStyle = 'rgba(200, 180, 130, 0.65)';
        g.beginPath(); g.ellipse(bx + bw * 0.5, by + bh * 0.5, bw * 0.25, bh * 0.18, hash(seed, i, 51) * 3, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(30, 24, 16, 0.6)'; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(bx + bw * 0.3, by + bh * 0.45); g.lineTo(bx + bw * 0.5, by + bh * 0.58); g.lineTo(bx + bw * 0.7, by + bh * 0.42); g.stroke();
      }
    }
    // concertina wire along the edge that faces out from the base, and a stencil now and then
    const cx = x + w / 2, cy = y + h / 2;
    const outward = horiz ? (cy < MID ? 'n' : 's') : (cx < MID ? 'w' : 'e');
    g.strokeStyle = 'rgba(190, 196, 200, 0.75)'; g.lineWidth = 1.1;
    const coil = (px: number, py: number) => { g.beginPath(); g.ellipse(px, py, 6, 4.5, 0.4, 0, TAU); g.stroke(); };
    for (let t = 6; t < len - 3; t += 7) {
      const px = horiz ? x + t : outward === 'w' ? x + 7 : x + w - 7, py = horiz ? (outward === 'n' ? y + 7 : y + h - 7) : y + t;
      coil(px, py);
    }
    g.fillStyle = 'rgba(30, 30, 34, 0.9)';
    for (let t = 4; t < len; t += 25) {
      const px = horiz ? x + t : outward === 'w' ? x + 7 : x + w - 7, py = horiz ? (outward === 'n' ? y + 7 : y + h - 7) : y + t;
      g.beginPath(); g.arc(px, py, 1.1, 0, TAU); g.fill();
    }
    // claw rakes and old blood on the outer face, where the horde has climbed at it
    for (let i = 0; i < n; i++) {
      if (hash(seed, i, 60) > 0.35) continue;
      const t = i * 50 + 12 + hash(seed, i, 61) * 26;
      const px = horiz ? x + t : outward === 'w' ? x + 16 : x + w - 16, py = horiz ? (outward === 'n' ? y + 16 : y + h - 16) : y + t;
      claws(g, px, py, (horiz ? Math.PI / 2 : 0) + (hash(seed, i, 62) - 0.5) * 0.7, 16);
      if (hash(seed, i, 63) < 0.4) smear(g, px + 6, py + 4, 4, hash(seed, i, 64) * 3);
    }
    celBands(g, s, o, 3);
  });
  outlineOpen(g, s, o);
}

/* ------------------------------------------------------------------ sandbags */

/** Bags laid in staggered courses along the run, each a pillow lit along its crown, a few split and a few stencilled. */
function opbags(g: G, s: Solid) {
  const o = openSides('opbags', s), fh = OUTPOST_FACE.opbags;
  const { x, y, w, h } = s, seed = seedOf(s, 3);
  const horiz = w >= h;
  const faces = southFace(g, s, o, fh, C.bagLo, 'rgba(30, 26, 14, 0.35)');
  clipTo(g, faces, () => {
    for (const q of faces) {
      for (let row = 0; row < 2; row++) {
        const off = row ? 11 : 0;
        for (let bx = q.x - off; bx < q.x + q.w; bx += 22) {
          g.fillStyle = row ? C.bagLo : C.bag; rr(g, bx + 1, q.y + row * (fh / 2) + 0.5, 20, fh / 2 - 1, 3); g.fill();
          g.strokeStyle = 'rgba(30, 26, 14, 0.6)'; g.lineWidth = 1; g.stroke();
        }
      }
    }
  });
  g.fillStyle = C.bagDark; g.fillRect(x, y, w, h);
  clipRect(g, s, () => {
    const along = horiz ? w : h, across = horiz ? h : w, rows = Math.max(1, Math.round(across / 16.5)), rw = across / rows;
    for (let r = 0; r < rows; r++) {
      const off = r % 2 ? 13 : 0;
      for (let t = -off, k = 0; t < along; t += 26, k++) {
        const bx = horiz ? x + t : x + r * rw, by = horiz ? y + r * rw : y + t, bw = horiz ? 25 : rw - 1, bh = horiz ? rw - 1 : 25;
        const v = hash(seed, r, k);
        g.fillStyle = v < 0.3 ? C.bagHi : v < 0.8 ? C.bag : '#8a8456';
        rr(g, bx + 0.5, by + 0.5, bw, bh, 5); g.fill();
        g.strokeStyle = 'rgba(28, 24, 12, 0.7)'; g.lineWidth = 1.1; g.stroke();
        // the crown's light and the tied ear
        g.fillStyle = 'rgba(255, 244, 210, 0.18)';
        if (horiz) g.fillRect(bx + 4, by + 2, bw - 8, 2.5); else g.fillRect(bx + 2, by + 4, 2.5, bh - 8);
        g.fillStyle = 'rgba(40, 34, 18, 0.55)';
        if (horiz) g.fillRect(bx + bw - 4, by + bh / 2 - 2, 3, 4); else g.fillRect(bx + bw / 2 - 2, by + bh - 4, 4, 3);
        if (v > 0.93) { g.fillStyle = 'rgba(200, 182, 130, 0.8)'; g.beginPath(); g.ellipse(bx + bw / 2, by + bh / 2, 4, 3, 0, 0, TAU); g.fill(); }
      }
    }
    celBands(g, s, o, 3);
  });
  outlineOpen(g, s, o);
}

/* ------------------------------------------------------------------ watchtower and mast */

/** A watchtower seen from above: a corrugated tin roof on a timber frame, sandbags round its rim, a searchlight on the outer corner. Or, for a small one, the radio mast's lattice foot. */
function optower(g: G, s: Solid) {
  const { x, y, w, h } = s, seed = seedOf(s, 5);
  const o = wholeFace(s), fh = OUTPOST_FACE.optower;
  if (w <= 50) {
    // The radio mast: a triangular lattice base on a concrete pad, its guys anchored in the floor art.
    southFace(g, s, o, fh, C.steelLo, 'rgba(10, 10, 14, 0.4)');
    g.fillStyle = C.slabLo; g.fillRect(x, y, w, h);
    g.strokeStyle = C.steelHi; g.lineWidth = 2.2;
    const cx = x + w / 2, cy = y + h / 2, r = w * 0.38;
    const tri = [0, 1, 2].map((i) => ({ x: cx + Math.cos(-Math.PI / 2 + (i * TAU) / 3) * r, y: cy + Math.sin(-Math.PI / 2 + (i * TAU) / 3) * r }));
    g.beginPath(); tri.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath(); g.stroke();
    g.lineWidth = 1; g.beginPath(); for (const p of tri) { g.moveTo(p.x, p.y); g.lineTo(cx, cy); } g.stroke();
    g.fillStyle = C.red; g.beginPath(); g.arc(cx, cy, 4, 0, TAU); g.fill();
    g.strokeStyle = C.ink; g.lineWidth = 1.4; g.stroke();
    outlineOpen(g, s, o);
    return;
  }
  const faces = southFace(g, s, o, fh, C.woodLo, 'rgba(20, 14, 8, 0.4)');
  clipTo(g, faces, () => {
    for (const q of faces) {
      // the timber legs and a cross brace seen under the cab
      g.fillStyle = C.wood; g.fillRect(q.x + 6, q.y, 8, fh); g.fillRect(q.x + q.w - 14, q.y, 8, fh);
      g.strokeStyle = C.woodHi; g.lineWidth = 2.5; g.beginPath(); g.moveTo(q.x + 14, q.y + 2); g.lineTo(q.x + q.w - 14, q.y + fh - 2); g.moveTo(q.x + q.w - 14, q.y + 2); g.lineTo(q.x + 14, q.y + fh - 2); g.stroke();
    }
  });
  // sandbagged rim round the cab
  g.fillStyle = C.bagDark; g.fillRect(x, y, w, h);
  for (let i = 0; i < 4; i++) {
    for (let t = 2; t < w - 2; t += 14) {
      const bx = i === 0 ? x + t : i === 1 ? x + w - 11 : i === 2 ? x + t : x + 1, by = i === 0 ? y + 1 : i === 1 ? y + t : y + h - 11, bw = i % 2 ? 10 : 13, bh = i % 2 ? 13 : 10;
      if (i === 1 || i === 3) { if (t > h - 4) continue; }
      g.fillStyle = hash(seed, i, t) < 0.5 ? C.bag : C.bagHi; rr(g, bx, i === 3 ? y + t : by, bw, bh, 3); g.fill();
      g.strokeStyle = 'rgba(28, 24, 12, 0.6)'; g.lineWidth = 1; g.stroke();
    }
  }
  // the tin roof: corrugations, a lap seam, rust
  const ix = x + 14, iy = y + 14, iw = w - 28, ih = h - 28;
  g.fillStyle = C.steel; g.fillRect(ix, iy, iw, ih);
  g.strokeStyle = 'rgba(30, 32, 36, 0.45)'; g.lineWidth = 1;
  g.beginPath(); for (let k = ix + 3; k < ix + iw; k += 5) { g.moveTo(k, iy); g.lineTo(k, iy + ih); } g.stroke();
  g.fillStyle = 'rgba(126, 74, 42, 0.45)';
  for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(ix + hash(seed, k) * iw, iy + hash(seed, k, 2) * ih, 6 + hash(seed, k, 3) * 6, 3 + hash(seed, k, 4) * 3, 0, 0, TAU); g.fill(); }
  g.fillStyle = 'rgba(255, 244, 220, 0.2)'; g.fillRect(ix, iy, iw, 3);
  g.strokeStyle = C.ink; g.lineWidth = 1.6; g.strokeRect(ix, iy, iw, ih);
  // the searchlight on the corner that looks out, its lamp housing and cable
  const outX = x + w / 2 < MID ? x + 10 : x + w - 10, outY = y + h / 2 < MID ? y + 10 : y + h - 10;
  g.fillStyle = C.steelDark; g.beginPath(); g.arc(outX, outY, 8, 0, TAU); g.fill();
  g.fillStyle = C.lamp; g.beginPath(); g.arc(outX, outY, 5, 0, TAU); g.fill();
  g.strokeStyle = C.ink; g.lineWidth = 1.4; g.beginPath(); g.arc(outX, outY, 8, 0, TAU); g.stroke();
  text(g, 'T' + (1 + (x > MID ? 1 : 0) + (y > MID ? 2 : 0)), x + w / 2, y + h / 2, 16, 'rgba(232, 226, 204, 0.6)', 0, 1);
  outlineOpen(g, s, o);
}

/* ------------------------------------------------------------------ tents */

/** A canvas tent: a ridge along its length, two slopes in light and shade, its seams and tie-downs; white with a red cross for the medical tent. */
function optent(g: G, s: Solid) {
  const { x, y, w, h } = s, seed = seedOf(s, 7);
  const o = wholeFace(s), fh = OUTPOST_FACE.optent;
  const med = near(s, PLACE.med, 160), mess = near(s, PLACE.mess, 160);
  const base = med ? C.white : C.canvas, hi = med ? C.whiteHi : C.canvasHi, lo = med ? C.whiteLo : C.canvasLo;
  const faces = southFace(g, s, o, fh, lo, 'rgba(20, 22, 12, 0.35)');
  clipTo(g, faces, () => {
    for (const q of faces) {
      // the door flap, rolled up, and the dark inside
      const dx = q.x + q.w / 2;
      g.fillStyle = 'rgba(14, 14, 10, 0.75)'; g.beginPath(); g.moveTo(dx - 12, q.y + fh); g.lineTo(dx, q.y + 1); g.lineTo(dx + 12, q.y + fh); g.closePath(); g.fill();
      g.fillStyle = hi; g.fillRect(dx - 14, q.y + 1, 28, 3);
    }
  });
  const horiz = w >= h;
  g.fillStyle = base; g.fillRect(x, y, w, h);
  clipRect(g, s, () => {
    // the slopes: the north (or west) one lit, the other in shade
    g.fillStyle = hi;
    if (horiz) g.fillRect(x, y, w, h / 2); else g.fillRect(x, y, w / 2, h);
    g.fillStyle = lo;
    if (horiz) g.fillRect(x, y + h / 2, w, h / 2); else g.fillRect(x + w / 2, y, w / 2, h);
    // frame bows under the canvas
    g.strokeStyle = 'rgba(20, 22, 12, 0.28)'; g.lineWidth = 2;
    g.beginPath();
    if (horiz) for (let k = x + 25; k < x + w - 5; k += 50) { g.moveTo(k, y); g.lineTo(k, y + h); }
    else for (let k = y + 25; k < y + h - 5; k += 50) { g.moveTo(x, k); g.lineTo(x + w, k); }
    g.stroke();
    // stains, patches and the dust that settled
    for (let k = 0; k < 6; k++) {
      g.fillStyle = k < 2 ? 'rgba(80, 64, 40, 0.18)' : 'rgba(30, 30, 20, 0.12)';
      g.beginPath(); g.ellipse(x + hash(seed, k) * w, y + hash(seed, k, 1) * h, 10 + hash(seed, k, 2) * 14, 6 + hash(seed, k, 3) * 8, hash(seed, k, 4) * 3, 0, TAU); g.fill();
    }
    if (!med) { const px = x + 10 + hash(seed, 9) * (w - 40), py = y + 8 + hash(seed, 10) * (h - 30); g.fillStyle = C.oliveLo; g.fillRect(px, py, 18, 14); g.strokeStyle = 'rgba(20, 20, 12, 0.5)'; g.lineWidth = 1; g.setLineDash([2, 2]); g.strokeRect(px, py, 18, 14); g.setLineDash([]); }
    // the ridge
    g.strokeStyle = 'rgba(20, 22, 12, 0.7)'; g.lineWidth = 2.4;
    g.beginPath(); if (horiz) { g.moveTo(x, y + h / 2); g.lineTo(x + w, y + h / 2); } else { g.moveTo(x + w / 2, y); g.lineTo(x + w / 2, y + h); } g.stroke();
    // the stovepipe on the barracks and mess tents
    if (!med) { const sx = horiz ? x + w * 0.72 : x + w / 2 + 6, sy = horiz ? y + h / 2 + 6 : y + h * 0.3; g.fillStyle = C.steelDark; g.beginPath(); g.arc(sx, sy, 4.5, 0, TAU); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 1.2; g.stroke(); g.fillStyle = 'rgba(30, 30, 30, 0.3)'; g.beginPath(); g.ellipse(sx + 8, sy - 6, 9, 5, -0.6, 0, TAU); g.fill(); }
    if (med) {
      const cx = x + w / 2, cy = y + h / 2, a = Math.min(w, h) * 0.36, b = a * 0.34;
      g.fillStyle = C.white; g.beginPath(); g.arc(cx, cy, a * 1.1, 0, TAU); g.fill();
      g.fillStyle = C.red; g.fillRect(cx - a, cy - b, 2 * a, 2 * b); g.fillRect(cx - b, cy - a, 2 * b, 2 * a);
      g.strokeStyle = 'rgba(80, 20, 16, 0.6)'; g.lineWidth = 1.2; g.strokeRect(cx - a, cy - b, 2 * a, 2 * b); g.strokeRect(cx - b, cy - a, 2 * b, 2 * a);
    }
    if (mess) text(g, 'MESS', x + w / 2, y + h * 0.27, 22, 'rgba(232, 226, 204, 0.55)', 0, 4);
    else if (!med) text(g, Math.max(w, h) >= 250 ? 'BARRACKS' : 'BUNK 2', x + w / 2, y + h * 0.25, 15, 'rgba(232, 226, 204, 0.45)', horiz ? 0 : -Math.PI / 2, 3);
    // a line of tie-down loops round the hem
    g.fillStyle = 'rgba(20, 22, 12, 0.6)';
    for (let k = x + 12; k < x + w - 6; k += 24) { g.fillRect(k, y + 1, 3, 3); g.fillRect(k, y + h - 4, 3, 3); }
    for (let k = y + 12; k < y + h - 6; k += 24) { g.fillRect(x + 1, k, 3, 3); g.fillRect(x + w - 4, k, 3, 3); }
    celBands(g, s, o, 3);
  });
  outlineOpen(g, s, o);
}

/* ------------------------------------------------------------------ containers and cabins */

/** A container or cabin seen from above: ribbed steel roof across its short side, corner castings, and what each is for. */
function opcont(g: G, s: Solid) {
  const { x, y, w, h } = s, seed = seedOf(s, 11);
  const o = wholeFace(s), fh = OUTPOST_FACE.opcont;
  const comms = near(s, PLACE.comms, 140), ammo = near(s, PLACE.ammo, 160), booth = !comms && !ammo;
  const top = comms ? C.tan : ammo ? C.olive : '#8d8a7c', hi = comms ? C.tanHi : ammo ? C.oliveHi : '#a6a394', lo = comms ? C.tanLo : ammo ? C.oliveLo : '#6c6a5e';
  const faces = southFace(g, s, o, fh, lo, 'rgba(14, 14, 10, 0.4)');
  clipTo(g, faces, () => {
    for (const q of faces) {
      g.strokeStyle = 'rgba(20, 20, 16, 0.4)'; g.lineWidth = 1.2;
      g.beginPath(); for (let k = q.x + 4; k < q.x + q.w; k += 6) { g.moveTo(k, q.y); g.lineTo(k, q.y + fh); } g.stroke();
      if (booth) { g.fillStyle = '#3a5468'; g.fillRect(q.x + 12, q.y + 3, q.w - 24, fh * 0.45); g.strokeStyle = C.ink; g.lineWidth = 1.2; g.strokeRect(q.x + 12, q.y + 3, q.w - 24, fh * 0.45); }
    }
  });
  g.fillStyle = top; g.fillRect(x, y, w, h);
  clipRect(g, s, () => {
    const horiz = w >= h;
    g.strokeStyle = 'rgba(20, 20, 16, 0.32)'; g.lineWidth = 1.4;
    g.beginPath();
    if (horiz) for (let k = x + 5; k < x + w; k += 7) { g.moveTo(k, y); g.lineTo(k, y + h); }
    else for (let k = y + 5; k < y + h; k += 7) { g.moveTo(x, k); g.lineTo(x + w, k); }
    g.stroke();
    g.fillStyle = 'rgba(255, 244, 220, 0.14)';
    if (horiz) for (let k = x + 3; k < x + w; k += 7) g.fillRect(k, y, 1.5, h); else for (let k = y + 3; k < y + h; k += 7) g.fillRect(x, k, w, 1.5);
    // rust and dust
    for (let k = 0; k < 5; k++) { g.fillStyle = k < 3 ? 'rgba(126, 74, 42, 0.32)' : 'rgba(170, 150, 110, 0.25)'; g.beginPath(); g.ellipse(x + hash(seed, k) * w, y + hash(seed, k, 1) * h, 6 + hash(seed, k, 2) * 10, 4 + hash(seed, k, 3) * 6, 0, 0, TAU); g.fill(); }
    // corner castings
    g.fillStyle = C.steelDark;
    for (const [cx, cy] of [[x, y], [x + w - 7, y], [x, y + h - 7], [x + w - 7, y + h - 7]] as const) g.fillRect(cx, cy, 7, 7);
    if (comms) {
      // AC unit, a cable tray, and the dish and whip antennas on the roof
      g.fillStyle = C.steelHi; g.fillRect(x + w - 40, y + 10, 26, 22); g.strokeStyle = C.ink; g.lineWidth = 1.2; g.strokeRect(x + w - 40, y + 10, 26, 22);
      g.strokeStyle = C.steelDark; g.lineWidth = 1; g.beginPath(); g.arc(x + w - 27, y + 21, 8, 0, TAU); g.stroke();
      g.fillStyle = C.whiteHi; g.beginPath(); g.arc(x + 30, y + h - 32, 15, 0, TAU); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 1.4; g.stroke();
      g.strokeStyle = C.whiteLo; g.lineWidth = 1.2; g.beginPath(); g.arc(x + 30, y + h - 32, 9, 0, TAU); g.stroke();
      g.fillStyle = C.steelDark; g.beginPath(); g.arc(x + 30, y + h - 32, 3, 0, TAU); g.fill();
      g.strokeStyle = C.ink; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x + 70, y + 20); g.lineTo(x + 92, y + 6); g.moveTo(x + 80, y + 70); g.lineTo(x + 104, y + 84); g.stroke();
      text(g, 'COMMS', x + w / 2 + 10, y + h / 2 + 6, 18, 'rgba(40, 34, 22, 0.6)', 0, 3);
    } else if (ammo) {
      hazard(g, x + 6, y + h / 2 - 22, w - 12, 10, 6);
      g.fillStyle = C.yellow; g.fillRect(x + w / 2 - 22, y + h / 2 - 6, 44, 30); g.strokeStyle = C.ink; g.lineWidth = 1.4; g.strokeRect(x + w / 2 - 22, y + h / 2 - 6, 44, 30);
      text(g, 'AMMO', x + w / 2, y + h / 2 + 9, 14, C.ink, 0, 1);
      text(g, '1.4', x + w / 2, y + h / 2 + 46, 14, 'rgba(232, 226, 204, 0.5)', 0, 1);
    } else {
      // a checkpoint booth: a flat roof with a vent, a stencil, and the blood of whoever held it last
      g.fillStyle = C.steelLo; g.fillRect(x + 14, y + 14, 16, 16); g.strokeStyle = C.ink; g.lineWidth = 1.2; g.strokeRect(x + 14, y + 14, 16, 16);
      text(g, y < MID ? 'CP-A' : 'CP-B', x + w / 2 + 8, y + h / 2 + 12, 16, 'rgba(40, 40, 36, 0.6)', 0, 2);
      smear(g, x + w * 0.6, y + h * 0.3, 7, 0.4);
      claws(g, x + w * 0.35, y + h * 0.75, 0.3, 22);
    }
    celBands(g, s, o, 3);
  });
  outlineOpen(g, s, o);
}

/* ------------------------------------------------------------------ trucks */

/** A six-wheel cargo truck from above, cab to the north: bonnet, cab roof with its hatch, the canvas tilt over the bed on its bows. */
function optruck(g: G, s: Solid) {
  const { x, y, w, h } = s, seed = seedOf(s, 13);
  const o = wholeFace(s), fh = OUTPOST_FACE.optruck;
  const faces = southFace(g, s, o, fh, C.oliveDark, 'rgba(8, 8, 6, 0.4)');
  clipTo(g, faces, () => {
    for (const q of faces) {
      // tailgate, its lamps and the wheels showing under it
      g.fillStyle = C.oliveLo; g.fillRect(q.x + 6, q.y, q.w - 12, fh - 3);
      g.fillStyle = C.red; g.fillRect(q.x + 8, q.y + 3, 6, 4); g.fillRect(q.x + q.w - 14, q.y + 3, 6, 4);
      g.fillStyle = C.rubber; g.fillRect(q.x + 1, q.y + fh - 6, 12, 6); g.fillRect(q.x + q.w - 13, q.y + fh - 6, 12, 6);
    }
  });
  // the top is drawn upright, cab to the north, then turned to face the parade ground when the truck is parked across
  const horiz = w > h;
  g.save(); g.translate(x + w / 2, y + h / 2); if (horiz) g.rotate(x + w / 2 > MID ? -Math.PI / 2 : Math.PI / 2);
  top(horiz ? h : w, horiz ? w : h);
  g.restore();
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); celBands(g, s, o, 3); g.restore();
  g.strokeStyle = C.ink; g.lineWidth = 2; rr(g, x + (horiz ? 0 : 3), y + (horiz ? 3 : 0), w - (horiz ? 0 : 6), h - (horiz ? 6 : 0), 8); g.stroke();
  function top(tw: number, th: number) {
  const x = -tw / 2, y = -th / 2, w = tw, h = th;
  // wheels poking out the sides
  g.fillStyle = C.rubber;
  for (const ty of [y + 22, y + h - 64, y + h - 30]) { rr(g, x - 3, ty, 8, 24, 3); g.fill(); rr(g, x + w - 5, ty, 8, 24, 3); g.fill(); }
  g.fillStyle = C.olive; rr(g, x + 3, y, w - 6, h, 8); g.fill();
  clipRect(g, { x, y, w, h }, () => {
    // bonnet and cab
    g.fillStyle = C.oliveHi; rr(g, x + 10, y + 2, w - 20, 30, 6); g.fill();
    g.strokeStyle = 'rgba(20, 22, 12, 0.5)'; g.lineWidth = 1; g.beginPath(); for (let k = x + 18; k < x + w - 14; k += 8) { g.moveTo(k, y + 6); g.lineTo(k, y + 14); } g.stroke();
    g.fillStyle = '#2a3a44'; g.fillRect(x + 10, y + 34, w - 20, 8);
    g.fillStyle = C.oliveLo; g.fillRect(x + 8, y + 42, w - 16, 26);
    g.fillStyle = C.steelDark; g.beginPath(); g.arc(x + w / 2, y + 55, 7, 0, TAU); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 1.2; g.stroke();
    // the canvas tilt over the bed, sagging between its bows
    const by = y + 72, bh = h - 76;
    g.fillStyle = C.canvas; g.fillRect(x + 5, by, w - 10, bh);
    g.fillStyle = C.canvasHi; g.fillRect(x + 5, by, (w - 10) / 2, bh);
    for (let k = by + 16; k < by + bh; k += 24) { g.fillStyle = 'rgba(20, 22, 12, 0.35)'; g.fillRect(x + 5, k, w - 10, 3); }
    g.strokeStyle = 'rgba(20, 22, 12, 0.55)'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(x + w / 2, by); g.lineTo(x + w / 2, by + bh); g.stroke();
    // star, unit marks and a number on the bonnet, dust on everything
    g.fillStyle = 'rgba(232, 226, 204, 0.6)';
    g.save(); g.translate(x + w / 2, y + 18); g.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5; g.lineTo(Math.cos(a) * 8, Math.sin(a) * 8); } g.closePath(); g.fill(); g.restore();
    text(g, `M-${10 + Math.floor(hash(seed) * 80)}`, x + w / 2, by + bh * 0.55, 15, 'rgba(232, 226, 204, 0.45)', Math.PI / 2, 2);
    for (let k = 0; k < 5; k++) { g.fillStyle = 'rgba(170, 150, 110, 0.18)'; g.beginPath(); g.ellipse(x + hash(seed, k) * w, y + hash(seed, k, 1) * h, 8 + hash(seed, k, 2) * 10, 5, 0, 0, TAU); g.fill(); }
  });
  }
}

/* ------------------------------------------------------------------ crates */

/** Supply crates stacked on pallets: each 50 px a crate, wooden or olive-drab steel, lids, straps and stencils. */
function opcrate(g: G, s: Solid) {
  const o = openSides('opcrate', s), fh = OUTPOST_FACE.opcrate;
  const { x, y, w, h } = s, seed = seedOf(s, 17);
  const faces = southFace(g, s, o, fh, C.crateLo, 'rgba(20, 14, 8, 0.4)');
  clipTo(g, faces, () => {
    for (const q of faces) {
      g.strokeStyle = 'rgba(20, 14, 8, 0.45)'; g.lineWidth = 1;
      g.beginPath(); for (let k = q.x + 25; k < q.x + q.w; k += 25) { g.moveTo(k, q.y); g.lineTo(k, q.y + fh); } g.moveTo(q.x, q.y + fh - 4); g.lineTo(q.x + q.w, q.y + fh - 4); g.stroke();
    }
  });
  g.fillStyle = C.woodLo; g.fillRect(x, y, w, h);
  clipRect(g, s, () => {
    for (let cy = y; cy < y + h; cy += 50) {
      for (let cx = x; cx < x + w; cx += 50) {
        const v = hash(seed, cx, cy), metal = v < 0.35;
        const fill = metal ? C.olive : v < 0.7 ? C.crate : C.wood, hi = metal ? C.oliveHi : C.crateHi;
        g.fillStyle = fill; g.fillRect(cx + 2, cy + 2, 46, 46);
        if (metal) {
          g.fillStyle = hi; g.fillRect(cx + 2, cy + 2, 46, 4);
          g.strokeStyle = 'rgba(20, 22, 12, 0.6)'; g.lineWidth = 1.2; g.strokeRect(cx + 6, cy + 6, 38, 38);
          g.fillStyle = C.steelDark; g.fillRect(cx + 20, cy + 3, 10, 4); g.fillRect(cx + 20, cy + 43, 10, 4);
          text(g, v < 0.12 ? 'MRE' : v < 0.24 ? '5.56' : 'H2O', cx + 25, cy + 26, 12, 'rgba(232, 226, 204, 0.6)', 0, 1);
        } else {
          g.strokeStyle = 'rgba(40, 26, 12, 0.5)'; g.lineWidth = 1;
          g.beginPath(); for (let k = cy + 11; k < cy + 48; k += 9) { g.moveTo(cx + 3, k); g.lineTo(cx + 47, k); } g.stroke();
          g.fillStyle = hi; g.fillRect(cx + 2, cy + 2, 46, 3);
          g.strokeStyle = 'rgba(40, 26, 12, 0.7)'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(cx + 4, cy + 4); g.lineTo(cx + 46, cy + 46); g.stroke();
          g.fillStyle = 'rgba(30, 30, 30, 0.5)'; g.fillRect(cx + 10, cy + 2, 3, 46); g.fillRect(cx + 37, cy + 2, 3, 46);
        }
        g.strokeStyle = C.ink; g.lineWidth = 1.2; g.strokeRect(cx + 2, cy + 2, 46, 46);
      }
    }
    if (y < 600 && x < 600 && w >= 100) { text(g, 'AIRDROP', x + w / 2, y + h / 2, 13, 'rgba(255, 244, 220, 0.6)', -0.3, 2); }
    celBands(g, s, o, 3);
  });
  outlineOpen(g, s, o);
}

/* ------------------------------------------------------------------ fuel */

/** A fuel bladder (a black rubber pillow in its puddle of spills) or, narrow, a row of fuel drums. */
function opfuel(g: G, s: Solid) {
  const { x, y, w, h } = s, seed = seedOf(s, 19);
  const o = wholeFace(s), fh = OUTPOST_FACE.opfuel;
  southFace(g, s, o, fh, '#1a1c1e', 'rgba(0, 0, 0, 0.4)');
  if (Math.min(w, h) <= 50) {
    // drums: a row of 50 px pairs, red and olive, lids with their bungs
    g.fillStyle = 'rgba(20, 18, 14, 0.5)'; g.fillRect(x, y, w, h);
    for (let cx = x; cx < x + w; cx += 25) {
      for (let cy = y; cy < y + h; cy += 25) {
        const v = hash(seed, cx, cy);
        g.fillStyle = v < 0.5 ? C.red : C.olive; g.beginPath(); g.arc(cx + 12.5, cy + 12.5, 11.5, 0, TAU); g.fill();
        g.strokeStyle = C.ink; g.lineWidth = 1.4; g.stroke();
        g.strokeStyle = 'rgba(255, 244, 220, 0.3)'; g.lineWidth = 1; g.beginPath(); g.arc(cx + 12.5, cy + 12.5, 8, 0, TAU); g.stroke();
        g.fillStyle = C.steelDark; g.beginPath(); g.arc(cx + 16, cy + 9, 2, 0, TAU); g.fill();
      }
    }
    return;
  }
  g.fillStyle = C.rubber; rr(g, x + 1, y + 1, w - 2, h - 2, Math.min(w, h) * 0.35); g.fill();
  const grd = g.createLinearGradient(x, y, x, y + h);
  grd.addColorStop(0, 'rgba(120, 124, 130, 0.35)'); grd.addColorStop(0.45, 'rgba(60, 62, 66, 0.05)'); grd.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
  g.fillStyle = grd; rr(g, x + 1, y + 1, w - 2, h - 2, Math.min(w, h) * 0.35); g.fill();
  // seams, the fill fitting and hose
  g.strokeStyle = 'rgba(140, 146, 150, 0.35)'; g.lineWidth = 1.2;
  rr(g, x + 9, y + 9, w - 18, h - 18, Math.min(w, h) * 0.28); g.stroke();
  g.fillStyle = C.steelHi; g.beginPath(); g.arc(x + w * 0.25, y + h / 2, 6, 0, TAU); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 1.2; g.stroke();
  g.strokeStyle = '#151618'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(x + w * 0.25, y + h / 2); g.quadraticCurveTo(x - 10, y + h * 0.9, x - 4, y + h + 4); g.stroke();
  text(g, 'JP-8', x + w * 0.62, y + h / 2, 16, 'rgba(214, 176, 58, 0.75)', 0, 2);
  g.strokeStyle = C.ink; g.lineWidth = 2; rr(g, x + 1, y + 1, w - 2, h - 2, Math.min(w, h) * 0.35); g.stroke();
}

/* ------------------------------------------------------------------ wrecks */

/** A burned-out wreck: scorched paint, rust bloom, the shell's ribs; shaped by its size into an APC, a truck, a humvee, a helicopter or a fallen tower. */
function opwreck(g: G, s: Solid) {
  const { x, y, w, h } = s, seed = seedOf(s, 23);
  const o = wholeFace(s), fh = OUTPOST_FACE.opwreck;
  const heli = near(s, PLACE.heli, 260), tower = near(s, PLACE.tower, 120);
  southFace(g, s, o, fh, C.char, 'rgba(0, 0, 0, 0.4)');
  if (tower) {
    // the toppled watchtower: splintered legs, a crushed tin roof, sandbags burst across it
    g.fillStyle = C.char; g.fillRect(x, y, w, h);
    g.fillStyle = C.steelLo; g.save(); g.translate(x + w / 2, y + h / 2); g.rotate(0.35); g.fillRect(-36, -30, 72, 60);
    g.strokeStyle = 'rgba(20, 20, 24, 0.5)'; g.lineWidth = 1; g.beginPath(); for (let k = -33; k < 36; k += 5) { g.moveTo(k, -30); g.lineTo(k, 30); } g.stroke(); g.restore();
    g.strokeStyle = C.woodLo; g.lineWidth = 6; g.lineCap = 'butt';
    for (let i = 0; i < 4; i++) { const a = hash(seed, i) * TAU; g.beginPath(); g.moveTo(x + w / 2, y + h / 2); g.lineTo(x + w / 2 + Math.cos(a) * 48, y + h / 2 + Math.sin(a) * 48); g.stroke(); }
    for (let i = 0; i < 7; i++) { g.fillStyle = hash(seed, i, 5) < 0.5 ? C.bag : C.bagLo; rr(g, x + hash(seed, i, 6) * (w - 22), y + hash(seed, i, 7) * (h - 14), 22, 13, 4); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 1; g.stroke(); }
    g.strokeStyle = C.ink; g.lineWidth = 2; g.strokeRect(x, y, w, h);
    return;
  }
  const horiz = w >= h, L = horiz ? w : h, S = horiz ? h : w;
  const apc = near(s, PLACE.apc, 200), humvee = !heli && !apc && L <= 150 && S >= 100;
  g.save(); g.translate(x + w / 2, y + h / 2); if (!horiz) g.rotate(Math.PI / 2);
  // in here the long axis runs along x, the front at +x
  const hl = L / 2, hs = S / 2;
  const soot = (n: number, r: number) => {
    for (let i = 0; i < n; i++) {
      g.fillStyle = i % 3 === 0 ? hexRust(i) : 'rgba(8, 6, 4, 0.45)';
      g.beginPath(); g.ellipse((hash(seed, i) - 0.5) * L * 0.9, (hash(seed, i, 1) - 0.5) * S * 0.8, r * (0.5 + hash(seed, i, 2)), r * (0.35 + hash(seed, i, 3) * 0.6), hash(seed, i, 4) * 3, 0, TAU); g.fill();
    }
  };
  const wheel = (cx: number, cy: number, rw: number, rh: number, burnt = true) => { g.fillStyle = burnt ? '#141414' : C.rubber; rr(g, cx - rw / 2, cy - rh / 2, rw, rh, 3); g.fill(); g.strokeStyle = burnt ? 'rgba(126, 74, 42, 0.7)' : C.ink; g.lineWidth = 1.2; g.stroke(); };
  if (heli && L >= 200) {
    // the fuselage, on its side in its own soot: tail end to the west, the smashed cockpit east, a door torn off, the rotor hub
    g.fillStyle = C.char; rr(g, -hl + 1, -hs + 1, L - 2, S - 2, S * 0.48); g.fill();
    g.save(); rr(g, -hl + 1, -hs + 1, L - 2, S - 2, S * 0.48); g.clip();
    g.fillStyle = C.oliveDark; g.fillRect(-hl, -hs, L * 0.45, S);
    g.fillStyle = 'rgba(70, 80, 50, 0.6)'; g.fillRect(-hl, -hs, L * 0.45, S * 0.3);
    soot(10, 18);
    g.fillStyle = 'rgba(58, 84, 104, 0.85)'; g.beginPath(); g.ellipse(hl - 28, 0, 24, S * 0.36, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(220, 230, 235, 0.5)'; g.lineWidth = 1; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(hl - 28, 0); g.lineTo(hl - 28 + Math.cos(i * 1.1) * 22, Math.sin(i * 1.1) * 30); g.stroke(); }
    g.fillStyle = '#0c0a0a'; g.fillRect(-hl + 90, hs - 28, 48, 26);
    g.fillStyle = 'rgba(230, 226, 214, 0.5)'; g.fillRect(-hl + 50, -12, 26, 24); g.fillStyle = 'rgba(176, 53, 42, 0.6)'; g.fillRect(-hl + 59, -10, 8, 20); g.fillRect(-hl + 53, -4, 20, 8);
    g.restore();
    disc(g, 10, 0, 13, C.steelDark); disc(g, 10, 0, 5, C.steelLo);
    g.strokeStyle = C.ink; g.lineWidth = 2; rr(g, -hl + 1, -hs + 1, L - 2, S - 2, S * 0.48); g.stroke();
  } else if (heli) {
    // the tail boom, snapped off: a narrow tube, its tail rotor bent
    g.fillStyle = C.oliveDark; rr(g, -hl, -9, L, 18, 8); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 1.6; g.stroke();
    g.fillStyle = 'rgba(8, 6, 4, 0.5)'; g.fillRect(-hl + L * 0.45, -9, L * 0.55, 18);
    g.strokeStyle = C.steelLo; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(-hl + 14, -hs + 4); g.lineTo(-hl + 20, hs - 6); g.stroke();
    disc(g, -hl + 17, 0, 5, C.steelDark);
  } else if (apc) {
    // an APC: tracks down both sides, the hull's sloped glacis, hatches, the turret ring empty and blackened
    for (const sy of [-hs + 2, hs - 18]) { g.fillStyle = '#121212'; g.fillRect(-hl + 6, sy, L - 12, 16); g.fillStyle = 'rgba(126, 74, 42, 0.45)'; for (let t = -hl + 8; t < hl - 8; t += 9) g.fillRect(t, sy + 2, 5, 12); g.strokeStyle = C.ink; g.lineWidth = 1.2; g.strokeRect(-hl + 6, sy, L - 12, 16); }
    g.fillStyle = C.char; rr(g, -hl + 10, -hs + 16, L - 20, S - 32, 6); g.fill();
    g.save(); rr(g, -hl + 10, -hs + 16, L - 20, S - 32, 6); g.clip();
    g.fillStyle = C.oliveDark; g.fillRect(-hl, -hs, L * 0.35, S); soot(8, 16);
    g.fillStyle = 'rgba(60, 54, 46, 0.6)'; g.beginPath(); g.moveTo(hl - 40, -hs + 16); g.lineTo(hl - 10, -hs + 26); g.lineTo(hl - 10, hs - 26); g.lineTo(hl - 40, hs - 16); g.closePath(); g.fill();
    g.restore();
    disc(g, -10, 0, 18, '#151210'); disc(g, -10, 0, 10, '#0a0808');
    g.fillStyle = 'rgba(255, 138, 58, 0.3)'; g.beginPath(); g.arc(-10, 0, 5, 0, TAU); g.fill();
    for (const hx of [-hl + 30, hl - 60]) { g.strokeStyle = 'rgba(0, 0, 0, 0.6)'; g.lineWidth = 1.4; g.strokeRect(hx, -10, 18, 20); }
    g.strokeStyle = C.ink; g.lineWidth = 2; rr(g, -hl + 10, -hs + 16, L - 20, S - 32, 6); g.stroke();
  } else if (humvee) {
    // a humvee on its roof: the underside up, its axles, driveshaft, exhaust and four wheels in the air
    for (const wx of [-hl + 24, hl - 24]) for (const wy of [-hs + 12, hs - 12]) wheel(wx, wy, 28, 18, false);
    g.fillStyle = '#4a4436'; rr(g, -hl + 8, -hs + 16, L - 16, S - 32, 8); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 1.8; g.stroke();
    g.strokeStyle = '#2a2622'; g.lineWidth = 5; g.beginPath(); g.moveTo(-hl + 24, -hs + 18); g.lineTo(-hl + 24, hs - 18); g.moveTo(hl - 24, -hs + 18); g.lineTo(hl - 24, hs - 18); g.stroke();
    g.lineWidth = 4; g.beginPath(); g.moveTo(-hl + 24, 0); g.lineTo(hl - 24, 0); g.stroke();
    g.strokeStyle = C.rust; g.lineWidth = 3; g.beginPath(); g.moveTo(hl - 40, 10); g.lineTo(-hl + 14, 14); g.stroke();
    g.fillStyle = '#2a2622'; g.fillRect(hl - 46, -12, 22, 24);
    g.fillStyle = 'rgba(126, 74, 42, 0.4)'; g.beginPath(); g.ellipse(-10, -8, 18, 8, 0.3, 0, TAU); g.fill();
    claws(g, 10, -14, 0.2, 22);
  } else {
    // a cargo truck burned to the frame: blackened cab at the front, the bed's bare bows, six wheels gone to their rims
    for (const wx of [hl - 30, -hl + 50, -hl + 22]) for (const wy of [-hs + 4, hs - 4]) wheel(wx, wy, 24, 12);
    g.fillStyle = C.char; rr(g, hl - 52, -hs + 8, 50, S - 16, 7); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 1.8; g.stroke();
    g.fillStyle = 'rgba(126, 74, 42, 0.55)'; g.beginPath(); g.ellipse(hl - 30, 0, 14, 18, 0, 0, TAU); g.fill();
    g.fillStyle = '#0c0a08'; g.fillRect(hl - 50, -hs + 14, 10, S - 28);
    // the bed: its floor charred, the canvas gone, the bows standing
    g.fillStyle = '#1e1a16'; g.fillRect(-hl + 4, -hs + 10, L - 62, S - 20);
    g.strokeStyle = C.rust; g.lineWidth = 3;
    g.beginPath(); for (let t = -hl + 14; t < hl - 62; t += 22) { g.moveTo(t, -hs + 10); g.lineTo(t, hs - 10); } g.stroke();
    g.strokeStyle = 'rgba(156, 96, 56, 0.6)'; g.lineWidth = 1.5; g.strokeRect(-hl + 4, -hs + 10, L - 62, S - 20);
    g.fillStyle = 'rgba(30, 26, 20, 0.7)'; for (let i = 0; i < 6; i++) g.fillRect(-hl + 10 + hash(seed, i, 7) * (L - 80), -hs + 14 + hash(seed, i, 8) * (S - 34), 8, 5);
    g.fillStyle = 'rgba(255, 138, 58, 0.22)'; g.beginPath(); g.arc(-hl + L * 0.35, 4, 7, 0, TAU); g.fill();
    claws(g, hl - 28, hs - 18, 0.6, 18);
  }
  g.restore();
}
const RUSTS = ['rgba(126, 74, 42, 0.55)', 'rgba(156, 96, 56, 0.45)', 'rgba(90, 56, 36, 0.5)', 'rgba(110, 66, 40, 0.5)', 'rgba(60, 50, 44, 0.5)'];
const hexRust = (i: number) => RUSTS[i % RUSTS.length]!;
const disc = (g: G, x: number, y: number, r: number, fill: string) => { g.fillStyle = fill; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 1.4; g.stroke(); };

export const OUTPOST_WALLS: Partial<Record<SolidKind, (ctx: CanvasRenderingContext2D, s: Solid) => void>> = { ophesco, opbags, optower, optent, opcont, optruck, opcrate, opfuel, opwreck };
