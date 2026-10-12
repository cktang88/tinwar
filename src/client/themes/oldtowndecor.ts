import { CANAL, CHURCH, FOUNTAIN } from '../../shared/maps/oldtowngeo.ts';
import { seeded } from '../grain.ts';
import { C, OLDTOWN, SIZE, TAU, at, baseId, box, disc, hash, hexA, insideWall, isTwin, roofAt, shade, turn } from './oldtownkit.ts';

/**
 * Hand-placed floor dressing for Old Town, baked into the ground layer. A thread runs through it: there was a wedding at St.
 * Aldric's this afternoon (rice and petals at the west door, a dropped bouquet, a chalked heart by the fountain, the "just
 * married" cart in the cart yard), and the town is closing up for the night: crates stacked by the stalls, baskets of washing
 * in the drying yard, a hopscotch in the court, chairs pulled up to the tables indoors. Everything sits in the margins, never
 * across a lane, low in contrast with an ink outline and a crisp contact shadow. Three eggs: a rubber duck on the canal, a
 * cat asleep in a basket of warm laundry, and a single golden pretzel on the bakery floor.
 */
type G = CanvasRenderingContext2D;
type Fn = (g: G, x: number, y: number, twin: boolean) => void;

/* ---------------------------------------------------------------- small things */

function crate(g: G, x: number, y: number, r: number, s = 34) {
  at(g, x, y, r, () => { shade(g, 0, 0, s * 0.6, s * 0.5); box(g, -s / 2, -s / 2, s, s, C.pine); g.strokeStyle = C.pineLo; g.lineWidth = 3; g.beginPath(); g.moveTo(-s / 2 + 3, -s / 2 + 3); g.lineTo(s / 2 - 3, s / 2 - 3); g.stroke(); g.strokeStyle = C.ink; g.lineWidth = 1.4; g.strokeRect(-s / 2 + 4, -s / 2 + 4, s - 8, s - 8); });
}
function produce(g: G, x: number, y: number, r: number, col: string) {
  at(g, x, y, r, () => { shade(g, 0, 0, 22, 16); box(g, -20, -14, 40, 28, C.pineLo); for (let i = 0; i < 8; i++) disc(g, -13 + (i % 4) * 9, -6 + Math.floor(i / 4) * 11, 4.6, col, 1); });
}
function cask(g: G, x: number, y: number) { shade(g, x, y, 17, 13); disc(g, x, y, 15, C.oak, 2); g.strokeStyle = C.iron; g.lineWidth = 2.4; g.beginPath(); g.arc(x, y, 11, 0, TAU); g.stroke(); disc(g, x, y, 4, C.oakLo, 1.2); }
function sack(g: G, x: number, y: number, r: number) { at(g, x, y, r, () => { shade(g, 0, 0, 18, 12); g.fillStyle = '#d8ccb0'; g.beginPath(); g.ellipse(0, 0, 17, 12, 0, 0, TAU); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 1.6; g.stroke(); g.fillStyle = '#b4a07a'; g.fillRect(10, -4, 8, 8); g.fillStyle = 'rgba(60,40,20,0.5)'; g.fillRect(-6, -3, 9, 2); g.fillRect(-6, 1, 9, 2); }); }
function basket(g: G, x: number, y: number, fill: string) { shade(g, x, y, 22, 15); g.fillStyle = '#a8864a'; g.beginPath(); g.ellipse(x, y, 21, 14, 0, 0, TAU); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 1.8; g.stroke(); g.fillStyle = fill; g.beginPath(); g.ellipse(x, y - 1, 16, 9, 0, 0, TAU); g.fill(); g.strokeStyle = 'rgba(60,40,20,0.5)'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(x, y, 19, 12, 0, 0, TAU); g.stroke(); }
function hay(g: G, x: number, y: number, r: number) { at(g, x, y, r, () => { shade(g, 0, 0, 30, 18); g.fillStyle = '#c9a85a'; g.beginPath(); g.roundRect(-28, -16, 56, 32, 6); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 1.8; g.stroke(); g.strokeStyle = '#8a6a32'; g.lineWidth = 2; g.beginPath(); g.moveTo(-10, -16); g.lineTo(-10, 16); g.moveTo(10, -16); g.lineTo(10, 16); g.stroke(); g.strokeStyle = 'rgba(255,240,180,0.35)'; g.lineWidth = 1.2; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(-24 + i * 9, -10); g.lineTo(-20 + i * 9, 8); g.stroke(); } }); }
function flowerPot(g: G, x: number, y: number, col: string) { shade(g, x, y, 11, 8); disc(g, x, y, 10, '#a85a3c', 1.6); g.fillStyle = C.grassLo; g.beginPath(); g.arc(x, y, 7, 0, TAU); g.fill(); for (let i = 0; i < 5; i++) { const a = i * 1.26; disc(g, x + Math.cos(a) * 4, y + Math.sin(a) * 4, 2.6, col, 0); } }
function tomb(g: G, x: number, y: number, r: number, k: number) {
  at(g, x, y, r, () => {
    shade(g, 0, 0, 18, 12);
    g.fillStyle = 'rgba(60, 80, 40, 0.5)'; g.beginPath(); g.ellipse(0, 18, 16, 24, 0, 0, TAU); g.fill();
    g.fillStyle = k < 0.5 ? C.stoneHi : C.stone; g.beginPath(); g.moveTo(-13, 6); g.lineTo(-13, -6); g.arc(0, -6, 13, Math.PI, 0); g.lineTo(13, 6); g.closePath(); g.fill();
    g.strokeStyle = C.ink; g.lineWidth = 1.8; g.stroke();
    g.fillStyle = C.stoneFront; g.fillRect(-13, 6, 26, 5); g.strokeRect(-13, 6, 26, 5);
    g.strokeStyle = 'rgba(40,36,30,0.6)'; g.lineWidth = 2; g.beginPath(); if (k < 0.3) { g.moveTo(0, -12); g.lineTo(0, 2); g.moveTo(-5, -7); g.lineTo(5, -7); } else { g.moveTo(-7, -6); g.lineTo(7, -6); g.moveTo(-7, -1); g.lineTo(5, -1); } g.stroke();
  });
}
function flowerBed(g: G, x: number, y: number, w: number, h: number, seed: number) {
  g.fillStyle = 'rgba(14, 16, 24, 0.25)'; g.fillRect(x + 3, y + 4, w, h);
  g.fillStyle = '#4a3a28'; g.fillRect(x, y, w, h); g.strokeStyle = C.stoneLo; g.lineWidth = 4; g.strokeRect(x, y, w, h); g.strokeStyle = C.ink; g.lineWidth = 1.5; g.strokeRect(x - 2, y - 2, w + 4, h + 4);
  for (let i = 0; i < (w * h) / 220; i++) { const px = x + 6 + hash(seed, i) * (w - 12), py = y + 6 + hash(seed, i, 2) * (h - 12); g.fillStyle = C.grassHi; g.beginPath(); g.arc(px, py, 4, 0, TAU); g.fill(); g.fillStyle = ['#d9443a', '#e8c86a', '#c86ab0', '#f0e6d0'][Math.floor(hash(seed, i, 3) * 4)]!; g.beginPath(); g.arc(px + 1, py - 1, 2.4, 0, TAU); g.fill(); }
}

/* ---------------------------------------------------------------- the stories */

/** Rice and rose petals scattered on the flags at the church's west door, and a bouquet someone dropped. */
const wedding: Fn = (g, x, y, twin) => {
  const rand = seeded(Math.round(x * 3 + y));
  for (let i = 0; i < 160; i++) {
    const a = rand() * TAU, d = Math.sqrt(rand()) * 150;
    const px = x + Math.cos(a) * d * 0.8, py = y + Math.sin(a) * d;
    g.fillStyle = rand() < 0.5 ? (twin ? '#e8d27a' : '#f4f0e4') : rand() < 0.6 ? '#d9443a' : '#f0a0b0';
    g.fillRect(px, py, 3, 2);
  }
  if (!twin) at(g, x - 60, y + 50, 0.6, () => {
    shade(g, 0, 0, 16, 10);
    g.strokeStyle = C.grassLo; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 0); g.lineTo(22, 6); g.moveTo(0, 0); g.lineTo(20, -4); g.stroke();
    for (let i = 0; i < 7; i++) disc(g, -4 + Math.cos(i) * 7, Math.sin(i) * 7, 5, i % 2 ? '#f4f0e4' : '#e8a0b0', 1.2);
    g.fillStyle = '#f4f0e4'; g.fillRect(18, -1, 12, 3);
  });
};

/** A chalked heart with two initials, by the fountain. */
const heart: Fn = (g, x, y, twin) => {
  g.save(); g.translate(x, y); g.globalAlpha = 0.7; g.strokeStyle = twin ? '#bfe0ff' : '#f0d8e0'; g.lineWidth = 4; g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, 22); g.bezierCurveTo(-34, -2, -22, -26, 0, -10); g.bezierCurveTo(22, -26, 34, -2, 0, 22); g.stroke();
  g.fillStyle = g.strokeStyle; g.font = '700 14px "Barlow Condensed", "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(twin ? 'A + T' : 'J + M', 0, 1);
  g.restore();
};

const hopscotch: Fn = (g, x, y) => {
  g.save(); g.translate(x, y); g.globalAlpha = 0.6; g.strokeStyle = '#e8e2d0'; g.lineWidth = 3;
  const cells: [number, number][] = [[0, 0], [0, -40], [-20, -80], [20, -80], [0, -120], [-20, -160], [20, -160], [0, -200]];
  g.font = '700 14px "Barlow Condensed", "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#e8e2d0';
  cells.forEach(([cx, cy], i) => { g.strokeRect(cx - 20, cy - 20, 40, 40); g.fillText(String(i + 1), cx, cy); });
  g.beginPath(); g.arc(0, -240, 22, Math.PI, 0); g.stroke();
  g.globalAlpha = 1; disc(g, 22, -40, 5, '#9a8a74', 1.2);
  g.restore();
};

/** The drying yard's baskets; in one a cat has curled up on the warm sheets (found him). */
const washBaskets: Fn = (g, x, y, twin) => {
  basket(g, x, y, C.linen); basket(g, x + 60, y + 14, '#d8e2ea');
  if (!twin) { disc(g, x + 60, y + 12, 9, '#d98a3a', 1.4); disc(g, x + 67, y + 6, 5, '#d98a3a', 1.2); g.strokeStyle = '#d98a3a'; g.lineWidth = 3; g.beginPath(); g.arc(x + 58, y + 14, 12, 1.4, 3.2); g.stroke(); g.strokeStyle = C.ink; g.lineWidth = 1; g.beginPath(); g.moveTo(x + 65, y + 6); g.lineTo(x + 68, y + 6); g.stroke(); }
  // the yard's posts
  for (const [px, py] of [[x - 120, y - 260], [x + 120, y - 260], [x - 120, y + 120], [x + 120, y + 120]] as const) { shade(g, px, py, 8, 6); disc(g, px, py, 6, C.oakLo, 1.6); }
};

const ruts: Fn = (g, x, y) => {
  g.strokeStyle = 'rgba(30, 24, 16, 0.35)'; g.lineWidth = 8; g.lineCap = 'round';
  for (const o of [-26, 26]) { g.beginPath(); g.moveTo(x - 100, y - 250 + o); g.quadraticCurveTo(x + 40, y + o, x - 40, y + 260 + o); g.stroke(); }
};

/** The duck on the canal. */
const duck: Fn = (g, x, y) => {
  g.fillStyle = 'rgba(200, 230, 240, 0.25)'; g.beginPath(); g.ellipse(x, y + 3, 16, 6, 0, 0, TAU); g.fill();
  disc(g, x, y, 9, '#f2c93c', 1.8); disc(g, x + 8, y - 5, 5.4, '#f2c93c', 1.6);
  g.fillStyle = '#e8762c'; g.beginPath(); g.moveTo(x + 12, y - 6); g.lineTo(x + 19, y - 4); g.lineTo(x + 12, y - 2); g.closePath(); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 1.2; g.stroke();
  g.fillStyle = C.ink; g.beginPath(); g.arc(x + 9, y - 7, 1, 0, TAU); g.fill();
};

/** A rowing boat moored at the quay steps, oars shipped. */
const boat: Fn = (g, x, y, twin) => {
  at(g, x, y, twin ? 0.05 : -0.04, () => {
    g.fillStyle = 'rgba(10, 20, 24, 0.35)'; g.beginPath(); g.ellipse(4, 6, 92, 26, 0, 0, TAU); g.fill();
    g.fillStyle = twin ? '#3f5f86' : '#8a3a32'; g.beginPath(); g.moveTo(-90, 0); g.quadraticCurveTo(-60, -26, 40, -24); g.quadraticCurveTo(92, -20, 96, 0); g.quadraticCurveTo(92, 20, 40, 24); g.quadraticCurveTo(-60, 26, -90, 0); g.closePath(); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 2; g.stroke();
    g.fillStyle = C.pine; g.beginPath(); g.moveTo(-76, 0); g.quadraticCurveTo(-50, -17, 40, -16); g.quadraticCurveTo(80, -13, 84, 0); g.quadraticCurveTo(80, 13, 40, 16); g.quadraticCurveTo(-50, 17, -76, 0); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = C.pineLo; for (const sx of [-30, 14, 52]) { g.fillRect(sx, -16, 12, 32); g.strokeRect(sx, -16, 12, 32); }
    g.strokeStyle = C.oakLo; g.lineWidth = 4; g.beginPath(); g.moveTo(-50, -6); g.lineTo(60, -10); g.moveTo(-50, 6); g.lineTo(60, 10); g.stroke();
    g.strokeStyle = '#d8ccb0'; g.lineWidth = 2; g.beginPath(); g.moveTo(-90, 0); g.quadraticCurveTo(-110, -40, -96, -70); g.stroke();
  });
};

/** One golden pretzel dropped behind the bakery counter. */
const pretzel: Fn = (g, x, y) => {
  g.save(); g.translate(x, y); g.strokeStyle = C.ink; g.lineWidth = 6; g.lineCap = 'round';
  const path = () => { g.beginPath(); g.moveTo(-10, 8); g.bezierCurveTo(-20, -6, -10, -14, 0, -2); g.bezierCurveTo(10, -14, 20, -6, 10, 8); g.moveTo(-10, 8); g.lineTo(6, -3); g.moveTo(10, 8); g.lineTo(-6, -3); };
  path(); g.stroke(); g.strokeStyle = '#e0b040'; g.lineWidth = 3.5; path(); g.stroke();
  g.fillStyle = '#f6eed6'; g.fillRect(-2, -6, 2, 2); g.fillRect(6, 0, 2, 2);
  g.restore();
};

/** The smithy's anvil and quench barrel, the cooperage's half-made cask and its staves. */
const workshop: Fn = (g, x, y, twin) => {
  if (twin) {
    shade(g, x, y, 26, 14); g.fillStyle = C.iron; g.beginPath(); g.moveTo(x - 26, y - 8); g.lineTo(x + 18, y - 8); g.lineTo(x + 30, y - 2); g.lineTo(x + 18, y + 4); g.lineTo(x + 8, y + 4); g.lineTo(x + 8, y + 12); g.lineTo(x - 14, y + 12); g.lineTo(x - 14, y + 4); g.lineTo(x - 26, y + 4); g.closePath(); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 2; g.stroke();
    g.fillStyle = C.ironHi; g.fillRect(x - 24, y - 7, 40, 3);
    cask(g, x + 70, y + 10); g.fillStyle = '#3a5a66'; g.beginPath(); g.arc(x + 70, y + 10, 8, 0, TAU); g.fill();
    return;
  }
  for (let i = 0; i < 8; i++) at(g, x - 40 + i * 6, y + 40, 0.1 * (i - 4), () => { g.fillStyle = C.pine; g.fillRect(-3, -26, 6, 52); g.strokeStyle = C.ink; g.lineWidth = 1.2; g.strokeRect(-3, -26, 6, 52); });
  shade(g, x + 40, y, 20, 16); for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; at(g, x + 40 + Math.cos(a) * 14, y + Math.sin(a) * 14, a, () => { g.fillStyle = i % 2 ? C.oak : C.oakHi; g.fillRect(-4, -3, 8, 6); }); }
  g.strokeStyle = C.iron; g.lineWidth = 3; g.beginPath(); g.arc(x + 40, y, 18, 0, TAU); g.stroke();
};

/** Chairs pulled up to the tables in the tavern, the coffee house and the houses: one on each free side of a two-by-two table. */
function chairs(g: G) {
  for (const w of OLDTOWN.walls) {
    if (w.material !== 'otfurn' || w.w !== 100 || w.h !== 100) continue;
    const id = roofAt(w.x + 50, w.y + 50);
    if (!id) continue;
    const room = baseId(id);
    if (room === 'laundry' || room === 'cooper' || room === 'stable') continue;
    const cx = w.x + 50, cy = w.y + 50;
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
      const px = cx + dx * 72, py = cy + dy * 72;
      if (insideWall('otwall', px, py) || insideWall('otfurn', px, py) || insideWall('otstone', px, py)) continue;
      for (const off of [-24, 24]) {
        const qx = px + (dy ? off : 0), qy = py + (dx ? off : 0);
        shade(g, qx, qy, 12, 10, 0.25);
        box(g, qx - 10, qy - 10, 20, 20, isTwin(id) ? C.oakHi : C.oak, 1.6);
        g.fillStyle = C.oakLo; g.fillRect(qx - 10 + (dx > 0 ? 16 : 0) * (dx ? 1 : 0), qy - 10 + (dy > 0 ? 16 : 0), dx ? 4 : 20, dy ? 4 : 20);
      }
    }
  }
}

/* ---------------------------------------------------------------- placement (west half; the twin of each is placed too) */

const PLACED: readonly (readonly [Fn, number, number])[] = [
  [wedding, 430, 2000], [heart, 1300, 2470],
  [hopscotch, 900, 4900], [washBaskets, 1380, 3200], [ruts, 1430, 3950], [duck, 1700, 1300], [boat, 820, 1270],
  [pretzel, 1180, 380], [workshop, 950, 3870],
];

export function paintOldtownDecor(g: G, seed: number): void {
  void seed;
  g.save();
  g.lineJoin = 'round';
  for (const [fn, x, y] of PLACED) { fn(g, x, y, false); const t = turn(x, y); fn(g, t.x, t.y, true); }
  chairs(g);
  // the churchyard's graves (the town garden's flower beds on the other side)
  for (let i = 0; i < 14; i++) {
    const x = 80 + (i % 7) * 150 + (i > 6 ? 60 : 0) + (x0Skip(i) ? 40 : 0), y = 1470 + Math.floor(i / 7) * 110;
    if ((x > 260 && x < 540) || (x > 1110 && x < 1340)) continue;
    tomb(g, x, y, (hash(i, 3) - 0.5) * 0.3, hash(i, 4));
  }
  for (let i = 0; i < 5; i++) { const t = turn(160 + i * 340, 1560); flowerBed(g, t.x - 70, t.y - 50, 140, 100, i * 31); }
  // market: produce crates and baskets set down round the stalls, a chalk board, a dropped cabbage
  const market: [number, number, string][] = [[2290, 2640, '#b4524a'], [2500, 2620, '#c9a23c'], [2720, 3360, '#6a8a4a'], [2290, 3410, '#c88a4a'], [2600, 2820, '#9a3a5a']];
  for (const [x, y, col] of market) { produce(g, x, y, hash(x, y) - 0.5, col); const t = turn(x, y); produce(g, t.x, t.y, hash(y, x) - 0.5, col); }
  for (const [x, y] of [[2440, 3420], [2850, 2620]] as const) { basket(g, x, y, '#6a8a4a'); const t = turn(x, y); basket(g, t.x, t.y, '#c9a23c'); }
  // flour sacks by the bakery, casks by the tavern, crates on the quay, hay at the stables, pots at the doors
  for (const [x, y, r] of [[1480, 640, 0.3], [1440, 680, -0.4], [1490, 700, 0.1]] as const) { sack(g, x, y, r); const t = turn(x, y); sack(g, t.x, t.y, -r); }
  for (const [x, y] of [[730, 360], [770, 410], [730, 460], [2250, 1140], [2290, 1100]] as const) { cask(g, x, y); const t = turn(x, y); cask(g, t.x, t.y); }
  for (const [x, y, r] of [[1560, 1100, 0.1], [1600, 1110, -0.2], [1580, 1070, 0.3], [2620, 1110, 0.2]] as const) { crate(g, x, y, r); const t = turn(x, y); crate(g, t.x, t.y, -r); }
  for (const [x, y, r] of [[1640, 3680, 0.1], [2150, 3680, -0.1], [1700, 4300, 0.3]] as const) { hay(g, x, y, r); const t = turn(x, y); hay(g, t.x, t.y, r); }
  for (const [x, y, c] of [[260, 590, '#d9443a'], [380, 590, '#e8c86a'], [1050, 640, '#c86ab0'], [1910, 540, '#d9443a'], [2560, 2590, '#e8c86a'], [2660, 2590, '#d9443a'], [710, 2830, '#f0e6d0'], [2240, 3240, '#c86ab0'], [200, 5190, '#d9443a'], [360, 5190, '#e8c86a']] as const) {
    flowerPot(g, x, y, c); const t = turn(x, y); flowerPot(g, t.x, t.y, c);
  }
  // fallen lime leaves under the trees
  const rand = seeded(0x1eaf);
  for (let i = 0; i < 260; i++) {
    const x = rand() * SIZE, y = rand() * SIZE;
    if (Math.hypot(x - FOUNTAIN.x, y - FOUNTAIN.y) > 900 && Math.hypot(SIZE - x - FOUNTAIN.x, SIZE - y - FOUNTAIN.y) > 900) continue;
    g.fillStyle = hexA(rand() < 0.5 ? '#c9a23c' : '#9a7a32', 0.7); g.beginPath(); g.ellipse(x, y, 5, 3, rand() * 3, 0, TAU); g.fill();
  }
  void CANAL; void CHURCH;
  g.restore();
}
const x0Skip = (i: number) => i % 3 === 1;
