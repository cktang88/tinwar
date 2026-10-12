import type { MapDef } from '../../shared/maps.ts';
import { CRANES, PIT, POND } from '../../shared/maps/quarrygeo.ts';
import { setLight } from '../lighting.ts';
import { C, FONT, SIZE, TAU, at, both, box, disc, hexA, shade, text, turn } from './quarrykit.ts';
import type { ThemeView } from './registry.ts';

/**
 * The Quarry's small stories and everything that moves. Baked into the floor: a quarryman's lunch left on a block, the site
 * dog's kennel, the canteen's picnic bench and smokers' bucket, a wheelbarrow of spoil, the tyre stack, chalk graffiti on the
 * block yard's slabs, the lifebuoy by the pond. Three eggs for anyone who looks: an ammonite in the pit floor, a trail of
 * three-toed footprints across the middle bench, and a canary in its cage by the control cabin. Live: the tower crane slowly
 * swinging a block on its slings, the blasting siren's lamp, dust off the crusher, the lighting towers, and the signs.
 * Every motion is slow (nothing above 1 Hz) and holds still under `prefers-reduced-motion`.
 */
type G = CanvasRenderingContext2D;
const calm = (() => { try { return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } })();
const clock = (now: number) => (calm ? 4000 : now);
const inView = (v: ThemeView, x: number, y: number, r: number) => x + r >= v.x0 && x - r <= v.x1 && y + r >= v.y0 && y - r <= v.y1;

/* ------------------------------------------------------------ baked vignettes */

/** A quarryman's lunch on the ground by a block: hard hat, flask, an open sandwich box, a newspaper. */
function lunch(g: G, x: number, y: number) {
  at(g, x, y, -0.2, () => { shade(g, 0, 0, 30, 14); box(g, -34, -12, 38, 26, '#e2dccb', 1.4); g.fillStyle = 'rgba(40, 40, 40, 0.5)'; for (let k = 0; k < 4; k++) g.fillRect(-30, -8 + k * 5, 30, 1.6); });
  shade(g, x + 22, y + 4, 16, 10); disc(g, x + 22, y + 2, 14, C.hivis, 1.8); g.fillStyle = C.hivisHi; g.beginPath(); g.arc(x + 18, y - 2, 6, 0, TAU); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x + 8, y + 2); g.lineTo(x + 36, y + 2); g.stroke();
  disc(g, x + 2, y + 22, 6, C.cabinBlue, 1.4); disc(g, x + 2, y + 22, 3, C.steelHi, 1);
  box(g, x - 22, y + 14, 18, 12, '#6a4a3a', 1.4); g.fillStyle = '#e8d8a8'; g.fillRect(x - 20, y + 16, 7, 8); g.fillStyle = '#7a9a4e'; g.fillRect(x - 12, y + 16, 6, 8);
}

/** The site dog's kennel, named on its gable, a bowl, a chewed hard hat. */
function kennel(g: G, x: number, y: number) {
  shade(g, x, y + 4, 34, 26);
  box(g, x - 30, y - 24, 60, 48, C.wood, 2); g.fillStyle = C.woodHi; g.fillRect(x - 30, y - 24, 60, 8); g.fillStyle = C.woodLo; g.fillRect(x - 2, y - 24, 4, 48);
  g.fillStyle = '#2a2420'; g.beginPath(); g.ellipse(x, y + 24, 12, 6, 0, Math.PI, 0); g.fill();
  text(g, 'BISCUIT', x, y - 3, 14, C.bone, 0, 1);
  disc(g, x + 44, y + 18, 8, C.red, 1.4); g.fillStyle = '#8a6a3a'; g.beginPath(); g.arc(x + 44, y + 18, 4, 0, TAU); g.fill();
  disc(g, x - 46, y + 20, 10, C.hivis, 1.4); g.fillStyle = 'rgba(28, 31, 38, 0.5)'; g.fillRect(x - 52, y + 18, 5, 3);
}

/** The canteen's picnic bench with mugs, and the smokers' sand bucket. */
function picnic(g: G, x: number, y: number) {
  shade(g, x, y, 64, 34);
  box(g, x - 60, y - 34, 120, 12, C.woodLo, 1.6); box(g, x - 60, y + 22, 120, 12, C.woodLo, 1.6); box(g, x - 64, y - 16, 128, 32, C.wood, 2);
  g.fillStyle = 'rgba(0, 0, 0, 0.2)'; for (let k = 1; k < 4; k++) g.fillRect(x - 64, y - 16 + k * 8, 128, 1.4);
  for (const [dx, col] of [[-30, C.bone], [-6, C.red], [26, C.cabinBlue]] as const) { disc(g, x + dx, y - 2, 6, col, 1.2); g.fillStyle = '#3a2a1a'; g.beginPath(); g.arc(x + dx, y - 2, 3.4, 0, TAU); g.fill(); }
  disc(g, x + 92, y + 6, 12, C.red, 1.8); g.fillStyle = C.sand; g.beginPath(); g.arc(x + 92, y + 6, 8, 0, TAU); g.fill();
  g.strokeStyle = C.bone; g.lineWidth = 2; for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(x + 86 + k * 3, y + 3 + (k % 2) * 4); g.lineTo(x + 88 + k * 3, y + 9); g.stroke(); }
}

function wheelbarrow(g: G, x: number, y: number, r: number) {
  at(g, x, y, r, () => {
    shade(g, 0, 0, 30, 16);
    g.strokeStyle = C.ink; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(-40, -10); g.lineTo(10, -8); g.moveTo(-40, 10); g.lineTo(10, 8); g.stroke();
    g.strokeStyle = C.steelLo; g.lineWidth = 2.4; g.stroke();
    g.fillStyle = C.cabinGreen; g.beginPath(); g.moveTo(-22, -16); g.lineTo(18, -14); g.lineTo(24, 0); g.lineTo(18, 14); g.lineTo(-22, 16); g.closePath(); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 1.8; g.stroke();
    for (let i = 0; i < 9; i++) disc(g, -14 + (i % 3) * 11, -8 + Math.floor(i / 3) * 8, 4, i % 2 ? C.gravel : C.gravelHi, 1);
    disc(g, 30, 0, 7, C.rubber, 1.6);
  });
}

function tyres(g: G, x: number, y: number) {
  for (const [dx, dy, r] of [[0, 0, 30], [44, 10, 30], [20, 40, 26]] as const) { shade(g, x + dx, y + dy, r, r * 0.9); disc(g, x + dx, y + dy, r, C.rubber, 2); disc(g, x + dx, y + dy, r * 0.48, '#4a4e54', 1.6); g.strokeStyle = 'rgba(120, 124, 130, 0.4)'; g.lineWidth = 2; g.beginPath(); g.arc(x + dx, y + dy, r * 0.75, 0, TAU); g.stroke(); }
}

/** Chalk on a slab: a stick-figure quarryman with his pick, his name, and the tally of blasts he has seen. */
function chalk(g: G, x: number, y: number, name: string) {
  g.save(); g.translate(x, y); g.globalAlpha = 0.75; g.strokeStyle = C.bone; g.lineWidth = 3; g.lineCap = 'round';
  g.beginPath(); g.arc(0, -30, 8, 0, TAU); g.moveTo(0, -22); g.lineTo(0, 4); g.moveTo(0, 4); g.lineTo(-10, 24); g.moveTo(0, 4); g.lineTo(10, 24); g.moveTo(0, -14); g.lineTo(16, -22); g.moveTo(0, -14); g.lineTo(-12, -6); g.stroke();
  g.beginPath(); g.moveTo(10, -34); g.lineTo(24, -12); g.moveTo(4, -28); g.quadraticCurveTo(18, -40, 30, -30); g.stroke();
  g.fillStyle = C.bone; g.font = FONT(22); g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(name, 30, 0);
  for (let k = 0; k < 3; k++) { for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(32 + k * 22 + i * 4, 16); g.lineTo(32 + k * 22 + i * 4, 30); g.stroke(); } g.beginPath(); g.moveTo(29 + k * 22, 27); g.lineTo(47 + k * 22, 18); g.stroke(); }
  g.restore();
}

function lifebuoy(g: G, x: number, y: number) {
  shade(g, x, y, 22, 20);
  g.lineWidth = 10; for (let k = 0; k < 4; k++) { g.strokeStyle = k % 2 ? C.bone : C.orange; g.beginPath(); g.arc(x, y, 17, (k / 4) * TAU, ((k + 1) / 4) * TAU); g.stroke(); }
  g.strokeStyle = C.ink; g.lineWidth = 1.6; g.beginPath(); g.arc(x, y, 22, 0, TAU); g.stroke(); g.beginPath(); g.arc(x, y, 12, 0, TAU); g.stroke();
  box(g, x - 4, y - 44, 8, 26, C.wood, 1.4);
}

/** An ammonite the saw cut clean through, a spiral of chambers in the pit floor. */
function ammonite(g: G, x: number, y: number) {
  g.save(); g.translate(x, y);
  g.fillStyle = 'rgba(220, 210, 180, 0.32)'; g.beginPath(); g.arc(0, 0, 34, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(70, 60, 44, 0.7)'; g.lineWidth = 2.6; g.beginPath();
  for (let t = 0; t < 4.2 * Math.PI; t += 0.1) { const r = 3 + t * 2.3; g.lineTo(Math.cos(t) * r, Math.sin(t) * r); }
  g.stroke();
  g.lineWidth = 1.4; for (let t = 1; t < 4.2 * Math.PI; t += 0.5) { const r = 3 + t * 2.3; g.beginPath(); g.moveTo(Math.cos(t) * r, Math.sin(t) * r); g.lineTo(Math.cos(t) * (r - 6), Math.sin(t) * (r - 6)); g.stroke(); }
  g.restore();
}

/** Three-toed prints walking across the bench: something big came this way long before the quarry. */
function footprints(g: G, x0: number, y0: number, x1: number, y1: number) {
  const n = 9, ang = Math.atan2(y1 - y0, x1 - x0);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), side = i % 2 ? 1 : -1;
    const x = x0 + (x1 - x0) * t - Math.sin(ang) * side * 22, y = y0 + (y1 - y0) * t + Math.cos(ang) * side * 22;
    at(g, x, y, ang, () => {
      g.fillStyle = 'rgba(40, 40, 42, 0.38)';
      g.beginPath(); g.ellipse(-4, 0, 11, 9, 0, 0, TAU); g.fill();
      for (const a of [-0.55, 0, 0.55]) { g.beginPath(); g.ellipse(Math.cos(a) * 18, Math.sin(a) * 14, 9, 3.6, a, 0, TAU); g.fill(); }
    });
  }
}

/** A canary in its cage, hung on a post: the old miners' gas alarm, kept for luck. */
function canary(g: G, x: number, y: number) {
  shade(g, x, y + 8, 18, 10);
  box(g, x - 3, y - 4, 6, 26, C.woodLo, 1.2);
  g.strokeStyle = C.steelHi; g.lineWidth = 1.6; g.beginPath(); g.arc(x, y - 12, 15, 0, TAU); g.stroke();
  for (let k = -12; k <= 12; k += 6) { g.beginPath(); g.moveTo(x + k, y - 12 - Math.sqrt(225 - k * k)); g.lineTo(x + k, y - 12 + Math.sqrt(225 - k * k)); g.stroke(); }
  disc(g, x + 1, y - 11, 5.5, '#f2d23c', 1.2); disc(g, x + 5, y - 15, 3.4, '#f2d23c', 1); g.fillStyle = C.orange; g.beginPath(); g.moveTo(x + 8, y - 15); g.lineTo(x + 11, y - 14); g.lineTo(x + 8, y - 13); g.fill();
}

/** A dropped pallet of bagged sand. */
function bags(g: G, x: number, y: number, r: number) {
  at(g, x, y, r, () => {
    shade(g, 0, 0, 44, 30); box(g, -42, -30, 84, 60, C.woodLo, 1.8);
    for (let i = 0; i < 6; i++) { const bx = -38 + (i % 3) * 26, by = -26 + Math.floor(i / 3) * 27; g.fillStyle = i % 2 ? '#d8cfb8' : '#cbc2a8'; g.beginPath(); g.roundRect(bx, by, 24, 24, 5); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 1.2; g.stroke(); g.fillStyle = C.red; g.fillRect(bx + 4, by + 9, 16, 4); }
  });
}

const WEST: readonly [(g: G, x: number, y: number) => void, number, number][] = [
  [lunch, 1470, 2770], [kennel, 1000, 2080], [picnic, 1300, 1720], [(g, x, y) => wheelbarrow(g, x, y, 0.4), 1720, 3560],
  [tyres, 980, 340], [(g, x, y) => chalk(g, x, y, 'STAN'), 1130, 5810], [lifebuoy, 1010, 5560], [canary, 2060, 820],
  [(g, x, y) => bags(g, x, y, 0.15), 1900, 1450], [(g, x, y) => bags(g, x, y, -0.3), 180, 3700],
];

export function paintQuarryDecor(g: G): void {
  g.save();
  for (const [fn, x, y] of WEST) fn(g, x, y);
  // the half-turn's own few, a little different
  const T = (x: number, y: number) => turn({ x, y });
  { const p = T(1470, 2770); lunch(g, p.x + 30, p.y - 10); }
  { const p = T(1300, 1720); picnic(g, p.x, p.y); }
  { const p = T(980, 340); tyres(g, p.x, p.y); }
  { const p = T(1130, 5810); chalk(g, p.x - 80, p.y, 'MO'); }
  { const p = T(1010, 5560); lifebuoy(g, p.x, p.y); }
  { const p = T(1720, 3560); wheelbarrow(g, p.x, p.y, 2.6); }
  { const p = T(1900, 1450); bags(g, p.x, p.y, 0.5); }
  ammonite(g, 2760, 3290);
  footprints(g, 3700, 3820, 4080, 3380);
  g.restore();
}

/* ------------------------------------------------------------ signs */

type Sign = { x: number; y: number; text: string; sub?: string; tone: 'amber' | 'red' | 'green' | 'white' };
const TONE: Record<Sign['tone'], { bg: string; fg: string; edge: string }> = {
  amber: { bg: '#2f343c', fg: '#ffb347', edge: '#ffb347' }, red: { bg: '#e2dccb', fg: '#b8432f', edge: '#b8432f' },
  green: { bg: '#2f6a4a', fg: '#e2dccb', edge: '#e2dccb' }, white: { bg: '#2f343c', fg: '#ece6d6', edge: '#8a8f98' },
};
const SIGNS: readonly (Sign & { twin?: Partial<Sign> })[] = [
  { x: 1400, y: 175, text: 'PRIMARY CRUSHER', sub: 'NOISE ZONE  ·  EAR DEFENDERS', tone: 'amber', twin: { text: 'SCREENING PLANT' } },
  { x: 470, y: 1295, text: 'SITE OFFICE', sub: 'ALL VISITORS REPORT HERE', tone: 'green', twin: { text: 'ENGINEERS', sub: 'PERMITS TO WORK' } },
  { x: 1000, y: 2040, text: 'DAYS WITHOUT AN ACCIDENT: 0', tone: 'white', twin: { text: 'DAYS WITHOUT AN ACCIDENT: 1' } },
  { x: 520, y: 4935, text: 'DANGER  ·  EXPLOSIVES', sub: 'NO SMOKING  ·  NO NAKED FLAME', tone: 'red', twin: { text: 'DANGER  ·  DETONATORS' } },
  { x: 1720, y: 4140, text: 'HAUL ROAD', sub: 'GIVE WAY TO LOADED TRUCKS', tone: 'amber' },
  { x: 1350, y: 5575, text: 'NO SWIMMING', sub: 'DEEP COLD WATER', tone: 'red' },
  { x: 700, y: 4030, text: 'WEIGHBRIDGE  ·  STOP', tone: 'amber', twin: { text: 'GATEHOUSE  ·  STOP' } },
  { x: 1240, y: 2560, text: 'PIT EDGE', sub: 'KEEP 5 M BACK', tone: 'red' },
];
const SIGN_LIST: readonly Sign[] = [...SIGNS, ...SIGNS.map((s) => ({ ...s, ...turn(s), ...s.twin }))];
const signSprites = new Map<string, HTMLCanvasElement>();
function signSprite(s: Sign): HTMLCanvasElement {
  const key = `${s.text}|${s.sub ?? ''}|${s.tone}`;
  let c = signSprites.get(key);
  if (c) return c;
  const size = 18, h = size + 14 + (s.sub ? 13 : 0), t = TONE[s.tone];
  c = document.createElement('canvas');
  const g = c.getContext('2d')!;
  const setFont = (px: number) => { g.font = FONT(px, 700); (g as unknown as { letterSpacing: string }).letterSpacing = '2px'; };
  setFont(size);
  let w = g.measureText(s.text).width;
  if (s.sub) { setFont(11); w = Math.max(w, g.measureText(s.sub).width); }
  w = Math.ceil(w) + 28;
  c.width = w + 8; c.height = h + 22;
  g.strokeStyle = C.ink; g.lineWidth = 3; g.beginPath(); g.moveTo(14, 0); g.lineTo(14, 14); g.moveTo(w - 6, 0); g.lineTo(w - 6, 14); g.stroke();
  g.strokeStyle = '#8a8f98'; g.lineWidth = 1.4; g.stroke();
  g.fillStyle = 'rgba(16, 18, 24, 0.3)'; g.fillRect(7, 17, w, h);
  g.fillStyle = t.bg; g.fillRect(4, 14, w, h);
  g.strokeStyle = t.edge; g.lineWidth = 2.2; g.strokeRect(7, 17, w - 6, h - 6);
  g.strokeStyle = C.ink; g.lineWidth = 2; g.strokeRect(4, 14, w, h);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  setFont(size); g.fillStyle = t.fg; g.fillText(s.text, 4 + w / 2, 14 + 4 + size / 2 + 2);
  if (s.sub) { setFont(11); g.fillStyle = hexA(t.fg, 0.8); g.fillText(s.sub, 4 + w / 2, 14 + h - 9); }
  signSprites.set(key, c);
  return c;
}

/* ------------------------------------------------------------ the living part */

/** Mobile lighting towers round the rim and the works, and the cabins' windows. */
const TOWERS = both([{ x: 1250, y: 2950 }, { x: 2250, y: 1450 }, { x: 1950, y: 4550 }, { x: 650, y: 950 }, { x: 2350, y: 5500 }]);
const GLOWS = both([{ x: 420, y: 1500, c: '#ffe2b0' }, { x: 1000, y: 1600, c: '#ffd28a' }, { x: 1860, y: 780, c: '#cfe3ff' }, { x: 1230, y: 4130, c: '#ffe2b0' }, { x: 2450, y: 1080, c: '#e8fff0' }, { x: 500, y: 400, c: '#cfe3ff' }]);
const SIREN = both([{ x: 820, y: 4960 }]);
const CRUSHER = both([{ x: 1400, y: 400 }]);

export function quarryUnder(ctx: CanvasRenderingContext2D, now: number, view: ThemeView, _map: MapDef) {
  const t = clock(now);
  TOWERS.forEach((p, i) => { if (inView(view, p.x, p.y, 700)) setLight(`qy:tower:${i}`, { x: p.x, y: p.y - 40, radius: 620, color: '#fff0cc', intensity: 0.55, size: 12, shadows: false }); });
  GLOWS.forEach((p, i) => { if (inView(view, p.x, p.y, 300)) setLight(`qy:win:${i}`, { x: p.x, y: p.y, radius: 260, color: p.c, intensity: 0.42, size: 24, shadows: false }); });
  SIREN.forEach((p, i) => {
    if (!inView(view, p.x, p.y, 300)) return;
    const on = calm || Math.floor(t / 900 + i) % 2 === 0;
    setLight(`qy:siren:${i}`, { x: p.x, y: p.y - 60, radius: 240, color: '#ff4a3a', intensity: on ? 0.6 : 0.12, size: 8, shadows: false });
  });
  // tower bases
  for (const p of TOWERS) {
    if (!inView(view, p.x, p.y, 60)) continue;
    ctx.fillStyle = 'rgba(16, 18, 24, 0.3)'; ctx.fillRect(p.x - 22, p.y - 6, 50, 26);
    ctx.fillStyle = C.hivis; ctx.fillRect(p.x - 26, p.y - 12, 52, 26); ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.strokeRect(p.x - 26, p.y - 12, 52, 26);
    ctx.fillStyle = C.rubber; ctx.fillRect(p.x - 30, p.y - 10, 6, 10); ctx.fillRect(p.x + 24, p.y - 10, 6, 10);
  }
}

function crane(ctx: G, c: { x: number; y: number; jib: number }, t: number, k: number) {
  const a = calm ? 0.6 + k * Math.PI : t * 0.00007 + k * Math.PI;
  const jx = c.x + Math.cos(a) * c.jib, jy = c.y + Math.sin(a) * c.jib, bx = c.x - Math.cos(a) * 240, by = c.y - Math.sin(a) * 240;
  const lift = 90;
  ctx.save();
  // the jib's shadow on the ground far below, then the lattice jib and counter-jib up high
  ctx.strokeStyle = 'rgba(16, 18, 24, 0.16)'; ctx.lineWidth = 22; ctx.beginPath(); ctx.moveTo(bx + 120, by + 160); ctx.lineTo(jx + 120, jy + 160); ctx.stroke();
  ctx.translate(0, -lift);
  // high overhead, so a body under it still reads through
  ctx.globalAlpha *= 0.8;
  const nx = -Math.sin(a) * 11, ny = Math.cos(a) * 11;
  ctx.fillStyle = C.hivis; ctx.beginPath(); ctx.moveTo(bx + nx, by + ny); ctx.lineTo(jx + nx * 0.5, jy + ny * 0.5); ctx.lineTo(jx - nx * 0.5, jy - ny * 0.5); ctx.lineTo(bx - nx, by - ny); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = C.hivisLo; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let s = 0; s < 1; s += 0.04) {
    const x0 = bx + (jx - bx) * s, y0 = by + (jy - by) * s, x1 = bx + (jx - bx) * (s + 0.04), y1 = by + (jy - by) * (s + 0.04), w = 1 - s * 0.5;
    ctx.moveTo(x0 + nx * w, y0 + ny * w); ctx.lineTo(x1 - nx * w, y1 - ny * w);
  }
  ctx.stroke();
  // counterweights, the cab, the trolley; the hook hangs to the ground with a block in slings
  const cw = { x: c.x - Math.cos(a) * 200, y: c.y - Math.sin(a) * 200 };
  ctx.save(); ctx.translate(cw.x, cw.y); ctx.rotate(a); ctx.fillStyle = C.concrete; ctx.fillRect(-36, -18, 52, 36); ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.strokeRect(-36, -18, 52, 36); ctx.beginPath(); ctx.moveTo(-18, -18); ctx.lineTo(-18, 18); ctx.moveTo(0, -18); ctx.lineTo(0, 18); ctx.stroke(); ctx.restore();
  ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(a); ctx.fillStyle = C.cabin; ctx.fillRect(-10, 12, 26, 20); ctx.fillStyle = C.glass; ctx.fillRect(6, 14, 8, 16); ctx.strokeStyle = C.ink; ctx.lineWidth = 1.6; ctx.strokeRect(-10, 12, 26, 20); ctx.restore();
  const tr = 0.55 + (calm ? 0 : 0.2 * Math.sin(t * 0.00011 + k)), tx = c.x + Math.cos(a) * c.jib * tr, ty = c.y + Math.sin(a) * c.jib * tr;
  ctx.fillStyle = C.steelDark; ctx.fillRect(tx - 12, ty - 12, 24, 24); ctx.strokeStyle = C.ink; ctx.lineWidth = 1.6; ctx.strokeRect(tx - 12, ty - 12, 24, 24);
  ctx.restore();
  // the cable down to the load, the load in its slings swinging a touch
  const sway = calm ? 0 : Math.sin(t * 0.0009 + k) * 6;
  ctx.strokeStyle = C.steelDark; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(tx, ty - lift); ctx.lineTo(tx + sway, ty - 18); ctx.stroke();
  ctx.save(); ctx.translate(tx + sway, ty); ctx.rotate(a);
  ctx.fillStyle = 'rgba(16, 18, 24, 0.3)'; ctx.fillRect(-26, -16, 58, 40);
  ctx.fillStyle = C.lime; ctx.fillRect(-30, -20, 60, 40); ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.strokeRect(-30, -20, 60, 40);
  ctx.strokeStyle = C.orange; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-14, -20); ctx.lineTo(-14, 20); ctx.moveTo(14, -20); ctx.lineTo(14, 20); ctx.stroke();
  ctx.restore();
}

function dust(ctx: G, x: number, y: number, t: number, k: number) {
  for (let i = 0; i < 6; i++) {
    const u = calm ? i / 6 : ((t * 0.00008 + i / 6 + k * 0.37) % 1);
    const px = x + u * 260 + Math.sin(u * 5 + i) * 20, py = y - u * 80 + Math.cos(u * 4 + i) * 16, r = 24 + u * 70;
    const gr = ctx.createRadialGradient(px, py, 2, px, py, r);
    gr.addColorStop(0, `rgba(214, 206, 188, ${(0.22 * (1 - u)).toFixed(3)})`); gr.addColorStop(1, 'rgba(214, 206, 188, 0)');
    ctx.fillStyle = gr; ctx.fillRect(px - r, py - r, r * 2, r * 2);
  }
}

export function quarryOver(ctx: CanvasRenderingContext2D, now: number, view: ThemeView, _map: MapDef, _bodies: readonly { x: number; y: number }[]) {
  const t = clock(now);
  CRUSHER.forEach((p, k) => { if (inView(view, p.x, p.y, 400)) dust(ctx, p.x, p.y, t, k); });
  // lighting tower masts and heads
  for (const p of TOWERS) {
    if (!inView(view, p.x, p.y, 90)) continue;
    ctx.fillStyle = C.steelDark; ctx.fillRect(p.x - 3, p.y - 46, 6, 40);
    ctx.fillStyle = C.steel; ctx.fillRect(p.x - 22, p.y - 58, 44, 14); ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.strokeRect(p.x - 22, p.y - 58, 44, 14);
    ctx.fillStyle = C.lamp; for (let k = 0; k < 4; k++) ctx.fillRect(p.x - 19 + k * 10, p.y - 55, 8, 8);
  }
  // the blasting siren: a pole, a horn and a red lamp turning slowly
  SIREN.forEach((p, i) => {
    if (!inView(view, p.x, p.y, 90)) return;
    ctx.fillStyle = C.steelDark; ctx.fillRect(p.x - 3, p.y - 60, 6, 60);
    ctx.fillStyle = C.steel; ctx.beginPath(); ctx.moveTo(p.x, p.y - 62); ctx.lineTo(p.x + 22, p.y - 72); ctx.lineTo(p.x + 22, p.y - 52); ctx.closePath(); ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 1.6; ctx.stroke();
    const on = calm || Math.floor(t / 900 + i) % 2 === 0;
    disc(ctx, p.x, p.y - 66, 6, on ? '#ff4a3a' : '#6a2420', 1.6);
  });
  CRANES.forEach((c, k) => { if (inView(view, c.x, c.y, c.jib + 120)) crane(ctx, c, t, 0); const tc = { ...c, ...turn(c) }; if (inView(view, tc.x, tc.y, c.jib + 120)) crane(ctx, tc, t, 1 + k); });
  for (const s of SIGN_LIST) {
    if (!inView(view, s.x, s.y, 160)) continue;
    const img = signSprite(s);
    ctx.drawImage(img, s.x - img.width / 2, s.y - 14);
  }
  void PIT; void POND;
}
