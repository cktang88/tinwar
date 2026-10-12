import type { Pt } from '../../shared/geom.ts';
import { FUEL, PIT } from '../../shared/maps/quarrygeo.ts';
import type { FloorPlan } from '../floor.ts';
import { blotch, seeded } from '../grain.ts';
import { C, QUARRY, SIZE, TAU, hash, hazard, hexA, levelAt, ovalPt, text, turn, wallsOf } from './quarrykit.ts';
import { paintQuarryDecor } from './quarrydecor.ts';

/**
 * The Quarry's ground, baked once: dusty works ground round the rim, then the pit stepping down in three levels (pale top
 * bench, grey middle bench, the dark wet pit floor scored with the wire saw's grid where blocks were lifted), each terrace edge
 * shaded as a drop. Haul roads spiral down through the ramps with tyre tracks and chevrons; concrete pads sit under the plant,
 * the weighbridge deck by the gate, puddles everywhere it rained. Busy marks keep to the margins so lanes read clearly.
 */
type G = CanvasRenderingContext2D;

const both = (paint: (flip: boolean) => void) => { paint(false); paint(true); };
/** Runs `paint` once as authored and once turned half round the map's centre. */
function twice(g: G, paint: () => void) {
  paint();
  g.save(); g.translate(SIZE, SIZE); g.rotate(Math.PI); paint(); g.restore();
}

function grit(g: G, rand: () => number, x0: number, y0: number, w: number, h: number, n: number, dark: string, light: string) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = rand() < 0.6 ? dark : light;
    const s = 1 + rand() * 1.8;
    g.fillRect(x0 + rand() * w, y0 + rand() * h, s, s);
  }
}

/** A stone: a small chunky polygon with an ink edge. */
function stone(g: G, x: number, y: number, r: number, fill: string, rand: () => number) {
  g.fillStyle = fill; g.beginPath();
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + rand() * 0.5, q = r * (0.7 + rand() * 0.4); g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q * 0.8); }
  g.closePath(); g.fill(); g.strokeStyle = 'rgba(28, 31, 38, 0.6)'; g.lineWidth = 1.2; g.stroke();
}

function puddle(g: G, x: number, y: number, r: number, rand: () => number) {
  g.fillStyle = hexA(C.puddle, 0.55); g.beginPath();
  for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU, q = r * (0.7 + rand() * 0.4); g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q * 0.6); }
  g.closePath(); g.fill();
  g.fillStyle = hexA(C.puddleHi, 0.35); g.beginPath(); g.ellipse(x - r * 0.25, y - r * 0.15, r * 0.35, r * 0.1, -0.2, 0, TAU); g.fill();
}

/** Tyre tracks: two pairs of chunky strokes along a path, over a band of packed haul road. */
function haul(g: G, pts: readonly Pt[], width = 120) {
  const path = () => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); };
  g.lineCap = 'round'; g.lineJoin = 'round';
  path(); g.strokeStyle = 'rgba(60, 54, 44, 0.22)'; g.lineWidth = width; g.stroke();
  path(); g.strokeStyle = 'rgba(190, 180, 158, 0.12)'; g.lineWidth = width * 0.7; g.stroke();
  for (const off of [-0.3, 0.3]) {
    g.beginPath();
    pts.forEach((p, i) => {
      const a = pts[Math.max(0, i - 1)]!, b = pts[Math.min(pts.length - 1, i + 1)]!, l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const x = p.x - ((b.y - a.y) / l) * width * off, y = p.y + ((b.x - a.x) / l) * width * off;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    });
    g.strokeStyle = 'rgba(36, 32, 28, 0.32)'; g.lineWidth = 16; g.stroke();
    g.strokeStyle = 'rgba(36, 32, 28, 0.25)'; g.lineWidth = 3; g.setLineDash([6, 8]); g.stroke(); g.setLineDash([]);
  }
}
const arcPts = (rx: number, ry: number, a0: number, a1: number, step = 0.05): Pt[] => {
  const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / step)), out: Pt[] = [];
  for (let i = 0; i <= n; i++) out.push(ovalPt({ rx, ry }, a0 + ((a1 - a0) * i) / n));
  return out;
};

/* ------------------------------------------------------------ ground and levels */

function ground(g: G, rand: () => number) {
  g.fillStyle = C.dirt; g.fillRect(0, 0, SIZE, SIZE);
  for (let y = 0; y < SIZE; y += 250) for (let x = 0; x < SIZE; x += 250) {
    const k = (rand() - 0.5) * 2;
    g.fillStyle = k > 0 ? hexA(C.dirtHi, k * 0.35) : hexA(C.dirtLo, -k * 0.35);
    g.fillRect(x, y, 250, 250);
  }
  for (let i = 0; i < 120; i++) blotch(g, rand() * SIZE, rand() * SIZE, 120 + rand() * 280, rand() < 0.5 ? '40, 36, 30' : '150, 140, 118', 0.06 + rand() * 0.06);
  // grass hanging on at the map's margins
  for (let i = 0; i < 70; i++) {
    const side = Math.floor(rand() * 4), t = rand() * SIZE, d = rand() * 180;
    const x = side === 0 ? t : side === 1 ? t : side === 2 ? d : SIZE - d, y = side === 0 ? d : side === 1 ? SIZE - d : t;
    blotch(g, x, y, 60 + rand() * 90, '90, 104, 60', 0.22);
  }
  grit(g, rand, 0, 0, SIZE, SIZE, 60000, 'rgba(30, 26, 22, 0.22)', 'rgba(220, 210, 186, 0.16)');
}

/** The three terraces, each a shade darker and cooler, with a drop shadow inside each edge so the step down reads. */
function terraces(g: G, rand: () => number) {
  const level = (o: { rx: number; ry: number }, fill: string, hi: string, inset: number) => {
    g.fillStyle = fill; g.beginPath(); g.ellipse(PIT.x, PIT.y, o.rx - inset, o.ry - inset, 0, 0, TAU); g.fill();
    g.save(); g.beginPath(); g.ellipse(PIT.x, PIT.y, o.rx - inset, o.ry - inset, 0, 0, TAU); g.clip();
    for (let i = 0; i < 60; i++) { const a = rand() * TAU, d = Math.sqrt(rand()); blotch(g, PIT.x + Math.cos(a) * d * o.rx, PIT.y + Math.sin(a) * d * o.ry, 80 + rand() * 160, rand() < 0.5 ? '40, 40, 40' : '200, 196, 186', 0.05 + rand() * 0.05); }
    g.fillStyle = hexA(hi, 0.4);
    for (let i = 0; i < 160; i++) { const a = rand() * TAU, d = Math.sqrt(rand()); stone(g, PIT.x + Math.cos(a) * d * o.rx, PIT.y + Math.sin(a) * d * o.ry, 3 + rand() * 4, rand() < 0.5 ? hi : fill, rand); }
    // the drop: a dark band just inside the edge, the lit crest just outside
    for (let k = 0; k < 9; k++) { g.strokeStyle = `rgba(16, 18, 24, ${(0.26 * (1 - k / 9)).toFixed(3)})`; g.lineWidth = 8; g.beginPath(); g.ellipse(PIT.x, PIT.y, o.rx - inset - 4 - k * 7, o.ry - inset - 4 - k * 7, 0, 0, TAU); g.stroke(); }
    g.restore();
  };
  // the rim: a crest of lit rock, then the short face down to the top bench, its scree at the foot
  level(PIT.rim, C.bench1, C.bench1Hi, 0);
  level(PIT.mid, C.bench2, C.bench2Hi, PIT.t);
  level(PIT.floor, C.floor, C.floorHi, PIT.t);
  // blasted rubble left on the benches: a dark scar and a cluster of broken stone, now and then a pair of half drill holes
  for (let i = 0; i < 70; i++) {
    const a = rand() * TAU, onTop = rand() < 0.55, o = onTop ? { rx: 1380, ry: 1550 } : { rx: 930, ry: 1060 }, k = (rand() - 0.5) * 140;
    const p = ovalPt({ rx: o.rx + k, ry: o.ry + k }, a);
    blotch(g, p.x, p.y, 40 + rand() * 40, '30, 30, 32', 0.16);
    for (let j = 0; j < 7; j++) stone(g, p.x + (rand() - 0.5) * 60, p.y + (rand() - 0.5) * 40, 3 + rand() * 6, rand() < 0.5 ? C.rockHi : C.rock, rand);
  }
  g.strokeStyle = C.rockHi; g.lineWidth = 10; g.beginPath(); g.ellipse(PIT.x, PIT.y, PIT.rim.rx + 4, PIT.rim.ry + 4, 0, 0, TAU); g.stroke();
  g.strokeStyle = C.rockLo; g.lineWidth = 16; g.beginPath(); g.ellipse(PIT.x, PIT.y, PIT.rim.rx - 9, PIT.rim.ry - 9, 0, 0, TAU); g.stroke();
  g.strokeStyle = 'rgba(28, 31, 38, 0.8)'; g.lineWidth = 2.2; g.beginPath(); g.ellipse(PIT.x, PIT.y, PIT.rim.rx - 1, PIT.rim.ry - 1, 0, 0, TAU); g.stroke();
  for (let i = 0; i < 520; i++) { const a = rand() * TAU, p = ovalPt(PIT.rim, a, 22 + rand() * 26); stone(g, p.x, p.y, 3 + rand() * 6, rand() < 0.5 ? C.rockHi : C.rock, rand); }
  // the safety bund along the rim: a low line of boulders, gaps where the haul roads come in
  for (let a = 0; a < TAU; a += 0.018) {
    const gap = [0.62, 1.2, 2.25, 2.95].some((c) => Math.abs(((a % Math.PI) + Math.PI) % Math.PI - c) < 0.12);
    if (gap || rand() < 0.15) continue;
    const p = ovalPt(PIT.rim, a, -26);
    if (levelAt(p.x, p.y) !== 0) continue;
    stone(g, p.x, p.y, 8 + rand() * 6, rand() < 0.5 ? C.rockHi : C.rock, rand);
  }
}

/** The pit floor: the wire saw's grid where blocks were cut and lifted, rain standing in the low cells, drill rows for the next blast. */
function pitFloor(g: G, rand: () => number) {
  g.save();
  g.beginPath(); g.ellipse(PIT.x, PIT.y, PIT.floor.rx - PIT.t - 30, PIT.floor.ry - PIT.t - 30, 0, 0, TAU); g.clip();
  const cell = 150;
  for (let y = PIT.y - 900; y < PIT.y + 900; y += cell) for (let x = PIT.x - 900; x < PIT.x + 900; x += cell) {
    const k = hash(x, y, 3);
    if (k < 0.22) { g.fillStyle = 'rgba(30, 34, 40, 0.22)'; g.fillRect(x + 3, y + 3, cell - 6, cell - 6); g.fillStyle = 'rgba(16, 18, 24, 0.2)'; g.fillRect(x + 3, y + 3, cell - 6, 8); }
    else if (k > 0.86) { g.fillStyle = 'rgba(210, 204, 190, 0.1)'; g.fillRect(x + 3, y + 3, cell - 6, cell - 6); }
  }
  g.strokeStyle = 'rgba(24, 26, 30, 0.45)'; g.lineWidth = 3;
  g.beginPath();
  for (let x = PIT.x - 900; x <= PIT.x + 900; x += cell) { g.moveTo(x, PIT.y - 900); g.lineTo(x, PIT.y + 900); }
  for (let y = PIT.y - 900; y <= PIT.y + 900; y += cell) { g.moveTo(PIT.x - 900, y); g.lineTo(PIT.x + 900, y); }
  g.stroke();
  g.strokeStyle = 'rgba(220, 214, 200, 0.12)'; g.lineWidth = 1.4;
  g.beginPath();
  for (let x = PIT.x - 900; x <= PIT.x + 900; x += cell) { g.moveTo(x + 3, PIT.y - 900); g.lineTo(x + 3, PIT.y + 900); }
  g.stroke();
  // rain standing on the floor
  for (let i = 0; i < 26; i++) { const a = rand() * TAU, d = 0.2 + rand() * 0.75; puddle(g, PIT.x + Math.cos(a) * d * PIT.floor.rx, PIT.y + Math.sin(a) * d * PIT.floor.ry, 30 + rand() * 60, rand); }
  g.restore();
  // drill rows for the next blast, both twins, with orange det cord strung hole to hole
  twice(g, () => {
    const x0 = 2600, y0 = 2470, cols = 5, rows = 3, step = 46;
    g.strokeStyle = 'rgba(217, 104, 42, 0.85)'; g.lineWidth = 2.4; g.beginPath();
    for (let r = 0; r < rows; r++) { g.moveTo(x0, y0 + r * step); g.lineTo(x0 + (cols - 1) * step + (r % 2) * 23, y0 + r * step); }
    g.moveTo(x0, y0); g.lineTo(x0, y0 + (rows - 1) * step); g.stroke();
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = x0 + c * step + (r % 2) * 23, y = y0 + r * step;
      g.fillStyle = 'rgba(30, 30, 32, 0.8)'; g.beginPath(); g.arc(x, y, 5, 0, TAU); g.fill();
      g.fillStyle = 'rgba(190, 184, 170, 0.6)'; g.beginPath(); g.arc(x - 6, y + 4, 4, 0, TAU); g.fill();
    }
  });
}

/* ------------------------------------------------------------ ramps and haul roads */

/** Ramps through the ledges: packed gravel, the uphill chevrons, a berm of rocks along each side. */
function ramps(g: G, rand: () => number) {
  const ramp = (a: number, o1: { rx: number; ry: number }, o2: { rx: number; ry: number }, half: number) => {
    const p0 = ovalPt(o1, a - half), p1 = ovalPt(o1, a + half), p2 = ovalPt(o2, a + half * 1.1), p3 = ovalPt(o2, a - half * 1.1);
    g.fillStyle = 'rgba(176, 168, 150, 0.45)'; g.beginPath(); g.moveTo(p0.x, p0.y); g.lineTo(p1.x, p1.y); g.lineTo(p2.x, p2.y); g.lineTo(p3.x, p3.y); g.closePath(); g.fill();
    const c1 = ovalPt(o1, a), c2 = ovalPt(o2, a), ang = Math.atan2(c1.y - c2.y, c1.x - c2.x);
    for (let k = 0.25; k < 0.9; k += 0.3) {
      const x = c2.x + (c1.x - c2.x) * k, y = c2.y + (c1.y - c2.y) * k;
      g.save(); g.translate(x, y); g.rotate(ang);
      g.strokeStyle = 'rgba(226, 179, 58, 0.55)'; g.lineWidth = 7; g.lineCap = 'butt';
      g.beginPath(); g.moveTo(-14, -26); g.lineTo(6, 0); g.lineTo(-14, 26); g.stroke();
      g.restore();
    }
    for (const s of [-1, 1]) for (let k = 0; k <= 1.001; k += 0.12) {
      const q1 = ovalPt(o1, a + s * half * 1.05), q2 = ovalPt(o2, a + s * half * 1.15);
      stone(g, q2.x + (q1.x - q2.x) * k, q2.y + (q1.y - q2.y) * k, 6 + rand() * 4, rand() < 0.5 ? C.rockHi : C.rock, rand);
    }
  };
  // floor ledge openings (N, S, E, W) and the middle ledge's four diagonals
  for (const a of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) ramp(a, { rx: PIT.floor.rx - PIT.t - 10, ry: PIT.floor.ry - PIT.t - 10 }, { rx: PIT.floor.rx + 90, ry: PIT.floor.ry + 90 }, a % Math.PI === 0 ? 0.11 : 0.2);
  for (const a of [Math.PI - 0.58, Math.PI + 0.58, -0.58, 0.58]) ramp(a, { rx: PIT.mid.rx - PIT.t - 10, ry: PIT.mid.ry - PIT.t - 10 }, { rx: PIT.mid.rx + 90, ry: PIT.mid.ry + 90 }, 0.11);
}

function haulRoads(g: G) {
  twice(g, () => {
    // the gate road from the weighbridge east to the rim, then round the top bench and down the south-west ramp
    haul(g, [{ x: 120, y: 4250 }, { x: 1100, y: 4250 }, { x: 1700, y: 4330 }, ovalPt(PIT.mid, Math.PI - 0.58, -160), ...arcPts(925, 1060, Math.PI - 0.58, Math.PI / 2), ovalPt(PIT.floor, Math.PI / 2, 80)]);
    // the crusher road: from the hopper round the canteen and down the north-west ramp to the floor's west gate
    haul(g, [{ x: 1150, y: 800 }, { x: 1250, y: 1150 }, { x: 1550, y: 1500 }, ovalPt(PIT.mid, Math.PI + 0.58, -160), ...arcPts(925, 1060, Math.PI + 0.58, Math.PI), { x: PIT.x - 520, y: PIT.y }], 110);
  });
  // across the pit floor between the four gates
  haul(g, [ovalPt(PIT.floor, Math.PI, 40), { x: PIT.x - 240, y: PIT.y + 60 }, { x: PIT.x + 240, y: PIT.y - 60 }, ovalPt(PIT.floor, 0, 40)], 110);
  haul(g, [ovalPt(PIT.floor, Math.PI / 2, 40), { x: PIT.x + 80, y: PIT.y + 260 }, { x: PIT.x - 80, y: PIT.y - 260 }, ovalPt(PIT.floor, -Math.PI / 2, 40)], 110);
}

/** Words painted on the ground, each with its twin's own words, both kept upright. */
const upright = (r: number) => { let a = ((r % TAU) + TAU) % TAU; if (a > Math.PI / 2 && a <= (3 * Math.PI) / 2) a -= Math.PI; return a; };
function words(g: G) {
  const p1 = ovalPt({ rx: 1380, ry: 1550 }, Math.PI * 0.9), p2 = ovalPt({ rx: 930, ry: 1060 }, Math.PI * 1.12);
  const list: [string, string, number, number, number, string, number][] = [
    ['NEXT BLAST', 'NEXT BLAST', 2715, 2440, 22, 'rgba(217, 104, 42, 0.8)', 0],
    ['BENCH 1  ·  +0 M', 'BENCH 1  ·  +0 M', p1.x, p1.y, 26, 'rgba(240, 236, 220, 0.45)', Math.PI * 0.4 - Math.PI / 2],
    ['BENCH 2  ·  -12 M', 'BENCH 2  ·  -12 M', p2.x, p2.y, 26, 'rgba(240, 236, 220, 0.42)', -Math.PI * 0.62 + Math.PI / 2],
    ['PIT FLOOR  -24 M', 'PIT FLOOR  -24 M', PIT.x, PIT.y + 330, 30, 'rgba(236, 232, 220, 0.4)', 0],
    ['BAY 1', 'BAY 2', 500, 700, 26, 'rgba(240, 236, 220, 0.55)', 0],
    ['MAX 60 T', '', 520, 4110, 22, 'rgba(240, 236, 220, 0.6)', 0],
  ];
  for (const [a, b, x, y, px, fill, rot] of list) {
    text(g, a, x, y, px, fill, upright(rot));
    if (b) text(g, b, SIZE - x, SIZE - y, px, fill, upright(rot + Math.PI));
  }
}

/* ------------------------------------------------------------ the works: pads, plant aprons, weighbridge, fuel bund */

function works(g: G, rand: () => number) {
  twice(g, () => {
    const pad = (x: number, y: number, w: number, h: number, a = 0.5) => {
      g.fillStyle = hexA(C.concrete, a); g.fillRect(x, y, w, h);
      g.strokeStyle = 'rgba(40, 38, 34, 0.35)'; g.lineWidth = 2; g.strokeRect(x, y, w, h);
      g.strokeStyle = 'rgba(40, 38, 34, 0.18)'; g.lineWidth = 1.4;
      g.beginPath(); for (let k = x + 100; k < x + w; k += 100) { g.moveTo(k, y); g.lineTo(k, y + h); } for (let k = y + 100; k < y + h; k += 100) { g.moveTo(x, k); g.lineTo(x + w, k); } g.stroke();
      for (let i = 0; i < (w * h) / 40000; i++) blotch(g, x + rand() * w, y + rand() * h, 20 + rand() * 30, '20, 18, 16', 0.25);
    };
    pad(100, 100, 850, 750);
    pad(1100, 150, 650, 600);
    pad(1650, 600, 450, 400, 0.4);
    pad(50, 1300, 1250, 700, 0.45);
    pad(1000, 3950, 450, 400, 0.45);
    pad(300, 4950, 500, 450, 0.5);
    // the workshop's roller-door apron: hazard band and the bay number
    hazard(g, 400, 650, 200, 14, 12);
    // the weighbridge: a steel deck on its pit with hazard ends, the gross weight stencilled
    g.fillStyle = 'rgba(16, 18, 24, 0.35)'; g.fillRect(352, 4152, 700, 210);
    g.fillStyle = C.steelLo; g.fillRect(345, 4140, 700, 220);
    g.strokeStyle = 'rgba(200, 210, 220, 0.25)'; g.lineWidth = 1.4; g.beginPath(); for (let x = 355; x < 1040; x += 12) { g.moveTo(x, 4146); g.lineTo(x + 6, 4354); } g.stroke();
    g.strokeStyle = 'rgba(28, 31, 38, 0.8)'; g.lineWidth = 2; g.strokeRect(345, 4140, 700, 220); g.beginPath(); g.moveTo(695, 4140); g.lineTo(695, 4360); g.stroke();
    hazard(g, 320, 4140, 25, 220, 10); hazard(g, 1045, 4140, 25, 220, 10);
    // the diesel tank's bund: a low concrete kerb round the tank, oil soaked inside
    g.fillStyle = 'rgba(40, 36, 32, 0.35)'; g.fillRect(FUEL.x - 170, FUEL.y - 170, 340, 340);
    g.strokeStyle = C.concreteHi; g.lineWidth = 14; g.strokeRect(FUEL.x - 170, FUEL.y - 170, 340, 340);
    g.strokeStyle = 'rgba(28, 31, 38, 0.7)'; g.lineWidth = 2; g.strokeRect(FUEL.x - 177, FUEL.y - 177, 354, 354);
    for (let i = 0; i < 5; i++) blotch(g, FUEL.x + (rand() - 0.5) * 260, FUEL.y + (rand() - 0.5) * 260, 30 + rand() * 40, '10, 8, 10', 0.4);
    // the crane's swing circle painted on the ground, and the no-go hatch under its load
    g.strokeStyle = 'rgba(226, 179, 58, 0.4)'; g.lineWidth = 6; g.setLineDash([30, 22]); g.beginPath(); g.arc(2560, 5160, 300, 0, TAU); g.stroke(); g.setLineDash([]);
    // tyre ruts round the works
    haul(g, [{ x: 500, y: 700 }, { x: 600, y: 1000 }, { x: 1000, y: 1150 }, { x: 1150, y: 800 }], 90);
    haul(g, [{ x: 550, y: 5450 }, { x: 900, y: 5700 }, { x: 1900, y: 5800 }, { x: 2900, y: 5650 }], 100);
  });
  // oil, puddles and dropped stone round the works and the camps
  for (let i = 0; i < 70; i++) {
    const x = rand() * SIZE, y = rand() * SIZE;
    if (levelAt(x, y) !== 0) continue;
    if (rand() < 0.5) puddle(g, x, y, 24 + rand() * 50, rand); else blotch(g, x, y, 20 + rand() * 40, '16, 14, 14', 0.3);
  }
  for (const w of [...wallsOf('qblock'), ...wallsOf('qledge')]) {
    // chips and dust at the foot of every block and outcrop
    for (let i = 0; i < Math.max(2, (w.w + w.h) / 50); i++) {
      const side = Math.floor(rand() * 4), x = side < 2 ? w.x + rand() * w.w : side === 2 ? w.x - 10 : w.x + w.w + 10, y = side === 0 ? w.y - 10 : side === 1 ? w.y + w.h + 24 : w.y + rand() * w.h;
      stone(g, x, y, 2 + rand() * 4, rand() < 0.5 ? C.limeLo : C.lime, rand);
    }
  }
}

/* ------------------------------------------------------------ inside the buildings (found from the roofs, so a floor always matches its room) */

function rooms(g: G, rand: () => number) {
  const furn = (x: number, y: number, w: number, h: number, fill: string) => { g.fillStyle = 'rgba(16, 18, 24, 0.3)'; g.fillRect(x + 3, y + 4, w, h); g.fillStyle = fill; g.fillRect(x, y, w, h); g.strokeStyle = C.ink; g.lineWidth = 1.6; g.strokeRect(x, y, w, h); };
  const chair = (x: number, y: number) => { g.fillStyle = C.steelLo; g.beginPath(); g.arc(x, y, 7, 0, TAU); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 1.2; g.stroke(); };
  for (const r of QUARRY.roofs ?? []) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const q of r.points) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }
    const ix = x0 + 50, iy = y0 + 50, iw = x1 - x0 - 100, ih = y1 - y0 - 100, base = r.id.replace('~', ''), tw = r.id.endsWith('~');
    // Furniture is laid out in the authored (west) room and turned with it, so a twin's room is the same room the other way up.
    g.save();
    if (tw) { g.translate(SIZE, SIZE); g.rotate(Math.PI); }
    const X = tw ? SIZE - ix - iw : ix, Y = tw ? SIZE - iy - ih : iy;
    if (r.material === 'cabin') {
      g.fillStyle = '#7d8a8e'; g.fillRect(X, Y, iw, ih);
      for (let ty = Y; ty < Y + ih; ty += 25) for (let tx = X; tx < X + iw; tx += 25) if (((tx - X) / 25 + (ty - Y) / 25) % 2 === 0) { g.fillStyle = 'rgba(255, 255, 255, 0.06)'; g.fillRect(tx, ty, 25, 25); }
      for (let i = 0; i < 6; i++) blotch(g, X + rand() * iw, Y + rand() * ih, 20 + rand() * 20, '60, 50, 40', 0.2);
      if (base === 'office') {
        furn(X + 40, Y + 30, 150, 70, C.wood); g.fillStyle = '#e8e2cc'; g.fillRect(X + 52, Y + 38, 70, 50); g.strokeStyle = 'rgba(40, 70, 130, 0.7)'; g.lineWidth = 1.4; g.strokeRect(X + 58, Y + 44, 56, 36); g.beginPath(); g.ellipse(X + 86, Y + 62, 18, 12, 0, 0, TAU); g.stroke();
        chair(X + 115, Y + 115); chair(X + 70, Y + 115);
        for (let k = 0; k < 4; k++) furn(X + iw - 46, Y + 20 + k * 36, 36, 30, '#8a9098');
        for (let k = 0; k < 5; k++) { g.fillStyle = [C.hivis, C.bone, C.hivis, C.orange, C.cabinBlue][k]!; g.beginPath(); g.arc(X + 220 + k * 24, Y + ih - 22, 9, 0, TAU); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 1.2; g.stroke(); }
      } else if (base === 'canteen') {
        for (const ty of [Y + 60, Y + 260]) { furn(X + 40, ty, 80, 120, '#c9c1a6'); for (const k of [0, 1, 2]) { chair(X + 28, ty + 20 + k * 40); chair(X + 132, ty + 20 + k * 40); } }
        furn(X + 20, Y + ih - 60, iw - 40, 34, C.steelHi); g.fillStyle = C.red; g.beginPath(); g.arc(X + 50, Y + ih - 43, 8, 0, TAU); g.fill();
      } else if (base === 'control') {
        furn(X + 20, Y + 20, iw - 40, 40, C.steelLo); for (let k = 0; k < 4; k++) { g.fillStyle = '#5fb7a0'; g.fillRect(X + 34 + k * 44, Y + 26, 30, 20); }
        chair(X + iw / 2, Y + 90);
      } else if (base === 'lab') {
        furn(X + 20, Y + 20, iw - 40, 40, '#a9b0b6'); for (let k = 0; k < 5; k++) { g.fillStyle = k % 2 ? '#d8cfb8' : '#c9b48a'; g.beginPath(); g.roundRect(X + 30 + k * 34, Y + 26, 24, 28, 5); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 1; g.stroke(); }
        for (let k = 0; k < 4; k++) { g.strokeStyle = C.steelHi; g.lineWidth = 3; g.beginPath(); g.arc(X + 60, Y + 110, 26 - k * 5, 0, TAU); g.stroke(); }
      } else {
        furn(X + 20, Y + 20, 110, 50, C.wood); chair(X + 70, Y + 90); furn(X + iw - 60, Y + 20, 40, 40, '#8a9098');
      }
    } else if (r.material === 'bunker') {
      g.fillStyle = '#6a6e72'; g.fillRect(X, Y, iw, ih);
      g.strokeStyle = 'rgba(200, 210, 220, 0.16)'; g.lineWidth = 2;
      for (let ty = Y + 8; ty < Y + ih; ty += 16) for (let tx = X + 8 + ((ty - Y) % 32 ? 8 : 0); tx < X + iw; tx += 16) { g.beginPath(); g.moveTo(tx - 4, ty - 2); g.lineTo(tx + 4, ty + 2); g.stroke(); }
      for (let k = 0; k < 4; k++) { furn(X + 16 + k * 56, Y + 14, 44, 30, C.red); g.fillStyle = C.bone; g.fillRect(X + 22 + k * 56, Y + 26, 32, 5); }
      for (let k = 0; k < 3; k++) furn(X + 16, Y + 70 + k * 40, 30, 30, C.woodLo);
    } else {
      g.fillStyle = '#6e6c66'; g.fillRect(X, Y, iw, ih);
      for (let i = 0; i < 18; i++) blotch(g, X + rand() * iw, Y + rand() * ih, 20 + rand() * 50, '14, 12, 12', 0.35);
      // the vehicle lift's two runways, the workbench along the back wall, the red tool chest
      g.fillStyle = 'rgba(226, 179, 58, 0.5)'; g.fillRect(X + iw * 0.3, Y + 60, 34, 230); g.fillRect(X + iw * 0.3 + 110, Y + 60, 34, 230);
      g.strokeStyle = C.hivis; g.lineWidth = 4; g.setLineDash([16, 10]); g.strokeRect(X + iw * 0.3 - 30, Y + 40, 204, 270); g.setLineDash([]);
      furn(X + 20, Y + 10, iw - 120, 34, C.woodLo);
      for (let k = 0; k < 8; k++) { g.fillStyle = [C.red, C.steelHi, C.hivis, C.cabinBlue][k % 4]!; g.fillRect(X + 30 + k * 40, Y + 18, 22, 10); }
      furn(X + iw - 90, Y + ih - 90, 70, 70, C.red); g.fillStyle = C.steelDark; for (let k = 0; k < 4; k++) g.fillRect(X + iw - 84, Y + ih - 82 + k * 16, 58, 4);
    }
    g.restore();
  }
}

/* ------------------------------------------------------------ spawn pads */

function pads(g: G) {
  const muster = (r: { x: number; y: number; w: number; h: number }, col: string) => {
    g.fillStyle = 'rgba(16, 18, 24, 0.3)'; g.fillRect(r.x - 10, r.y - 6, r.w + 24, r.h + 20);
    g.fillStyle = hexA(col, 0.38); g.fillRect(r.x - 12, r.y - 12, r.w + 24, r.h + 24);
    g.fillStyle = 'rgba(60, 64, 58, 0.5)'; g.fillRect(r.x + 10, r.y + 10, r.w - 20, r.h - 20);
    hazard(g, r.x - 12, r.y - 12, r.w + 24, 12, 12, col, C.ink); hazard(g, r.x - 12, r.y + r.h, r.w + 24, 12, 12, col, C.ink);
    g.strokeStyle = C.ink; g.lineWidth = 2.4; g.strokeRect(r.x - 12, r.y - 12, r.w + 24, r.h + 24);
    // the green muster-point board: a cross of four arrows toward a stick figure family
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    g.fillStyle = 'rgba(70, 150, 90, 0.75)'; g.fillRect(cx - 50, cy - 50, 100, 100);
    g.strokeStyle = C.bone; g.lineWidth = 4; g.lineCap = 'round';
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) { g.beginPath(); g.moveTo(cx + dx * 44, cy + dy * 44); g.lineTo(cx + dx * 28, cy + dy * 28); g.stroke(); }
    for (const [fx, s] of [[-12, 1], [0, 0.8], [12, 1]] as const) { g.beginPath(); g.arc(cx + fx, cy - 12 * s, 4 * s, 0, TAU); g.moveTo(cx + fx, cy - 7 * s); g.lineTo(cx + fx, cy + 8 * s); g.moveTo(cx + fx - 6 * s, cy); g.lineTo(cx + fx + 6 * s, cy); g.moveTo(cx + fx, cy + 8 * s); g.lineTo(cx + fx - 5 * s, cy + 17 * s); g.moveTo(cx + fx, cy + 8 * s); g.lineTo(cx + fx + 5 * s, cy + 17 * s); g.stroke(); }
    text(g, 'MUSTER POINT', cx, r.y + 60, 22, hexA(C.bone, 0.7), r.h > r.w ? 0 : 0);
  };
  for (const r of QUARRY.spawns.red) muster(r, '#b4524a');
  for (const r of QUARRY.spawns.blue) muster(r, '#4f7fbf');
  const onTeam = (r: { x: number; y: number }) => [...QUARRY.spawns.red, ...QUARRY.spawns.blue].some((q) => r.x >= q.x && r.x < q.x + q.w && r.y >= q.y && r.y < q.y + q.h);
  for (const r of QUARRY.spawns.ffa) {
    if (onTeam(r)) continue;
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2, R = Math.min(r.w, r.h) / 2 + 26;
    const rand = seeded(Math.round(cx * 7 + cy));
    for (let a = 0; a < TAU; a += 0.32) stone(g, cx + Math.cos(a) * R, cy + Math.sin(a) * R * 0.9, 8, C.lime, rand);
    text(g, 'FFA', cx, cy, 28, hexA(C.bone, 0.45));
  }
}

/* ------------------------------------------------------------------------------------------------------------------ */

export function paintQuarryFloor(g: G, size: number, seed: number, plan: FloorPlan) {
  void size; void plan;
  const rand = seeded(seed ^ 0x9a11);
  ground(g, rand);
  works(g, rand);
  rooms(g, rand);
  terraces(g, rand);
  pitFloor(g, rand);
  ramps(g, rand);
  haulRoads(g);
  words(g);
  pads(g);
  paintQuarryDecor(g);
  // the world's rim darkens so it feels finished
  const rim = 220;
  for (const [x0, y0, x1, y1, rx, ry, rw, rh] of [[0, 0, 0, rim, 0, 0, SIZE, rim], [0, SIZE, 0, SIZE - rim, 0, SIZE - rim, SIZE, rim], [0, 0, rim, 0, 0, 0, rim, SIZE], [SIZE, 0, SIZE - rim, 0, SIZE - rim, 0, rim, SIZE]] as const) {
    const grad = g.createLinearGradient(x0, y0, x1, y1);
    grad.addColorStop(0, 'rgba(14, 12, 10, 0.4)'); grad.addColorStop(1, 'rgba(14, 12, 10, 0)');
    g.fillStyle = grad; g.fillRect(rx, ry, rw, rh);
  }
  void both; void turn;
}
