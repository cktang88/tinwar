import type { Pt } from '../../shared/geom.ts';
import { CANAL, CHURCH, FOUNTAIN } from '../../shared/maps/oldtowngeo.ts';
import type { FloorPlan } from '../floor.ts';
import { blotch, seeded } from '../grain.ts';
import { paintOldtownDecor } from './oldtowndecor.ts';
import { C, OLDTOWN, SIZE, TAU, YARDS, boundsOf, floorOf, hash, hexA, trace, turn, type FloorKind, type Yard } from './oldtownkit.ts';

/**
 * Old Town's ground, baked once. Cobbled setts in running rows down every lane, fan-laid granite in the squares with a compass
 * rose in the market and rings round the fountain, big flags on the quays and at the gate, gravel and grass in the beer garden,
 * churchyard and drying yard, packed earth in the cart yard, and the canal: green water between quay kerbs, with the bridges'
 * decks across it. Every roofed room gets its own floor (found from the map's roofs): boards, oak, terracotta, chequered marble,
 * herringbone parquet, wet slate, straw, and the church's flags with a runner up the aisle.
 * The pavings are patterns baked from one small tile each, so painting the whole town costs a few fills.
 */
type G = CanvasRenderingContext2D;
type Box = { x: number; y: number; w: number; h: number };

/* ---------------------------------------------------------------- tiles */

const tiles = new Map<string, CanvasPattern>();
function tile(g: G, key: string, side: number, paint: (t: G) => void): CanvasPattern {
  let p = tiles.get(key);
  if (p) return p;
  const c = document.createElement('canvas');
  c.width = c.height = side;
  paint(c.getContext('2d')!);
  p = g.createPattern(c, 'repeat')!;
  tiles.set(key, p);
  return p;
}
/** Draws `paint(x, y)` and its copies across the tile's edges, so the tile repeats seamlessly. */
const wrap = (side: number, x: number, y: number, reach: number, paint: (x: number, y: number) => void) => {
  for (const dx of [-side, 0, side]) for (const dy of [-side, 0, side]) {
    const px = x + dx, py = y + dy;
    if (px + reach >= 0 && px - reach <= side && py + reach >= 0 && py - reach <= side) paint(px, py);
  }
};

const STONES = ['#746b5f', '#6a6256', '#7d7466', '#655d52', '#80776a', '#6f675b', '#77705f'] as const;

/** Setts in running rows: small granite blocks, each its own shade, a dark joint between. */
function settTile(t: G) {
  const S = 256, rand = seeded(0x5e77);
  t.fillStyle = C.joint; t.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 21) {
    let x = rand() * 20;
    const end = x + S;
    while (x < end) {
      const w = 20 + rand() * 12, col = STONES[Math.floor(rand() * STONES.length)]!, hi = rand();
      wrap(S, x, y, 40, (px, py) => {
        t.fillStyle = col; t.beginPath(); t.roundRect(px + 1.5, py + 1.5, w - 3, 18, 5); t.fill();
        t.fillStyle = `rgba(255, 246, 226, ${0.06 + hi * 0.08})`; t.fillRect(px + 3, py + 3, w - 7, 3);
        t.fillStyle = 'rgba(10, 8, 6, 0.14)'; t.fillRect(px + 3, py + 15, w - 6, 3);
      });
      x += w;
    }
  }
}

/** Fan-laid granite (segmental arcs), the paving of the squares. */
function fanTile(t: G) {
  const S = 320, R = 80, rand = seeded(0xfa17);
  t.fillStyle = C.joint; t.fillRect(0, 0, S, S);
  const centres: [number, number][] = [];
  for (let row = 0; row < S / (R / 2) + 2; row++) for (let col = -1; col < S / (R * 2) + 1; col++) centres.push([col * R * 2 + (row % 2) * R, row * (R / 2)]);
  for (const [cx, cy] of centres) {
    for (let r = R; r > 6; r -= 15) {
      const n = Math.max(3, Math.round((Math.PI * r) / 17));
      for (let i = 0; i < n; i++) {
        const a0 = Math.PI + (i / n) * Math.PI, a1 = Math.PI + ((i + 1) / n) * Math.PI;
        const col = STONES[Math.floor(rand() * STONES.length)]!;
        wrap(S, cx, cy, R + 4, (px, py) => {
          t.fillStyle = col; t.beginPath(); t.arc(px, py, r - 1.5, a0 + 0.04, a1 - 0.04); t.arc(px, py, r - 13.5, a1 - 0.05, a0 + 0.05, true); t.closePath(); t.fill();
        });
      }
    }
  }
  t.fillStyle = 'rgba(255, 246, 226, 0.05)'; t.fillRect(0, 0, S, S);
}

/** Big flagstones in courses of random length. */
function flagTile(t: G, base: readonly string[], seed: number) {
  const S = 360, rand = seeded(seed);
  t.fillStyle = '#4a453d'; t.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 60) {
    let x = rand() * 60;
    const end = x + S;
    while (x < end) {
      const w = 50 + rand() * 70, col = base[Math.floor(rand() * base.length)]!;
      wrap(S, x, y, 130, (px, py) => {
        t.fillStyle = col; t.fillRect(px + 2, py + 2, w - 4, 56);
        t.fillStyle = 'rgba(255, 246, 226, 0.08)'; t.fillRect(px + 2, py + 2, w - 4, 4);
        t.fillStyle = 'rgba(10, 8, 6, 0.12)'; t.fillRect(px + 2, py + 52, w - 4, 6);
      });
      x += w;
    }
  }
}

function boardTile(t: G, cols: readonly string[], width: number, seed: number) {
  const S = 240, rand = seeded(seed);
  for (let x = 0; x < S; x += width) {
    let y = -rand() * 120;
    while (y < S) {
      const len = 70 + rand() * 110, col = cols[Math.floor(rand() * cols.length)]!;
      t.fillStyle = col; t.fillRect(x, y, width, len);
      t.fillStyle = 'rgba(255, 240, 210, 0.07)'; t.fillRect(x + 1, y, 2, len);
      t.fillStyle = 'rgba(20, 10, 4, 0.5)'; t.fillRect(x, y, width, 1.5); t.fillRect(x + width - 1.5, y, 1.5, len);
      if (rand() < 0.3) { t.fillStyle = 'rgba(30, 16, 6, 0.35)'; t.beginPath(); t.ellipse(x + width / 2, y + len * rand(), 2.5, 4, 0, 0, TAU); t.fill(); }
      y += len;
    }
  }
}

/** Basket-weave parquet: squares of four strips, each square turned against its neighbours. */
function herringTile(t: G, a: string, b: string) {
  const S = 80, Q = 40, W = 10;
  t.fillStyle = '#3a2412'; t.fillRect(0, 0, S, S);
  for (let qy = 0; qy < 2; qy++) for (let qx = 0; qx < 2; qx++) {
    const ox = qx * Q, oy = qy * Q, across = (qx + qy) % 2 === 0;
    for (let k = 0; k < 4; k++) {
      t.fillStyle = (k + qx) % 2 ? a : b;
      if (across) t.fillRect(ox + 1, oy + k * W + 1, Q - 2, W - 1.5); else t.fillRect(ox + k * W + 1, oy + 1, W - 1.5, Q - 2);
    }
    t.fillStyle = 'rgba(255, 240, 210, 0.06)'; t.fillRect(ox + 1, oy + 1, Q - 2, 2);
  }
}

function checkerTile(t: G, a: string, b: string, s = 40) {
  t.fillStyle = a; t.fillRect(0, 0, s * 2, s * 2);
  t.fillStyle = b; t.fillRect(0, 0, s, s); t.fillRect(s, s, s, s);
  t.fillStyle = 'rgba(20, 20, 24, 0.35)'; t.fillRect(0, 0, s * 2, 1.5); t.fillRect(0, s, s * 2, 1.5); t.fillRect(0, 0, 1.5, s * 2); t.fillRect(s, 0, 1.5, s * 2);
}

function squareTile(t: G, cols: readonly string[], s: number, joint: string, seed: number) {
  const S = s * 6, rand = seeded(seed);
  t.fillStyle = joint; t.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += s) for (let x = 0; x < S; x += s) { t.fillStyle = cols[Math.floor(rand() * cols.length)]!; t.fillRect(x + 1.5, y + 1.5, s - 3, s - 3); t.fillStyle = 'rgba(255,246,226,0.08)'; t.fillRect(x + 1.5, y + 1.5, s - 3, 3); }
}

function grassTile(t: G) {
  const S = 200, rand = seeded(0x96a5);
  t.fillStyle = C.grass; t.fillRect(0, 0, S, S);
  for (let i = 0; i < 900; i++) {
    const x = rand() * S, y = rand() * S, k = rand();
    t.fillStyle = k < 0.4 ? C.grassHi : k < 0.75 ? C.grassLo : '#7a8a4a';
    wrap(S, x, y, 4, (px, py) => t.fillRect(px, py, 2, 4 + rand() * 3));
  }
  for (let i = 0; i < 10; i++) { const x = rand() * S, y = rand() * S; t.fillStyle = rand() < 0.5 ? '#e8e0c0' : '#d9c24a'; wrap(S, x, y, 3, (px, py) => { t.beginPath(); t.arc(px, py, 2.2, 0, TAU); t.fill(); }); }
}

function gravelTile(t: G, base: string, seed: number) {
  const S = 160, rand = seeded(seed);
  t.fillStyle = base; t.fillRect(0, 0, S, S);
  for (let i = 0; i < 1400; i++) { t.fillStyle = rand() < 0.5 ? 'rgba(255,246,226,0.16)' : 'rgba(20,16,10,0.18)'; t.fillRect(rand() * S, rand() * S, 2 + rand() * 2, 2 + rand() * 2); }
}

function strawTile(t: G) {
  const S = 160, rand = seeded(0x57a3);
  t.fillStyle = '#6a5838'; t.fillRect(0, 0, S, S);
  t.lineCap = 'round';
  for (let i = 0; i < 700; i++) {
    const x = rand() * S, y = rand() * S, a = rand() * TAU, l = 6 + rand() * 10;
    t.strokeStyle = rand() < 0.5 ? '#c9a85a' : '#a88a48'; t.lineWidth = 1.6;
    wrap(S, x, y, 16, (px, py) => { t.beginPath(); t.moveTo(px, py); t.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); t.stroke(); });
  }
}

type Paving = 'setts' | 'fan' | 'flags' | 'quayflags' | 'grass' | 'gravel' | 'dirt' | FloorKind;
function pattern(g: G, p: Paving): CanvasPattern {
  switch (p) {
    case 'setts': return tile(g, p, 256, settTile);
    case 'fan': return tile(g, p, 320, fanTile);
    case 'flags': return tile(g, p, 360, (t) => flagTile(t, ['#7d776a', '#878070', '#726c60', '#8d8676'], 0xf1a9));
    case 'quayflags': return tile(g, p, 360, (t) => flagTile(t, ['#8d8676', '#9a9282', '#827b6c'], 0x9ea7));
    case 'grass': return tile(g, p, 200, grassTile);
    case 'gravel': return tile(g, p, 160, (t) => gravelTile(t, C.gravel, 0x6a7e));
    case 'dirt': return tile(g, p, 160, (t) => gravelTile(t, C.dirt, 0xd127));
    case 'planks': return tile(g, p, 240, (t) => boardTile(t, ['#8a6440', '#946c46', '#7f5c3a', '#9a7450'], 20, 0xb0a7));
    case 'oak': return tile(g, p, 240, (t) => boardTile(t, ['#5f3f26', '#6a4a2e', '#563822', '#704e32'], 30, 0x0a4));
    case 'terracotta': return tile(g, p, 240, (t) => squareTile(t, ['#a8573a', '#b4613f', '#9a5034', '#ad6a48'], 40, '#5a3424', 0x7e22));
    case 'butcher': return tile(g, p, 80, (t) => checkerTile(t, '#e8e2d4', '#9a3a32', 40));
    case 'checker': return tile(g, p, 80, (t) => checkerTile(t, '#d8d2c4', '#3a3634', 40));
    case 'parquet': return tile(g, p, 80, (t) => herringTile(t, '#8a5e36', '#a06e40'));
    case 'hall': return tile(g, p, 80, (t) => herringTile(t, '#7a5030', '#946238'));
    case 'wetstone': return tile(g, p, 300, (t) => squareTile(t, ['#5c6670', '#66707a', '#55606a', '#6c767e'], 50, '#2f363c', 0x3e7));
    case 'straw': return tile(g, p, 160, strawTile);
    case 'nave': return tile(g, p, 300, (t) => squareTile(t, ['#a39a88', '#8d8676', '#b0a794', '#978f7e'], 50, '#5a554c', 0x4a7e));
  }
}

const fillWith = (g: G, p: Paving, b: Box) => { g.fillStyle = pattern(g, p); g.fillRect(b.x, b.y, b.w, b.h); };
const twinBox = (b: Box): Box => ({ x: SIZE - b.x - b.w, y: SIZE - b.y - b.h, w: b.w, h: b.h });

/* ---------------------------------------------------------------- open ground */

const YARD_PAVING: Record<Yard['ground'], Paving> = { setts: 'setts', square: 'fan', garden: 'grass', dirt: 'dirt', flags: 'flags', yard: 'dirt' };

function yards(g: G) {
  for (const y of YARDS) {
    const b = { x: y.x, y: y.y, w: y.w, h: y.h };
    const boxes = y.id === 'market' ? [b] : [b, twinBox(b)];
    for (const bx of boxes) {
      if (y.id === 'beergarden') { fillWith(g, 'gravel', bx); continue; }
      fillWith(g, YARD_PAVING[y.ground], bx);
      // a soft edge so a square meets its lanes without a seam
      g.strokeStyle = 'rgba(30, 26, 20, 0.35)'; g.lineWidth = 6; g.strokeRect(bx.x + 3, bx.y + 3, bx.w - 6, bx.h - 6);
    }
  }
  // beer garden: a lawn round the gravel, and the churchyard's paths
  for (const flip of [false, true]) {
    const T = (b: Box) => (flip ? twinBox(b) : b);
    fillWith(g, 'grass', T({ x: 0, y: 950, w: 800, h: 100 }));
    fillWith(g, 'gravel', T({ x: 300, y: 1400, w: 200, h: 300 }));
    fillWith(g, 'gravel', T({ x: 1150, y: 1400, w: 150, h: 300 }));
    fillWith(g, 'flags', T({ x: 1200, y: 3000, w: 400, h: 100 }));
  }
}

/** The market's compass rose round zone B, and the light-stone rings round the fountain and its twin. */
function markers(g: G) {
  const cx = SIZE / 2, cy = SIZE / 2;
  g.save();
  g.fillStyle = 'rgba(30, 26, 20, 0.35)'; g.beginPath(); g.arc(cx, cy, 172, 0, TAU); g.fill();
  for (let ring = 0; ring < 3; ring++) {
    const r0 = 60 + ring * 38, n = 18 + ring * 8;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * TAU, a1 = ((i + 1) / n) * TAU;
      g.fillStyle = (i + ring) % 2 ? '#9a9282' : '#6a6256'; g.beginPath(); g.arc(cx, cy, r0 + 34, a0 + 0.01, a1 - 0.01); g.arc(cx, cy, r0 + 3, a1 - 0.01, a0 + 0.01, true); g.closePath(); g.fill();
    }
  }
  // the star: eight points in pale and dark stone, north picked out
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU - Math.PI / 2, len = i % 2 ? 46 : 64, half = 0.32;
    g.fillStyle = i === 0 ? '#c9a24a' : i % 2 ? '#5a554c' : '#b8af9c';
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a - half) * 18, cy + Math.sin(a - half) * 18); g.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len); g.lineTo(cx + Math.cos(a + half) * 18, cy + Math.sin(a + half) * 18); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(28, 31, 38, 0.6)'; g.lineWidth = 1.5; g.stroke();
  }
  g.fillStyle = '#c9a24a'; g.beginPath(); g.arc(cx, cy, 8, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(28, 31, 38, 0.5)'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, 172, 0, TAU); g.stroke();
  // fountain rings: pale granite round the basin
  for (const p of [{ x: FOUNTAIN.x, y: FOUNTAIN.y }, turn(FOUNTAIN.x, FOUNTAIN.y)]) {
    for (let k = 0; k < 2; k++) {
      const r0 = FOUNTAIN.r + 6 + k * 30, n = 30 + k * 6;
      for (let i = 0; i < n; i++) { const a0 = (i / n) * TAU, a1 = ((i + 1) / n) * TAU; g.fillStyle = k ? '#8d8676' : '#a39a88'; g.beginPath(); g.arc(p.x, p.y, r0 + 26, a0 + 0.01, a1 - 0.01); g.arc(p.x, p.y, r0, a1 - 0.01, a0 + 0.01, true); g.closePath(); g.fill(); }
    }
  }
  g.restore();
}

/* ---------------------------------------------------------------- canal */

function canal(g: G) {
  for (const flip of [false, true]) {
    const T = (b: Box) => (flip ? twinBox(b) : b);
    // quay kerbs along both banks, the full run
    fillWith(g, 'quayflags', T({ x: 0, y: CANAL.y - 50, w: 2900, h: 50 }));
    fillWith(g, 'quayflags', T({ x: 0, y: CANAL.y + CANAL.h, w: 2900, h: 50 }));
    for (const [x0, x1] of CANAL.runs) {
      const b = T({ x: x0, y: CANAL.y, w: x1 - x0, h: CANAL.h });
      g.fillStyle = C.water; g.fillRect(b.x, b.y, b.w, b.h);
      const gr = g.createLinearGradient(0, b.y, 0, b.y + b.h);
      gr.addColorStop(0, 'rgba(10, 24, 30, 0.55)'); gr.addColorStop(0.25, 'rgba(10, 24, 30, 0)'); gr.addColorStop(0.75, 'rgba(10, 24, 30, 0)'); gr.addColorStop(1, 'rgba(10, 24, 30, 0.35)');
      g.fillStyle = gr; g.fillRect(b.x, b.y, b.w, b.h);
      // slow ripple bands and the odd lily pad
      g.strokeStyle = hexA(C.waterHi, 0.35); g.lineWidth = 3; g.lineCap = 'round';
      for (let x = b.x + 20; x < b.x + b.w - 30; x += 60) for (let k = 0; k < 2; k++) {
        const y = b.y + 50 + k * 90 + hash(x, k) * 30, len = 20 + hash(x, k, 2) * 30;
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + len / 2, y - 4, x + len, y); g.stroke();
      }
      for (let i = 0; i < b.w / 220; i++) {
        const px = b.x + 30 + hash(b.x, i) * (b.w - 60), py = b.y + 30 + hash(b.x, i, 2) * (b.h - 60);
        g.fillStyle = '#4f7a42'; g.beginPath(); g.arc(px, py, 9, 0.4, TAU - 0.1); g.lineTo(px, py); g.fill(); g.strokeStyle = 'rgba(28,31,38,0.6)'; g.lineWidth = 1.4; g.stroke();
      }
      // the quay wall's shadow on the water, and its wet edge
      g.fillStyle = 'rgba(10, 20, 24, 0.45)'; g.fillRect(b.x, b.y, b.w, 14);
      g.fillStyle = 'rgba(160, 200, 200, 0.25)'; g.fillRect(b.x, b.y + b.h - 4, b.w, 4);
      g.strokeStyle = C.ink; g.lineWidth = 2.5; g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(b.x + b.w, b.y); g.moveTo(b.x, b.y + b.h); g.lineTo(b.x + b.w, b.y + b.h); g.stroke();
    }
    // the bridges: a humped stone deck with a worn path down the middle
    for (const bx of CANAL.bridges) {
      const b = T({ x: bx, y: CANAL.y - 20, w: CANAL.bridgeW, h: CANAL.h + 40 });
      fillWith(g, 'quayflags', b);
      const gr = g.createLinearGradient(b.x, 0, b.x + b.w, 0);
      gr.addColorStop(0, 'rgba(10, 12, 18, 0.25)'); gr.addColorStop(0.5, 'rgba(255, 246, 226, 0.12)'); gr.addColorStop(1, 'rgba(10, 12, 18, 0.25)');
      g.fillStyle = gr; g.fillRect(b.x, b.y, b.w, b.h);
      g.fillStyle = 'rgba(40, 34, 28, 0.25)'; g.fillRect(b.x + b.w / 2 - 30, b.y, 60, b.h);
    }
  }
}

/* ---------------------------------------------------------------- rooms */

function rooms(g: G) {
  for (const r of OLDTOWN.roofs ?? []) {
    const kind = floorOf(r.id);
    if (!kind) continue;
    const pts = r.points as Pt[];
    const b = boundsOf(pts), box = { x: b.x0, y: b.y0, w: b.x1 - b.x0, h: b.y1 - b.y0 };
    g.save(); trace(g, pts); g.clip();
    fillWith(g, kind, box);
    // lamplight pooled in the middle of each room, darker corners
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2, rad = Math.max(box.w, box.h) * 0.7;
    const gr = g.createRadialGradient(cx, cy, rad * 0.2, cx, cy, rad);
    gr.addColorStop(0, 'rgba(255, 220, 160, 0.08)'); gr.addColorStop(1, 'rgba(10, 8, 6, 0.28)');
    g.fillStyle = gr; g.fillRect(box.x, box.y, box.w, box.h);
    if (kind === 'nave' || kind === 'hall') aisle(g, kind === 'nave');
    if (kind === 'planks' || kind === 'oak' || kind === 'parquet') rug(g, box, r.id);
    g.restore();
  }
}

/** The church's runner up the aisle to the altar (the town hall's is blue), with a gold border. */
function aisle(g: G, church: boolean) {
  const twin = !church;
  const y0 = CHURCH.y0 + 250 - 40, x0 = CHURCH.x0 + 50, x1 = CHURCH.apse.x + 100;
  const b = twin ? twinBox({ x: x0, y: y0, w: x1 - x0, h: 80 }) : { x: x0, y: y0, w: x1 - x0, h: 80 };
  g.fillStyle = twin ? '#2f4a7a' : '#8a2a2a'; g.fillRect(b.x, b.y, b.w, b.h);
  g.fillStyle = '#c9a24a'; g.fillRect(b.x, b.y + 6, b.w, 4); g.fillRect(b.x, b.y + b.h - 10, b.w, 4);
  g.strokeStyle = 'rgba(28,31,38,0.6)'; g.lineWidth = 2; g.strokeRect(b.x, b.y, b.w, b.h);
}

function rug(g: G, box: Box, id: string) {
  if (hash(Math.round(box.x), Math.round(box.y), 3) < 0.35) return;
  const w = Math.min(box.w - 140, 200), h = Math.min(box.h - 140, 130);
  if (w < 80 || h < 60) return;
  const x = box.x + box.w / 2 - w / 2 + (hash(box.x, 1) - 0.5) * 40, y = box.y + box.h / 2 - h / 2 + (hash(box.y, 2) - 0.5) * 40;
  const col = ['#8a3a32', '#2f4a6a', '#5a6a3a', '#7a5a2a'][Math.floor(hash(box.x, box.y, id.length) * 4)]!;
  g.fillStyle = 'rgba(10, 8, 6, 0.25)'; g.fillRect(x + 3, y + 3, w, h);
  g.fillStyle = col; g.fillRect(x, y, w, h);
  g.strokeStyle = '#d9c28a'; g.lineWidth = 3; g.strokeRect(x + 8, y + 8, w - 16, h - 16);
  g.fillStyle = 'rgba(255, 240, 200, 0.18)';
  for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(x + w / 2, y + 18 + k * 4); g.lineTo(x + w - 24 - k * 8, y + h / 2); g.lineTo(x + w / 2, y + h - 18 - k * 4); g.lineTo(x + 24 + k * 8, y + h / 2); g.closePath(); g.stroke(); }
  g.strokeStyle = '#d9c28a'; g.lineWidth = 1.5; for (let fx = x + 4; fx < x + w; fx += 6) { g.beginPath(); g.moveTo(fx, y); g.lineTo(fx, y - 6); g.moveTo(fx, y + h); g.lineTo(fx, y + h + 6); g.stroke(); }
  g.strokeStyle = 'rgba(28,31,38,0.6)'; g.lineWidth = 2; g.strokeRect(x, y, w, h);
}

/* ---------------------------------------------------------------- weathering */

/** Gutters: a dark channel of worn setts running down the middle of the long lanes, and grime at every house's foot. */
function weathering(g: G, size: number, seed: number) {
  const rand = seeded(seed ^ 0x77d1);
  for (let i = 0; i < 70; i++) blotch(g, rand() * size, rand() * size, 120 + rand() * 260, rand() < 0.5 ? '30, 26, 20' : '120, 130, 110', 0.08 + rand() * 0.06);
  // puddles that catch the lamps (the mood's wet ground mirrors light in them)
  for (let i = 0; i < 46; i++) {
    const x = rand() * size, y = rand() * size, r = 24 + rand() * 40;
    g.fillStyle = 'rgba(40, 56, 70, 0.32)'; g.beginPath(); g.ellipse(x, y, r, r * 0.55, rand() * 3, 0, TAU); g.fill();
    g.fillStyle = 'rgba(180, 200, 220, 0.12)'; g.beginPath(); g.ellipse(x - r * 0.2, y - r * 0.12, r * 0.5, r * 0.18, 0.2, 0, TAU); g.fill();
  }
  // moss in the joints near the canal and the church
  for (let i = 0; i < 600; i++) {
    const x = rand() * size, y = rand() * size;
    const near = Math.abs(y - (CANAL.y + 100)) < 260 || Math.abs(SIZE - y - (CANAL.y + 100)) < 260;
    if (!near && rand() < 0.75) continue;
    g.fillStyle = hexA(C.moss, 0.3 + rand() * 0.2); g.fillRect(x, y, 3 + rand() * 6, 2);
  }
}

function pads(g: G, plan: FloorPlan) {
  const mat = (r: Box, col: string) => {
    // A worn flagstone landing edged in a band of the team's cloth-coloured stone.
    g.fillStyle = 'rgba(20, 22, 26, 0.3)'; g.fillRect(r.x - 10, r.y - 10, r.w + 20, r.h + 20);
    g.fillStyle = hexA(col, 0.5); g.fillRect(r.x - 10, r.y - 10, r.w + 20, r.h + 20);
    fillWith(g, 'flags', r);
    g.strokeStyle = C.ink; g.lineWidth = 2.4; g.strokeRect(r.x - 10, r.y - 10, r.w + 20, r.h + 20);
    g.strokeStyle = hexA('#e2dccb', 0.5); g.lineWidth = 3; g.setLineDash([14, 10]); g.strokeRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4); g.setLineDash([]);
  };
  for (const r of plan.pads) if (r.team) mat(r, r.team === 'red' ? '#b4524a' : '#4f7fbf');
  for (const r of OLDTOWN.spawns.ffa) {
    if (plan.pads.some((p) => p.team && p.x === r.x && p.y === r.y)) continue;
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2, R = Math.min(r.w, r.h) / 2 + 14;
    g.strokeStyle = hexA('#e2dccb', 0.4); g.lineWidth = 5; g.setLineDash([16, 12]); g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.stroke(); g.setLineDash([]);
  }
}

export function paintOldtownFloor(g: G, size: number, seed: number, plan: FloorPlan): void {
  fillWith(g, 'setts', { x: 0, y: 0, w: size, h: size });
  yards(g);
  canal(g);
  markers(g);
  rooms(g);
  weathering(g, size, seed);
  pads(g, plan);
  paintOldtownDecor(g, seed);
  // the rim of the world: the town walls' shade darkens the map's edge
  const rim = 160;
  for (const [x0, y0, x1, y1, rx, ry, rw, rh] of [[0, 0, 0, rim, 0, 0, size, rim], [0, size, 0, size - rim, 0, size - rim, size, rim], [0, 0, rim, 0, 0, 0, rim, size], [size, 0, size - rim, 0, size - rim, 0, rim, size]] as const) {
    const grad = g.createLinearGradient(x0, y0, x1, y1);
    grad.addColorStop(0, 'rgba(14, 12, 10, 0.4)'); grad.addColorStop(1, 'rgba(14, 12, 10, 0)');
    g.fillStyle = grad; g.fillRect(rx, ry, rw, rh);
  }
}
