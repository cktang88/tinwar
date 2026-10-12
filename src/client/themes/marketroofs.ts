/**
 * Night Market roofs: each hall and canopy wears its own rooftop, baked once into a sprite and drawn while nobody of yours is under it.
 * The material names the building (temple, bazaar, parking, arcade, canopy, tarp); the district under it picks how it is dressed, so a
 * hall and its half-turn twin read as two different places: the temple and the beer hall, the night bazaar and the food hall, the arcade
 * and the fish hall, the produce canopy and the spice canopy.
 */
import type { MapRoof } from '../../shared/geom.ts';
import { seeded } from '../grain.ts';
import { boundsOf, type G } from './geokit.ts';
import { districtAt, font, hash, hexA, OUTLINE, rr, shade, type District } from './marketkit.ts';
import { fish, paperLantern } from './marketwalls.ts';

const TAU = Math.PI * 2;
const MARGIN = 40;
type B = { x: number; y: number; w: number; h: number };

const ink = (g: G, lw = 2) => { g.strokeStyle = OUTLINE; g.lineWidth = lw; g.lineJoin = 'round'; };
const slab = (g: G, x: number, y: number, w: number, h: number, fill: string, lw = 1.6) => { g.fillStyle = fill; g.fillRect(x, y, w, h); ink(g, lw); g.strokeRect(x, y, w, h); };
const label = (g: G, t: string, x: number, y: number, size: number, fill: string) => { g.font = font(size); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = fill; g.fillText(t, x, y); };

/** A lit signboard: dark plate, neon frame, lettering. */
function sign(g: G, t: string, cx: number, cy: number, size: number, neon: string, letter: string) {
  g.font = font(size);
  const w = g.measureText(t).width + size * 1.2, h = size * 1.5;
  g.fillStyle = hexA(neon, 0.22); g.fillRect(cx - w / 2 - 8, cy - h / 2 - 8, w + 16, h + 16);
  slab(g, cx - w / 2, cy - h / 2, w, h, '#161a22', 2.4);
  g.strokeStyle = neon; g.lineWidth = 2.4; g.strokeRect(cx - w / 2 + 4, cy - h / 2 + 4, w - 8, h - 8);
  label(g, t, cx, cy + 1, size, letter);
}

/** Overlapping tile courses clipped to a quad: the slopes of a hipped roof. */
function tiles(g: G, pts: readonly [number, number][], base: string, k: number) {
  g.save(); g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath();
  g.fillStyle = shade(base, k); g.fill(); g.clip();
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  g.strokeStyle = 'rgba(20,8,6,0.35)'; g.lineWidth = 1.3; g.beginPath();
  for (let y = y0; y < y1; y += 10) { g.moveTo(x0, y + 0.5); g.lineTo(x1, y + 0.5); }
  for (let x = x0; x < x1; x += 12) { g.moveTo(x + 0.5, y0); g.lineTo(x + 0.5, y1); }
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.08)'; for (let y = y0; y < y1; y += 10) g.fillRect(x0, y + 2, x1 - x0, 1.5);
  g.restore();
  g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); ink(g, 1.6); g.stroke();
}

/** A hipped roof over the whole box: four tiled slopes, a ridge, curled corners. */
function hipRoof(g: G, b: B, base: string, ridge: string) {
  const inset = Math.min(b.w, b.h) * 0.42, my = b.y + b.h / 2;
  const L = b.x, R = b.x + b.w, T = b.y, Bo = b.y + b.h;
  tiles(g, [[L, T], [R, T], [R - inset, my - 6], [L + inset, my - 6]], base, 0.14);
  tiles(g, [[L, Bo], [R, Bo], [R - inset, my + 6], [L + inset, my + 6]], base, -0.18);
  tiles(g, [[L, T], [L + inset, my - 6], [L + inset, my + 6], [L, Bo]], base, 0.02);
  tiles(g, [[R, T], [R - inset, my - 6], [R - inset, my + 6], [R, Bo]], base, -0.08);
  slab(g, L + inset - 8, my - 7, b.w - 2 * inset + 16, 14, ridge, 2);
  g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(L + inset - 6, my - 5, b.w - 2 * inset + 12, 3);
  for (const [x, y, sx, sy] of [[L, T, -1, -1], [R, T, 1, -1], [L, Bo, -1, 1], [R, Bo, 1, 1]] as const) {
    g.fillStyle = ridge; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + sx * 14, y, x + sx * 18, y + sy * 12); g.lineTo(x + sx * 4, y + sy * 2); g.closePath(); g.fill(); ink(g, 1.4); g.stroke();
  }
}

function temple(g: G, b: B, d: District, rand: () => number) {
  if (d.id === 'temple') {
    hipRoof(g, b, '#a8402e', '#3f5a4a');
    const cx = b.x + b.w / 2, my = b.y + b.h / 2;
    // gold finials at the ridge ends and a pearl in the middle
    for (const x of [b.x + Math.min(b.w, b.h) * 0.42 - 8, b.x + b.w - Math.min(b.w, b.h) * 0.42 + 8]) { g.fillStyle = '#e8b84a'; g.beginPath(); g.arc(x, my, 10, 0, TAU); g.fill(); ink(g, 1.6); g.stroke(); }
    g.fillStyle = '#f4ecd0'; g.beginPath(); g.arc(cx, my, 8, 0, TAU); g.fill(); ink(g, 1.4); g.stroke();
    g.strokeStyle = '#e8b84a'; g.lineWidth = 3; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * 12, my); g.quadraticCurveTo(cx + s * 40, my - 18, cx + s * 70, my); g.stroke(); }
    sign(g, 'TEMPLE OF THE LANTERN', cx, b.y + b.h - 50, 20, '#e8b84a', '#f7e6a8');
    paperLantern(g, b.x + 40, b.y + b.h - 10, 13, '#d9482f'); paperLantern(g, b.x + b.w - 40, b.y + b.h - 10, 13, '#d9482f');
    // pigeons on the ridge
    for (let i = 0; i < 3; i++) { const x = cx + 60 + i * 16 + rand() * 4; g.fillStyle = '#b4b9c0'; g.beginPath(); g.ellipse(x, my - 2, 6, 4, 0.2, 0, TAU); g.fill(); ink(g, 1); g.stroke(); }
  } else {
    beerHall(g, b, d, rand);
  }
}

/** The temple's twin in the street-food quarter: a long tin beer hall with a smoking chimney and a sign. */
function beerHall(g: G, b: B, d: District, rand: () => number) {
  tin(g, b, '#8a5a3a', rand, true);
  const cx = b.x + b.w / 2;
  slab(g, b.x + b.w - 110, b.y + 40, 44, 44, '#4a4f58', 2); g.fillStyle = '#1c1f26'; g.beginPath(); g.arc(b.x + b.w - 88, b.y + 62, 14, 0, TAU); g.fill();
  for (let i = 0; i < 4; i++) { g.fillStyle = `rgba(70,64,60,${0.32 - i * 0.06})`; g.beginPath(); g.arc(b.x + b.w - 88 + i * 14, b.y + 50 - i * 22, 16 + i * 6, 0, TAU); g.fill(); }
  // a giant foaming mug painted on the tin
  const mx = b.x + 120, my = b.y + Math.max(80, b.h * 0.26);
  slab(g, mx - 34, my - 46, 68, 92, '#e8a93a', 2.4); g.fillStyle = '#f4ecd0'; g.beginPath(); for (let i = 0; i < 4; i++) g.arc(mx - 26 + i * 17, my - 46, 12, Math.PI, 0); g.fill(); ink(g, 2); g.stroke();
  g.strokeStyle = OUTLINE; g.lineWidth = 7; g.beginPath(); g.arc(mx + 38, my, 22, -1.2, 1.2); g.stroke(); g.strokeStyle = '#e8a93a'; g.lineWidth = 4; g.stroke();
  sign(g, 'BEER HALL', cx + 40, b.y + b.h - 54, 26, d.neon, d.neon2);
}

/** Corrugated tin over a box, with panel seams, rust and (optionally) a lit ridge vent. */
function tin(g: G, b: B, base: string, rand: () => number, vent: boolean) {
  g.fillStyle = base; g.fillRect(b.x, b.y, b.w, b.h);
  for (let x = b.x, i = 0; x < b.x + b.w; x += 7, i++) { g.fillStyle = i % 2 ? 'rgba(255,255,255,0.12)' : 'rgba(10,12,18,0.16)'; g.fillRect(x, b.y, 3.5, b.h); }
  g.fillStyle = 'rgba(10,12,18,0.3)'; for (let y = b.y + 90; y < b.y + b.h; y += 100) g.fillRect(b.x, y, b.w, 2.5);
  g.fillStyle = 'rgba(150,70,30,0.25)'; for (let k = 0; k < b.w * b.h / 8000; k++) g.fillRect(b.x + rand() * b.w, b.y + rand() * b.h, 2 + rand() * 4, 14 + rand() * 40);
  if (vent) { slab(g, b.x + 20, b.y + b.h / 2 - 9, b.w - 40, 18, shade(base, -0.4), 2); g.fillStyle = 'rgba(255,200,120,0.35)'; for (let x = b.x + 28; x < b.x + b.w - 30; x += 22) g.fillRect(x, b.y + b.h / 2 - 5, 12, 10); }
}

/** A sawtooth market roof: strips of tin, each with a lit skylight band along its north face. */
function bazaar(g: G, b: B, d: District, rand: () => number) {
  const food = d.id !== 'lantern';
  const base = food ? '#a8783a' : '#8a5a54';
  const n = Math.max(3, Math.round(b.h / 110)), sh = b.h / n;
  for (let i = 0; i < n; i++) {
    const y = b.y + i * sh;
    tin(g, { x: b.x, y, w: b.w, h: sh }, shade(base, -0.06 * (i % 2)), rand, false);
    g.fillStyle = 'rgba(255,214,140,0.55)'; g.fillRect(b.x + 6, y + 4, b.w - 12, 14);
    g.fillStyle = 'rgba(255,240,200,0.35)'; for (let x = b.x + 12; x < b.x + b.w - 12; x += 36) g.fillRect(x, y + 6, 22, 10);
    g.fillStyle = 'rgba(10,10,14,0.35)'; g.fillRect(b.x, y + sh - 8, b.w, 8);
    ink(g, 1.6); g.strokeRect(b.x, y, b.w, sh);
  }
  if (food) { // steam vents over the woks
    for (const x of [b.x + 90, b.x + b.w - 90]) { g.fillStyle = '#4a4f58'; g.beginPath(); g.arc(x, b.y + b.h * 0.4, 16, 0, TAU); g.fill(); ink(g, 2); g.stroke(); for (let i = 0; i < 3; i++) { g.fillStyle = `rgba(240,240,240,${0.3 - i * 0.08})`; g.beginPath(); g.arc(x + i * 8, b.y + b.h * 0.4 - 18 - i * 18, 12 + i * 5, 0, TAU); g.fill(); } }
  } else { // festival bunting from corner to corner
    for (const [x0, y0, x1, y1] of [[b.x, b.y, b.x + b.w, b.y + b.h], [b.x + b.w, b.y, b.x, b.y + b.h]] as const) {
      const n = 16;
      g.strokeStyle = 'rgba(20,18,16,0.8)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      for (let i = 1; i < n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t; g.fillStyle = ['#e5412d', '#ffd34d', '#3fe0d0', '#ff4fd0'][i % 4]!; g.beginPath(); g.moveTo(x - 7, y); g.lineTo(x + 7, y); g.lineTo(x, y + 13); g.closePath(); g.fill(); }
    }
  }
  sign(g, food ? 'FOOD HALL' : 'NIGHT BAZAAR', b.x + b.w / 2, b.y + b.h - 48, 30, d.neon, d.neon2);
}

/** The top deck of the multi-storey car park: bays, a few cars, the ramp, a stair tower and the big P. */
function parking(g: G, b: B, d: District, rand: () => number) {
  g.fillStyle = '#6d6f72'; g.fillRect(b.x, b.y, b.w, b.h);
  g.fillStyle = 'rgba(10,10,14,0.1)'; for (let k = 0; k < 60; k++) { g.beginPath(); g.ellipse(b.x + rand() * b.w, b.y + rand() * b.h, 10 + rand() * 30, 6 + rand() * 14, rand() * 3, 0, TAU); g.fill(); }
  // expansion joints
  g.fillStyle = 'rgba(20,20,24,0.3)'; for (let x = b.x + 200; x < b.x + b.w; x += 200) g.fillRect(x, b.y, 2, b.h); for (let y = b.y + 175; y < b.y + b.h; y += 175) g.fillRect(b.x, y, b.w, 2);
  // two rows of bays along the north and south parapets, the drive aisle between
  const bay = 70, bayL = 130;
  g.strokeStyle = 'rgba(245,240,220,0.75)'; g.lineWidth = 3;
  for (const [y0, dir] of [[b.y + 30, 1], [b.y + b.h - 30, -1]] as const) {
    for (let x = b.x + 40; x <= b.x + b.w - 40; x += bay) { g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y0 + dir * bayL); g.stroke(); }
  }
  // cars in some bays, seen from above
  const cols = ['#d9482f', '#e8e2d0', '#4f7fbf', '#2a2d34', '#e8a93a', '#6aa84a', '#9aa0a8'];
  for (const [y0, dir] of [[b.y + 30, 1], [b.y + b.h - 30, -1]] as const) {
    for (let x = b.x + 40, i = 0; x + bay <= b.x + b.w - 40; x += bay, i++) {
      if (rand() < 0.4) continue;
      const cx = x + bay / 2, cy = y0 + dir * bayL / 2, col = cols[Math.floor(rand() * cols.length)]!;
      g.fillStyle = 'rgba(10,10,14,0.35)'; rr(g, cx - 24, cy - 52, 52, 108, 12); g.fill();
      g.fillStyle = col; rr(g, cx - 26, cy - 56, 52, 108, 12); g.fill(); ink(g, 2); g.stroke();
      g.fillStyle = 'rgba(30,40,50,0.8)'; rr(g, cx - 20, cy - 32 * dir - (dir > 0 ? 0 : 0) - 10, 40, 22, 5); g.fill();
      g.fillStyle = 'rgba(30,40,50,0.65)'; rr(g, cx - 19, cy + 18 * dir - 8, 38, 16, 4); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(cx - 18, cy - 4, 36, 3);
      g.fillStyle = dir > 0 ? '#ffe9a8' : '#ff5a4a'; g.fillRect(cx - 22, cy + dir * 50 - 2, 9, 4); g.fillRect(cx + 13, cy + dir * 50 - 2, 9, 4);
    }
  }
  // direction arrows down the aisle and the ramp at the east end
  g.fillStyle = 'rgba(245,240,220,0.7)';
  for (let x = b.x + 250; x < b.x + b.w - 120; x += 160) { const y = b.y + b.h / 2; g.beginPath(); g.moveTo(x, y - 8); g.lineTo(x + 40, y - 8); g.lineTo(x + 40, y - 18); g.lineTo(x + 62, y); g.lineTo(x + 40, y + 18); g.lineTo(x + 40, y + 8); g.lineTo(x, y + 8); g.closePath(); g.fill(); }
  const rx = b.x + 90, ry = b.y + b.h / 2 - 70;
  g.fillStyle = '#55575a'; g.fillRect(rx, ry, 120, 140);
  g.fillStyle = 'rgba(0,0,0,0.2)'; for (let k = 0; k < 7; k++) g.fillRect(rx, ry + k * 20, 120, 8);
  g.fillStyle = '#e8c23a'; for (let k = 0; k < 7; k++) { g.save(); g.beginPath(); g.rect(rx, ry - 4, 120, 6); g.clip(); g.fillRect(rx + k * 20, ry - 4, 10, 6); g.restore(); }
  ink(g, 2); g.strokeRect(rx, ry, 120, 140);
  label(g, 'DOWN', rx + 60, ry + 70, 18, 'rgba(245,240,220,0.8)');
  // stair tower in the north-west corner and the big P on the parapet
  slab(g, b.x + 6, b.y + 6, 70, 70, '#8a8c8e', 2.4); g.fillStyle = '#5a5c5e'; g.fillRect(b.x + 14, b.y + 14, 54, 54); label(g, 'EXIT', b.x + 41, b.y + 41, 14, '#9be36a');
  const px = b.x + b.w / 2, py = b.y + b.h / 2;
  g.fillStyle = 'rgba(79,127,191,0.25)'; g.beginPath(); g.arc(px, py, 70, 0, TAU); g.fill();
  slab(g, px - 46, py - 46, 92, 92, '#2f5fa8', 3); label(g, 'P', px, py + 3, 74, '#f4f4f0');
  label(g, d.id === 'fish' ? 'ICE TRUCKS ONLY' : 'LEVEL 3 · ROOF', px, py + 66, 16, 'rgba(245,240,220,0.75)');
  // parapet
  g.strokeStyle = '#8f9194'; g.lineWidth = 12; g.strokeRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
  g.strokeStyle = 'rgba(232,194,58,0.9)'; g.lineWidth = 3; g.setLineDash([16, 16]); g.strokeRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12); g.setLineDash([]);
}

/** The arcade's flat roof: huge neon letters, an invader, a/c plant. Its twin in the fish market is a tin fish hall with a neon fish. */
function arcade(g: G, b: B, d: District, rand: () => number) {
  if (d.id === 'fish') {
    tin(g, b, '#6f8a96', rand, true);
    const cx = b.x + b.w / 2, cy = b.y + b.h * 0.34;
    g.strokeStyle = hexA('#6fd8ff', 0.25); g.lineWidth = 18; g.beginPath(); g.ellipse(cx, cy, 120, 50, 0, 0, TAU); g.stroke();
    g.fillStyle = 'rgba(14,26,34,0.85)'; g.beginPath(); g.ellipse(cx, cy, 120, 50, 0, 0, TAU); g.fill();
    g.strokeStyle = '#6fd8ff'; g.lineWidth = 5; g.beginPath(); g.ellipse(cx, cy, 120, 50, 0, 0, TAU); g.moveTo(cx + 116, cy); g.lineTo(cx + 180, cy - 48); g.lineTo(cx + 180, cy + 48); g.closePath(); g.stroke();
    g.fillStyle = '#e9fbff'; g.beginPath(); g.arc(cx - 80, cy - 12, 7, 0, TAU); g.fill();
    for (let i = 0; i < 6; i++) fish(g, b.x + 60 + i * 90, b.y + b.h - 110 + (i % 2) * 14, 30, ['#9db4c4', '#c9a97c', '#b9c5cc'][i % 3]!, i % 2 ? 1 : -1);
    sign(g, 'FISH HALL', cx, b.y + b.h - 48, 30, d.neon, d.neon2);
    return;
  }
  g.fillStyle = '#2c313c'; g.fillRect(b.x, b.y, b.w, b.h);
  g.fillStyle = 'rgba(255,255,255,0.04)'; for (let y = b.y; y < b.y + b.h; y += 24) g.fillRect(b.x, y, b.w, 12);
  // a/c plant and ducts
  for (let i = 0; i < 4; i++) { const x = b.x + 40 + i * 70, y = b.y + 30; slab(g, x, y, 54, 40, '#8f979f', 2); g.fillStyle = '#5d646c'; g.beginPath(); g.arc(x + 27, y + 20, 14, 0, TAU); g.fill(); ink(g, 1.5); g.stroke(); }
  g.strokeStyle = '#7a828a'; g.lineWidth = 10; g.beginPath(); g.moveTo(b.x + 60, b.y + 80); g.lineTo(b.x + 60, b.y + b.h - 160); g.lineTo(b.x + 200, b.y + b.h - 160); g.stroke();
  // ARCADE in giant tubes, letter by letter in alternating colours
  const word = 'ARCADE', cx = b.x + b.w / 2 + 40, cy = b.y + b.h / 2;
  g.font = font(96); g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 16; g.strokeStyle = 'rgba(63,224,224,0.18)'; g.strokeText(word, cx, cy);
  g.lineWidth = 4; g.strokeStyle = '#3fe0e0'; g.strokeText(word, cx, cy);
  g.fillStyle = 'rgba(255,79,208,0.85)'; g.fillText(word, cx, cy);
  // the invader
  const rows = ['00100000100', '00010001000', '00111111100', '01101110110', '11111111111', '10111111101', '10100000101', '00011011000'];
  const ix = b.x + b.w - 150, iy = b.y + 40;
  g.fillStyle = '#9be36a'; rows.forEach((r, j) => [...r].forEach((c, i) => { if (c === '1') g.fillRect(ix + i * 9, iy + j * 9, 9, 9); }));
  sign(g, 'HI-SCORE  AAA 99870', cx, b.y + b.h - 44, 18, '#ff4fd0', '#3fe0e0');
}

/** The produce market's canopy: broad stripes of canvas in the district's awning colours, sagging between the poles. */
function canopy(g: G, b: B, d: District) {
  const sw = 50;
  for (let x = b.x, i = 0; x < b.x + b.w; x += sw, i++) { g.fillStyle = d.awn[i % 2]!; g.fillRect(x, b.y, Math.min(sw, b.x + b.w - x), b.h); }
  // sag: lighter where the canvas rises over the poles, darker between
  for (let y = b.y, j = 0; y < b.y + b.h; y += 150, j++) {
    const gr = g.createLinearGradient(0, y, 0, y + 150);
    gr.addColorStop(0, 'rgba(255,250,230,0.16)'); gr.addColorStop(0.5, 'rgba(10,10,14,0.18)'); gr.addColorStop(1, 'rgba(255,250,230,0.16)');
    g.fillStyle = gr; g.fillRect(b.x, y, b.w, 150);
    g.fillStyle = OUTLINE; for (let x = b.x + 100; x < b.x + b.w; x += 200) { g.beginPath(); g.arc(x, y, 5, 0, TAU); g.fill(); }
  }
  ink(g, 2.4); g.strokeRect(b.x, b.y, b.w, b.h);
  // the scalloped valance all round
  for (let x = b.x, i = 0; x < b.x + b.w; x += 20, i++) { g.fillStyle = d.awn[i % 2]!; g.beginPath(); g.arc(x + 10, b.y + b.h, 10, 0, Math.PI); g.fill(); ink(g, 1.2); g.stroke(); }
  sign(g, d.id === 'produce' ? 'COVERED MARKET · FRUIT & VEG' : 'SPICE BAZAAR · BY WEIGHT', b.x + b.w / 2, b.y + b.h / 2, 20, d.neon, d.neon2);
}

/** The tarps strung over a narrow alley: overlapping plastic sheets, a seam of light where two meet. */
function tarp(g: G, b: B, d: District, rand: () => number) {
  const cols = ['#3f7fbf', '#c0392b', '#d9a548', '#4f8a5e', d.awn[0]];
  const vertical = b.h >= b.w;
  const len = vertical ? b.h : b.w;
  for (let at = 0; at < len;) {
    const step = 80 + rand() * 70, n = Math.min(step + 10, len - at), col = cols[Math.floor(rand() * cols.length)]!;
    const r = vertical ? { x: b.x - 4, y: b.y + at, w: b.w + 8, h: n } : { x: b.x + at, y: b.y - 4, w: n, h: b.h + 8 };
    g.globalAlpha = 0.92; g.fillStyle = col; g.fillRect(r.x, r.y, r.w, r.h); g.globalAlpha = 1;
    g.fillStyle = 'rgba(255,255,255,0.12)'; if (vertical) g.fillRect(r.x, r.y, r.w, 6); else g.fillRect(r.x, r.y, 6, r.h);
    g.strokeStyle = 'rgba(10,10,14,0.4)'; g.lineWidth = 1; g.beginPath(); for (let k = 1; k < 4; k++) { if (vertical) { g.moveTo(r.x + (r.w * k) / 4, r.y); g.lineTo(r.x + (r.w * k) / 4 + 3, r.y + r.h); } else { g.moveTo(r.x, r.y + (r.h * k) / 4); g.lineTo(r.x + r.w, r.y + (r.h * k) / 4 + 3); } } g.stroke();
    ink(g, 1.6); g.strokeRect(r.x, r.y, r.w, r.h);
    at += step;
  }
  // a lantern glows through the plastic every so often
  for (let at = 60; at < len - 30; at += 120) { const x = vertical ? b.x + b.w / 2 : b.x + at, y = vertical ? b.y + at : b.y + b.h / 2; g.fillStyle = hexA(d.lantern, 0.35); g.beginPath(); g.arc(x, y, 22, 0, TAU); g.fill(); paperLantern(g, x, y, 8, d.lantern); }
}

const PAINT: Record<string, (g: G, b: B, d: District, rand: () => number) => void> = { temple, bazaar, parking, arcade, canopy: (g, b, d) => canopy(g, b, d), tarp };

const cache = new Map<string, HTMLCanvasElement | null>();
/** The baked rooftop of `r`, or null when this theme has no painter for its material. */
export function marketRoofSprite(r: MapRoof): HTMLCanvasElement | null {
  const hit = cache.get(r.id);
  if (hit !== undefined) return hit;
  const paint = r.material ? PAINT[r.material] : undefined;
  const bb = boundsOf(r.points);
  let c: HTMLCanvasElement | null = null;
  if (paint && typeof document !== 'undefined') {
    c = document.createElement('canvas');
    c.width = Math.ceil(bb.w) + 2 * MARGIN; c.height = Math.ceil(bb.h) + 2 * MARGIN;
    const g = c.getContext('2d')!;
    g.translate(MARGIN - bb.x, MARGIN - bb.y);
    const d = districtAt(bb.x + bb.w / 2, bb.y + bb.h / 2);
    // the eave's shadow on the street, then the roof itself
    g.fillStyle = 'rgba(8,10,14,0.35)'; g.fillRect(bb.x + 6, bb.y + 10, bb.w, bb.h);
    paint(g, bb, d, seeded((hash(bb.x, bb.y) * 4294967296) >>> 0));
    ink(g, 2.4); g.strokeRect(bb.x, bb.y, bb.w, bb.h);
  }
  cache.set(r.id, c);
  return c;
}
export const ROOF_MARGIN = MARGIN;
