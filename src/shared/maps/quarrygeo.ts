/**
 * Quarry's polygons, doors and roofs, authored once; `withGeometry` adds each piece's half-turn twin (ids gain a `~`).
 * The open pit is a terraced oval round the middle of the map: two rings of rock ledge (the bench faces), each broken by haul
 * ramps, round a pit floor where B sits. Round the rim stand the plant and its stockpiles: gravel cones, raised conveyors (they
 * stop a body but not a round), the settling pond, the fuel tank, a tower crane's footing, a haul truck and an excavator.
 * The client theme (src/client/themes/quarry*.ts) reads `PIT`, `TRUCKS`, `DIGGERS` and `CRANES` to paint them.
 */
import { make, poly, type MapDoor, type MapPoly, type MapRoof, type Pt } from '../geom.ts';
import type { Geometry } from '../mapgeo.ts';

const TAU = Math.PI * 2;

/** The pit's centre and its three ovals (x and y radii): the floor ledge, the middle ledge and the rim, which is painted only. */
export const PIT = {
  x: 3000, y: 3000,
  floor: { rx: 700, ry: 820 },
  mid: { rx: 1150, ry: 1300 },
  rim: { rx: 1600, ry: 1780 },
  /** How thick a ledge is, measured inward from its oval. */
  t: 55,
} as const;

/** A band of an oval ring from angle `a0` to `a1`: the outer edge on the oval (rx, ry), the inner edge `t` px inside it. */
export function ovalBand(cx: number, cy: number, rx: number, ry: number, t: number, a0: number, a1: number, step = 0.07): Pt[] {
  const n = Math.max(2, Math.ceil((a1 - a0) / step));
  const outer: Pt[] = [], inner: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n, c = Math.cos(a), s = Math.sin(a);
    outer.push({ x: cx + rx * c, y: cy + ry * s });
    inner.push({ x: cx + (rx - t) * c, y: cy + (ry - t) * s });
  }
  return [...outer, ...inner.reverse()];
}

const P = Math.PI;
/** The ledges of the west half (the half-turn adds the east): the floor ledge is open north, south and west; the middle ledge at its two diagonals. */
const LEDGES: readonly { id: string; ring: 'floor' | 'mid'; a0: number; a1: number }[] = [
  { id: 'floor-sw', ring: 'floor', a0: P / 2 + 0.22, a1: P - 0.13 },
  { id: 'floor-nw', ring: 'floor', a0: P + 0.13, a1: (3 * P) / 2 - 0.22 },
  { id: 'mid-s', ring: 'mid', a0: P / 2 - 0.3, a1: P - 0.72 },
  { id: 'mid-w', ring: 'mid', a0: P - 0.44, a1: P + 0.44 },
  { id: 'mid-n', ring: 'mid', a0: P + 0.72, a1: (3 * P) / 2 - 0.3 },
];
const ledgePolys = LEDGES.map((l) => {
  const o = PIT[l.ring];
  return make(ovalBand(PIT.x, PIT.y, o.rx, o.ry, PIT.t, l.a0, l.a1), 'qrock', { id: `ledge-${l.id}`, height: 22, part: l.ring });
});

/** Gravel cones: stockpiles of crushed stone by size. */
export const HEAPS: readonly { id: string; x: number; y: number; r: number; grade: string }[] = [
  { id: 'heap-20', x: 2330, y: 330, r: 150, grade: '20MM' },
  { id: 'heap-40', x: 2760, y: 560, r: 170, grade: '40MM' },
  { id: 'heap-dust', x: 1580, y: 1090, r: 120, grade: 'DUST' },
];
const heapPolys = HEAPS.map((h) => make(poly.circle(h.x, h.y, h.r, 20), 'qgravel', { id: h.id, height: 26 }));

/** Raised belt conveyors from the crusher out to the stockpiles: a body cannot cross, a round and a look pass under. */
export const BELTS: readonly { id: string; x0: number; y0: number; x1: number; y1: number }[] = [
  { id: 'belt-1', x0: 1610, y0: 420, x1: 2190, y1: 350 },
  { id: 'belt-2', x0: 2380, y0: 470, x1: 2620, y1: 600 },
  { id: 'belt-3', x0: 1420, y0: 620, x1: 1530, y1: 975 },
];
const BELT_W = 44;
const beltPts = (b: (typeof BELTS)[number]): Pt[] => {
  const a = Math.atan2(b.y1 - b.y0, b.x1 - b.x0), nx = -Math.sin(a) * (BELT_W / 2), ny = Math.cos(a) * (BELT_W / 2);
  return [{ x: b.x0 + nx, y: b.y0 + ny }, { x: b.x1 + nx, y: b.y1 + ny }, { x: b.x1 - nx, y: b.y1 - ny }, { x: b.x0 - nx, y: b.y0 - ny }];
};
const beltPolys = BELTS.map((b) => make(beltPts(b), 'qbelt', { id: b.id, height: 12, blocksBullets: false, blocksSight: false }));

/** The settling pond in the blasting yard: wade-proof, but rounds and eyes cross it. */
export const POND = { x: 1350, y: 5290, rx: 380, ry: 210 } as const;
const pondPts = Array.from({ length: 28 }, (_, i) => {
  const a = (i / 28) * TAU, wob = 1 + 0.06 * Math.sin(a * 3 + 0.7) + 0.04 * Math.cos(a * 5);
  return { x: POND.x + Math.cos(a) * POND.rx * wob, y: POND.y + Math.sin(a) * POND.ry * wob };
});

/** The diesel tank by the site office. */
export const FUEL = { x: 1150, y: 2260, r: 105 } as const;

/** Vehicles: where each stands and which way its nose points (radians, nose toward +x at 0); the outline is the body's footprint. */
export const TRUCKS: readonly { id: string; x: number; y: number; rot: number }[] = [
  { id: 'truck-bench', x: 2638, y: 3909, rot: -2.66 },
  { id: 'truck-weigh', x: 700, y: 4250, rot: 0 },
];
export const DIGGERS: readonly { id: string; x: number; y: number; rot: number }[] = [
  { id: 'digger-floor', x: 2640, y: 3150, rot: 2.43 },
];
/** Tower cranes: the mast's footing is solid; the jib is drawn overhead by the theme. */
export const CRANES: readonly { id: string; x: number; y: number; jib: number }[] = [
  { id: 'crane-yard', x: 2560, y: 5160, jib: 820 },
];

const boxAt = (x: number, y: number, rot: number, hx: number, hy: number): Pt[] => {
  const c = Math.cos(rot), s = Math.sin(rot);
  return [[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]].map(([u, v]) => ({ x: x + u! * c - v! * s, y: y + u! * s + v! * c }));
};

const POLYS: MapPoly[] = [
  ...ledgePolys,
  ...heapPolys,
  ...beltPolys,
  make(pondPts, 'qwater', { id: 'pond', height: 0, blocksBullets: false, blocksSight: false }),
  make(poly.circle(FUEL.x, FUEL.y, FUEL.r, 22), 'qtank', { id: 'fuel', height: 40, shape: 'roundTank' }),
  ...TRUCKS.map((t) => make(boxAt(t.x, t.y, t.rot, 205, 100), 'qtruck', { id: t.id, height: 30, shape: 'dumpTruck' })),
  ...DIGGERS.map((d) => make(boxAt(d.x, d.y, d.rot, 135, 98), 'qdigger', { id: d.id, height: 30, shape: 'excavator' })),
  ...CRANES.map((c) => make(poly.rect(c.x - 55, c.y - 55, 110, 110), 'qcrane', { id: c.id, height: 40 })),
];

/* ---------------------------------------------------------------- rooms: grid walls (quarry.ts) with doors in their gaps */

const DOORS: MapDoor[] = [
  // Workshop: a roller door (double slide) south, a man door east.
  { id: 'shop-s', kind: 'double-slide', x: 400, y: 625, w: 200, axis: 'h', material: 'metal', closeMs: 1800 },
  { id: 'shop-e', kind: 'swing', x: 825, y: 350, w: 150, axis: 'v', hinge: 'start', material: 'metal' },
  // Control cabin.
  { id: 'control-w', kind: 'swing', x: 1725, y: 750, w: 100, axis: 'v', hinge: 'start', material: 'wood' },
  // Site office and canteen portacabins.
  { id: 'office-e', kind: 'double-swing', x: 675, y: 1450, w: 150, axis: 'v', material: 'wood', glow: '#ffe2b0' },
  { id: 'office-s', kind: 'swing', x: 250, y: 1675, w: 150, axis: 'h', hinge: 'start', material: 'wood' },
  { id: 'canteen-w', kind: 'swing', x: 875, y: 1500, w: 150, axis: 'v', hinge: 'end', material: 'wood', glow: '#ffd28a' },
  { id: 'canteen-s', kind: 'swing', x: 950, y: 1875, w: 100, axis: 'h', hinge: 'start', material: 'wood' },
  // Sample lab.
  { id: 'lab-s', kind: 'swing', x: 2400, y: 1175, w: 100, axis: 'h', hinge: 'start', material: 'wood' },
  // Weigh hut.
  { id: 'weigh-w', kind: 'swing', x: 1075, y: 4050, w: 100, axis: 'v', hinge: 'start', material: 'wood' },
  // Blasting shed: steel blast doors.
  { id: 'magazine-n', kind: 'double-slide', x: 450, y: 5025, w: 100, axis: 'h', material: 'metal', closeMs: 1800 },
  { id: 'magazine-e', kind: 'swing', x: 675, y: 5150, w: 100, axis: 'v', hinge: 'start', material: 'metal' },
];

const room = (id: string, c0: number, r0: number, c1: number, r1: number, material: string): MapRoof => ({ id, material, points: poly.rect(c0 * 50, r0 * 50, (c1 - c0 + 1) * 50, (r1 - r0 + 1) * 50) });
const ROOFS: MapRoof[] = [
  room('shop', 3, 3, 16, 12, 'corrugated'),
  room('control', 34, 13, 39, 17, 'cabin'),
  room('lab', 46, 19, 51, 23, 'cabin'),
  room('office', 2, 27, 13, 33, 'cabin'),
  room('canteen', 17, 26, 22, 37, 'cabin'),
  room('weigh', 21, 79, 27, 84, 'cabin'),
  room('magazine', 7, 100, 13, 106, 'bunker'),
];

export const QUARRY_GEO: Geometry = { polys: POLYS, doors: DOORS, roofs: ROOFS };
