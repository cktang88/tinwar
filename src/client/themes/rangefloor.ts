import type { FloorPlan } from '../floor.ts';
import { C, FONT, LAYOUT, LINE, RANGE_DEF, TAU, ammoCan, at, box, casing, disc, seeded, shade, text } from './rangekit.ts';

/**
 * The shooting range's ground, baked once into the cached floor layer: packed earth under a worn grass field, the booth's concrete
 * slab behind the firing line, gravel paths, the shoot-house's plywood floor with its taped rooms, the explosives pit with its sand
 * and timber kerb, the scorched blast lane, the berm's toe and the service track. Then the small stories: brass at every firing
 * point, numbered firing points, the range rules board and a cautionary poster by the door, the target repair corner, spare
 * target stands, and a paper target someone shot a smiley face into. The lane paint, distance marks, rails and pad come on top
 * every frame from targetart.ts, so the ground here stays quiet and darkish for the bone stencils to read.
 */
type G = CanvasRenderingContext2D;

const LANES = LAYOUT.lanes;
const TOP = LANES[0]!.y0, BOTTOM = LANES.at(-1)!.y1;
const BENCHES = RANGE_DEF.walls.filter((w) => w.material === 'rgbench').map((w) => w.y + w.h / 2);
const BERM_X = Math.min(...RANGE_DEF.walls.filter((w) => w.material === 'rgberm' && w.h > w.w).map((w) => w.x));

/* ------------------------------------------------------------ ground */

function earth(g: G, size: number, rand: () => number) {
  g.fillStyle = C.earth; g.fillRect(0, 0, size, size);
  for (let i = 0; i < 900; i++) {
    const x = rand() * size, y = rand() * size, r = 20 + rand() * 90;
    g.fillStyle = rand() < 0.5 ? 'rgba(128, 118, 92, 0.12)' : 'rgba(70, 62, 46, 0.12)';
    g.beginPath(); g.ellipse(x, y, r, r * (0.5 + rand() * 0.5), rand() * TAU, 0, TAU); g.fill();
  }
  for (let i = 0; i < 9000; i++) { g.fillStyle = rand() < 0.5 ? 'rgba(160, 150, 124, 0.35)' : 'rgba(50, 44, 34, 0.35)'; g.fillRect(rand() * size, rand() * size, 1.6 + rand() * 2, 1.6 + rand() * 2); }
}

/** The field: short worn grass in mower stripes down each lane, bare where feet and carts go. */
function field(g: G, rand: () => number) {
  const x0 = LINE, x1 = BERM_X;
  for (let x = x0; x < x1; x += 120) { g.fillStyle = (x / 120) % 2 ? 'rgba(94, 106, 62, 0.22)' : 'rgba(94, 106, 62, 0.14)'; g.fillRect(x, TOP - 120, 120, BOTTOM - TOP + 240); }
  for (let i = 0; i < 2600; i++) {
    const x = x0 + rand() * (x1 - x0), y = TOP - 100 + rand() * (BOTTOM - TOP + 200);
    g.strokeStyle = rand() < 0.5 ? 'rgba(118, 132, 76, 0.5)' : 'rgba(72, 83, 47, 0.5)'; g.lineWidth = 1.6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rand() - 0.5) * 4, y - 4 - rand() * 5); g.stroke();
  }
  // worn tracks out to each target, where the crew walk to patch them
  for (const t of LAYOUT.targets) {
    if (t.rail) continue;
    g.strokeStyle = 'rgba(60, 52, 38, 0.18)'; g.lineWidth = 26; g.lineCap = 'round';
    g.beginPath(); g.moveTo(t.x, t.y + 30); g.quadraticCurveTo(t.x + 40, t.y + 160, t.x + 10, t.y + 260); g.stroke();
  }
}

/** The booth: a poured slab from the back wall to the firing line, with joints, oil stains and drag marks. */
function booth(g: G, rand: () => number) {
  const x0 = 150, x1 = LINE, y0 = 150, y1 = 2250;
  g.fillStyle = C.slab; g.fillRect(x0, y0, x1 - x0, y1 - y0);
  g.strokeStyle = 'rgba(60, 58, 52, 0.5)'; g.lineWidth = 2;
  for (let y = y0; y < y1; y += 125) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); }
  g.beginPath(); g.moveTo(275, y0); g.lineTo(275, y1); g.stroke();
  for (let i = 0; i < 1600; i++) { g.fillStyle = rand() < 0.5 ? 'rgba(170, 166, 156, 0.35)' : 'rgba(80, 78, 70, 0.3)'; g.fillRect(x0 + rand() * (x1 - x0), y0 + rand() * (y1 - y0), 2, 2); }
  for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(40, 36, 30, 0.12)'; g.beginPath(); g.ellipse(x0 + 20 + rand() * 210, y0 + rand() * (y1 - y0), 10 + rand() * 24, 6 + rand() * 12, rand() * TAU, 0, TAU); g.fill(); }
  // the slab's lip onto the earth at the line
  g.fillStyle = 'rgba(30, 28, 24, 0.35)'; g.fillRect(x1, y0, 4, y1 - y0);
}

/** Gravel: the path from the gate to the doorway, the strip outside the back wall and the service track along the north and south rims. */
function gravel(g: G, rand: () => number) {
  const strips: [number, number, number, number][] = [[0, 0, 100, 2400], [0, 1050, 160, 300], [480, 70, 1790, 120], [480, 2240, 1790, 90], [150, 0, 330, 150], [150, 2250, 330, 150]];
  for (const [x, y, w, h] of strips) {
    g.fillStyle = C.gravelLo; g.fillRect(x, y, w, h);
    for (let i = 0; i < (w * h) / 60; i++) { g.fillStyle = rand() < 0.4 ? C.gravelHi : rand() < 0.5 ? C.gravel : '#5c5850'; g.beginPath(); g.arc(x + rand() * w, y + rand() * h, 1.2 + rand() * 2.2, 0, TAU); g.fill(); }
  }
  // tyre ruts along the service tracks, where the target truck runs
  g.strokeStyle = 'rgba(40, 36, 30, 0.3)'; g.lineWidth = 9;
  for (const y of [110, 150, 2270, 2306]) { g.beginPath(); g.moveTo(480, y); for (let x = 480; x <= 2270; x += 60) g.lineTo(x, y + Math.sin(x / 140) * 4); g.stroke(); }
}

/** The shoot-house: a plywood floor behind its walls, rooms laid out in white tape, a door frame drawn on the floor and its name. */
function shootHouse(g: G) {
  const x0 = 620, y0 = 224, x1 = 1300, y1 = LANES[0]!.y1 - 4;
  g.fillStyle = 'rgba(176, 146, 100, 0.55)'; g.fillRect(x0, y0, x1 - x0, y1 - y0);
  g.strokeStyle = 'rgba(90, 66, 34, 0.35)'; g.lineWidth = 1.6;
  for (let x = x0; x < x1; x += 120) { g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y1); g.stroke(); }
  for (let y = y0; y < y1; y += 240) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); }
  // tape walls: three rooms and a hall, each with a doorway gap
  g.strokeStyle = 'rgba(236, 232, 220, 0.75)'; g.lineWidth = 6; g.lineCap = 'butt';
  const tape = (pts: [number, number][]) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); };
  tape([[950, y0], [950, 380]]); tape([[950, 460], [950, 600]]);
  tape([[x0, 600], [720, 600]]); tape([[860, 600], [1040, 600]]); tape([[1180, 600], [x1, 600]]);
  tape([[x0, y0 + 2], [x0, 330]]); tape([[x0, 430], [x0, 600]]);
  // the room names and an entry arrow
  text(g, 'SHOOT HOUSE', 1180, 668, 22, 'rgba(60, 40, 20, 0.55)');
  for (const [s, x, y] of [['A', 680, 270], ['B', 1010, 300], ['HALL', 680, 650]] as const) text(g, s, x, y, 22, 'rgba(236, 232, 220, 0.55)');
  g.fillStyle = 'rgba(236, 232, 220, 0.5)'; g.beginPath(); g.moveTo(560, 380); g.lineTo(600, 380); g.lineTo(600, 366); g.lineTo(616, 390); g.lineTo(600, 414); g.lineTo(600, 400); g.lineTo(560, 400); g.closePath(); g.fill();
}

/** The explosives pit: soft sand inside a timber kerb, scorch blooms, debris, and the danger board. */
function pit(g: G, rand: () => number) {
  const x0 = 856, y0 = 1846, x1 = 1124, y1 = 2084;
  g.fillStyle = C.sandLo; g.fillRect(x0, y0, x1 - x0, y1 - y0);
  g.fillStyle = C.sand; g.fillRect(x0 + 8, y0 + 8, x1 - x0 - 16, y1 - y0 - 16);
  for (let i = 0; i < 1200; i++) { g.fillStyle = rand() < 0.5 ? 'rgba(212, 191, 146, 0.6)' : 'rgba(150, 128, 86, 0.5)'; g.fillRect(x0 + 8 + rand() * (x1 - x0 - 16), y0 + 8 + rand() * (y1 - y0 - 16), 2, 2); }
  for (const [cx, cy, r] of [[1010, 1930, 60], [920, 2030, 44], [1080, 2050, 34]] as const) {
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, 'rgba(30, 26, 20, 0.55)'); grad.addColorStop(0.6, 'rgba(40, 34, 26, 0.3)'); grad.addColorStop(1, 'rgba(40, 34, 26, 0)');
    g.fillStyle = grad; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
  }
  // the kerb: railway sleepers round the rim
  g.fillStyle = C.woodLo;
  for (const [x, y, w, h] of [[x0, y0, x1 - x0, 10], [x0, y1 - 10, x1 - x0, 10], [x0, y0, 10, y1 - y0], [x1 - 10, y0, 10, y1 - y0]] as const) { g.fillRect(x, y, w, h); g.strokeStyle = C.ink; g.lineWidth = 1.4; g.strokeRect(x, y, w, h); }
  g.strokeStyle = 'rgba(30, 20, 10, 0.5)'; g.lineWidth = 1;
  for (let x = x0 + 60; x < x1; x += 60) { g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y0 + 10); g.moveTo(x, y1 - 10); g.lineTo(x, y1); g.stroke(); }
  // the board on its posts by the kerb
  at(g, 1170, 1830, 0, () => {
    shade(g, 0, 8, 46, 10);
    box(g, -44, -22, 88, 36, C.red, 2); box(g, -40, -18, 80, 28, C.bone, 0);
    text(g, 'DANGER', 0, -9, 13, C.red); text(g, 'EXPLOSIVES PIT', 0, 4, 10, C.ink);
    box(g, -34, 14, 5, 14, C.woodLo, 1.2); box(g, 29, 14, 5, 14, C.woodLo, 1.2);
  });
}

/** The blast lane past the pit: grenade scorches where practice rounds landed, with the odd fragment. */
function blastLane(g: G, rand: () => number) {
  const lane = LANES.at(-1)!;
  for (let i = 0; i < 9; i++) {
    const cx = 1260 + rand() * 900, cy = lane.y0 + 60 + rand() * (lane.y1 - lane.y0 - 120), r = 26 + rand() * 30;
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, 'rgba(26, 22, 18, 0.5)'); grad.addColorStop(1, 'rgba(26, 22, 18, 0)');
    g.fillStyle = grad; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(26, 22, 18, 0.35)'; g.lineWidth = 1.6;
    for (let k = 0; k < 7; k++) { const a = rand() * TAU; g.beginPath(); g.moveTo(cx + Math.cos(a) * r * 0.3, cy + Math.sin(a) * r * 0.3); g.lineTo(cx + Math.cos(a) * r * 1.1, cy + Math.sin(a) * r * 1.1); g.stroke(); }
  }
}

/** The berm's toe: loose spoil fanning out onto the field, and the stakes of targets long gone. */
function bermToe(g: G, rand: () => number) {
  const grad = g.createLinearGradient(BERM_X - 110, 0, BERM_X, 0);
  grad.addColorStop(0, 'rgba(110, 94, 66, 0)'); grad.addColorStop(1, 'rgba(110, 94, 66, 0.6)');
  g.fillStyle = grad; g.fillRect(BERM_X - 110, 70, 110, 2260);
  for (let i = 0; i < 260; i++) disc(g, BERM_X - rand() * 90, 80 + rand() * 2240, 1.4 + rand() * 3, rand() < 0.5 ? C.gravel : C.earthLo, rand() < 0.3 ? 1 : 0);
  for (let i = 0; i < 6; i++) { const x = BERM_X - 60 - rand() * 60, y = 400 + rand() * 1600; box(g, x, y, 6, 6, C.woodLo, 1.2); g.fillStyle = 'rgba(20, 16, 10, 0.25)'; g.fillRect(x + 6, y + 2, 10, 5); }
}

/* ------------------------------------------------------------ the small stories */

/** Each firing point: its number painted in front of the line, and the brass that piles up under a shooter's right hand. */
function firingPoints(g: G, rand: () => number) {
  BENCHES.forEach((y, i) => {
    g.fillStyle = 'rgba(236, 232, 220, 0.16)'; g.fillRect(LINE + 8, y - 26, 40, 52);
    g.strokeStyle = 'rgba(236, 232, 220, 0.5)'; g.lineWidth = 2; g.strokeRect(LINE + 8, y - 26, 40, 52);
    g.fillStyle = 'rgba(236, 232, 220, 0.78)'; g.font = FONT(34); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(i + 1), LINE + 28, y + 2);
    for (let k = 0; k < 16; k++) casing(g, 345 + rand() * 50, y - 40 + rand() * 90, rand() * TAU);
  });
  for (let k = 0; k < 30; k++) casing(g, 300 + rand() * 90, 1180 + rand() * 140, rand() * TAU);
}

/** The range rules board by the gate, on two posts. */
function rulesBoard(g: G, x: number, y: number) {
  shade(g, x, y + 10, 44, 12);
  box(g, x - 40, y - 46, 80, 92, C.olive, 2); box(g, x - 35, y - 41, 70, 82, C.paper, 1);
  g.fillStyle = C.red; g.fillRect(x - 35, y - 41, 70, 14);
  text(g, 'RANGE RULES', x, y - 34, 10, C.bone);
  g.fillStyle = 'rgba(40, 40, 40, 0.65)';
  for (let k = 0; k < 7; k++) { g.fillRect(x - 30, y - 20 + k * 8, 6, 2); g.fillRect(x - 21, y - 20 + k * 8, 46 - (k * 7) % 20, 2); }
  disc(g, x + 22, y + 34, 6, C.red, 1);
}

/** A cautionary poster: a stick figure peering down his own muzzle. DON'T BE THIS GUY. */
function poster(g: G, x: number, y: number) {
  shade(g, x, y + 10, 40, 10);
  box(g, x - 36, y - 46, 72, 92, C.paper, 2);
  g.fillStyle = C.yellow; g.fillRect(x - 35, y - 45, 70, 12);
  text(g, "DON'T BE", x, y - 39, 10, C.ink);
  g.strokeStyle = C.ink; g.lineWidth = 2.4; g.lineCap = 'round';
  g.beginPath(); g.arc(x - 6, y - 16, 7, 0, TAU); g.moveTo(x - 6, y - 9); g.lineTo(x - 6, y + 14); g.moveTo(x - 6, y + 14); g.lineTo(x - 14, y + 28); g.moveTo(x - 6, y + 14); g.lineTo(x + 2, y + 28); g.moveTo(x - 6, y - 2); g.lineTo(x + 12, y - 8); g.moveTo(x - 6, y - 2); g.lineTo(x + 8, y + 4); g.stroke();
  g.strokeStyle = C.steelDark; g.lineWidth = 4; g.beginPath(); g.moveTo(x + 2, y - 16); g.lineTo(x + 20, y - 2); g.stroke();
  g.fillStyle = C.ink; g.beginPath(); g.arc(x - 3, y - 17, 1.4, 0, TAU); g.fill();
  text(g, '!', x + 20, y - 22, 14, C.red);
  text(g, 'THIS GUY', x, y + 38, 10, C.red);
}

/** The target repair corner on the north track: a stack of fresh paper soldiers, paste bucket, staple gun, spare stakes and a shot-up face. */
function repairCorner(g: G, x: number, y: number) {
  shade(g, x, y, 70, 30);
  for (let k = 0; k < 5; k++) at(g, x - 40 + k * 2, y - 6 - k * 2, -0.08 + k * 0.03, () => { box(g, -16, -22, 32, 44, C.paper, 1); disc(g, 0, -4, 8, C.red, 0); disc(g, 0, -4, 4, C.paper, 0); });
  disc(g, x + 6, y + 10, 12, C.steelLo, 1.6); disc(g, x + 6, y + 10, 8, '#d8d0b8', 0);
  g.strokeStyle = C.woodHi; g.lineWidth = 2.4; g.beginPath(); g.moveTo(x + 2, y + 12); g.lineTo(x + 16, y - 6); g.stroke();
  at(g, x + 34, y + 16, 0.4, () => { box(g, -10, -5, 20, 10, C.red, 1.2); box(g, -12, 3, 8, 8, C.ink, 0); });
  for (let k = 0; k < 4; k++) box(g, x + 50 + k * 9, y - 26 + k, 5, 46, C.wood, 1.2);
  // the one someone grouped into a smiley
  at(g, x + 110, y - 2, 0.2, () => {
    box(g, -18, -26, 36, 52, C.paper, 1.2);
    g.strokeStyle = C.red; g.lineWidth = 1.4; g.beginPath(); g.arc(0, -4, 14, 0, TAU); g.stroke();
    for (const [hx, hy] of [[-5, -9], [5, -9], [-8, 1], [-4, 4], [0, 5], [4, 4], [8, 1]] as const) disc(g, hx, hy, 1.6, C.ink, 0);
  });
}

/** Spare target stands on the south track, waiting their turn. */
function spareStands(g: G, x: number, y: number) {
  for (let k = 0; k < 4; k++) at(g, x + k * 46, y + (k % 2) * 8, 0.1 * (k - 1.5), () => {
    shade(g, 0, 4, 22, 10);
    box(g, -20, -4, 40, 8, C.steelLo, 1.2); box(g, -3, -26, 6, 30, C.woodLo, 1.2);
    if (k % 2) box(g, -15, -40, 30, 18, C.khaki, 1.2);
  });
  ammoCan(g, x + 210, y + 4, 0.2); ammoCan(g, x + 214, y - 14, -0.1);
}

/** The wind sock's post foot and a sandbag pile by the hut. */
function bits(g: G, rand: () => number) {
  for (let k = 0; k < 6; k++) { const x = 340 + rand() * 120, y = 2280 + rand() * 60; g.fillStyle = rand() < 0.5 ? C.bag : C.bagLo; g.beginPath(); g.roundRect(x, y, 28, 16, 6); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 1.2; g.stroke(); }
  ammoCan(g, 360, 2370, 0.3);
}

export function paintRangeFloor(g: G, size: number, seed: number, _plan: FloorPlan) {
  const rand = seeded(seed ^ 0x52a7);
  earth(g, size, rand);
  gravel(g, rand);
  field(g, rand);
  booth(g, rand);
  shootHouse(g);
  pit(g, rand);
  blastLane(g, rand);
  bermToe(g, rand);
  firingPoints(g, rand);
  rulesBoard(g, 50, 980);
  poster(g, 50, 1420);
  repairCorner(g, 1500, 130);
  spareStands(g, 1500, 2290);
  bits(g, rand);
  // the rim of the world: a soft dark edge so it feels finished
  const rim = 160;
  for (const [x0, y0, x1, y1, rx, ry, rw, rh] of [[0, 0, 0, rim, 0, 0, size, rim], [0, size, 0, size - rim, 0, size - rim, size, rim], [0, 0, rim, 0, 0, 0, rim, size], [size, 0, size - rim, 0, size - rim, 0, rim, size]] as const) {
    const grad = g.createLinearGradient(x0, y0, x1, y1);
    grad.addColorStop(0, 'rgba(14, 12, 10, 0.35)'); grad.addColorStop(1, 'rgba(14, 12, 10, 0)');
    g.fillStyle = grad; g.fillRect(rx, ry, rw, rh);
  }
}
