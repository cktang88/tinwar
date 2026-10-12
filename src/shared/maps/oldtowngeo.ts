/**
 * Old Town geometry, authored for the west half (withGeometry adds each piece's half-turn twin): the canal that cuts across the
 * north quarter (water you cannot wade but can see and shoot across), the church's apse, bell tower, altar and pews, the West Gate's
 * two round towers, the fountain on the church square, the well in the market, a few handcarts and the lime trees; then every
 * house's doors and roofs, two covered archways, and the church roof that follows the apse round.
 */
import { make, poly, type MapDoor, type MapPoly, type MapRoof, type Pt } from '../geom.ts';
import type { Geometry } from '../mapgeo.ts';

/** The canal: rows 24..27 of the grid, broken by three bridges whose stone parapets are grid walls. */
export const CANAL = { y: 1200, h: 200, runs: [[0, 250], [550, 1250], [1550, 2250], [2550, 2900]] as const, bridges: [300, 1300, 2300] as const, bridgeW: 200 } as const;
export const CHURCH = { x0: 500, y0: 1700, x1: 1550, y1: 2300, apse: { x: 1550, y: 2000, rIn: 250, rOut: 300 }, tower: { x: 500, y: 1700, r: 120 } } as const;
export const FOUNTAIN = { x: 1475, y: 2575, r: 120 } as const;
export const WELL = { x: 2700, y: 2800, r: 60 } as const;
export const GATE_TOWERS: readonly (readonly [number, number])[] = [[480, 2575], [480, 3430]];
export const GATE_TOWER_R = 85;
/** Handcarts: centre, turn. */
export const CARTS: readonly (readonly [number, number, number])[] = [[1300, 760, -0.2], [1420, 4060, 0.35], [1950, 5150, -0.5]];
/** Lime trees: the trunk is solid, the crown is drawn over the players by the theme. */
export const TREES: readonly (readonly [number, number])[] = [[1100, 2340], [750, 2750], [2200, 2250], [1420, 4660], [700, 5060]];
export const TREE_TRUNK = 26;
/** Pews: the grid columns they stand in, north and south of the nave's aisle. */
export const PEW_COLS = [14, 17, 20, 23, 26] as const;

const PI = Math.PI;
const POLYS: MapPoly[] = [
  ...CANAL.runs.map(([x0, x1], i) => make(poly.rect(x0, CANAL.y, x1 - x0, CANAL.h), 'otcanal', { id: `canal-${i}`, group: 'canal', height: 0, blocksBullets: false, blocksSight: false })),
  make(poly.arc(CHURCH.apse.x, CHURCH.apse.y, CHURCH.apse.rIn, CHURCH.apse.rOut, -PI / 2, PI / 2, 14), 'otstone', { id: 'apse', group: 'church', shape: 'apse', height: 18 }),
  make(poly.circle(CHURCH.tower.x, CHURCH.tower.y, CHURCH.tower.r, 20), 'otstone', { id: 'belltower', shape: 'belltower', height: 60 }),
  make(poly.rect(1610, 1940, 60, 120), 'otaltar', { id: 'altar', group: 'church', height: 12 }),
  ...PEW_COLS.flatMap((c, i) => [1800, 2050].map((y, j) => make(poly.rect(c * 50 + 6, y, 38, 150), 'otpew', { id: `pew-${i}-${j}`, group: 'pews', height: 10, blocksBullets: false, blocksSight: false }))),
  ...GATE_TOWERS.map(([x, y], i) => make(poly.circle(x, y, GATE_TOWER_R, 16), 'otstone', { id: `gatetower-${i}`, shape: 'gatetower', height: 56 })),
  make(poly.circle(FOUNTAIN.x, FOUNTAIN.y, FOUNTAIN.r, 22), 'otfountain', { id: 'fountain', height: 14, blocksBullets: false, blocksSight: false }),
  make(poly.circle(WELL.x, WELL.y, WELL.r, 14), 'otwell', { id: 'well', height: 22 }),
  ...CARTS.map(([x, y, rot], i) => make(poly.transform(poly.rect(-58, -32, 116, 64), { x, y, rot }), 'otcart', { id: `cart-${i}`, shape: 'cart', height: 22 })),
  ...TREES.map(([x, y], i) => make(poly.circle(x, y, TREE_TRUNK, 10), 'ottree', { id: `tree-${i}`, height: 30 })),
];

const door = (id: string, kind: MapDoor['kind'], x: number, y: number, w: number, axis: 'h' | 'v'): MapDoor => ({ id, kind, x, y, w, axis, material: 'wood', ...(kind === 'swing' && { hinge: 'start' as const }) });
const DOORS: MapDoor[] = [
  door('tavern-s0', 'double-swing', 300, 525, 100, 'h'),
  door('tavern-e1', 'swing', 675, 200, 100, 'v'),
  door('bakery-s0', 'swing', 1100, 575, 100, 'h'),
  door('bakery-w1', 'swing', 925, 300, 100, 'v'),
  door('weaver-s0', 'swing', 1850, 475, 100, 'h'),
  door('tall-s0', 'swing', 2400, 675, 100, 'h'),
  door('corner-w0', 'swing', 2725, 250, 100, 'v'),
  door('corner-s1', 'swing', 2800, 475, 100, 'h'),
  door('church-w0', 'double-swing', 525, 1950, 100, 'v'),
  door('church-s1', 'swing', 900, 2275, 100, 'h'),
  door('church-n2', 'swing', 1200, 1725, 100, 'h'),
  door('apothecary-s0', 'swing', 2150, 1975, 100, 'h'),
  door('apothecary-w1', 'swing', 1975, 1600, 100, 'v'),
  door('guild-w0', 'double-swing', 2575, 1700, 100, 'v'),
  door('guild-s1', 'swing', 2650, 2075, 100, 'h'),
  door('cafe-s0', 'double-swing', 2600, 2525, 100, 'h'),
  door('cafe-w1', 'swing', 2375, 2300, 100, 'v'),
  door('laundry-n0', 'swing', 750, 2875, 100, 'h'),
  door('laundry-s2', 'swing', 950, 3375, 100, 'h'),
  door('merchant-w0', 'swing', 1625, 2750, 100, 'v'),
  door('merchant-e1', 'swing', 2175, 2800, 100, 'v'),
  door('counting-n0', 'swing', 1850, 3125, 100, 'h'),
  door('counting-e1', 'swing', 2175, 3200, 100, 'v'),
  door('clothhall-n0', 'double-swing', 2500, 3625, 100, 'h'),
  door('clothhall-w1', 'swing', 2325, 3750, 100, 'v'),
  door('cottage1-e0', 'swing', 525, 3900, 100, 'v'),
  door('cottage1-n1', 'swing', 200, 3725, 100, 'h'),
  door('cottage2-e0', 'swing', 525, 4600, 100, 'v'),
  door('cottage2-s1', 'swing', 250, 4925, 100, 'h'),
  door('cooper-e0', 'double-swing', 1225, 3900, 100, 'v'),
  door('cooper-n1', 'swing', 900, 3725, 100, 'h'),
  door('stable-n0', 'double-swing', 1800, 3725, 150, 'h'),
  door('stable-s1', 'swing', 2000, 4225, 100, 'h'),
  door('house_e1-w0', 'swing', 2325, 4300, 100, 'v'),
  door('house_e1-s1', 'swing', 2600, 4525, 100, 'h'),
  door('house_e2-w0', 'swing', 2475, 4850, 100, 'v'),
  door('posthouse-n0', 'double-swing', 250, 5225, 100, 'h'),
  door('posthouse-e1', 'swing', 625, 5500, 100, 'v'),
  door('house_s1-n0', 'swing', 1300, 5275, 100, 'h'),
  door('house_s1-e1', 'swing', 1675, 5500, 100, 'v'),
  door('house_s2-n0', 'swing', 2000, 5375, 100, 'h'),
  door('house_s3-w0', 'swing', 2475, 5350, 100, 'v'),
  door('house_s3-s1', 'swing', 2650, 5675, 100, 'h'),
];

const roof = (id: string, material: string, x: number, y: number, w: number, h: number): MapRoof => ({ id, material, points: poly.rect(x, y, w, h) });
const apseRoof = (): Pt[] => {
  const { x0, y0, x1, y1, apse } = CHURCH;
  const arc = Array.from({ length: 15 }, (_, i) => { const a = -PI / 2 + (i / 14) * PI; return { x: apse.x + Math.cos(a) * apse.rOut, y: apse.y + Math.sin(a) * apse.rOut }; });
  return [{ x: x0, y: y0 }, { x: x1, y: y0 }, ...arc.slice(1, -1), { x: x1, y: y1 }, { x: x0, y: y1 }];
};
const ROOFS: MapRoof[] = [
  { id: 'church', material: 'slate', points: apseRoof() },
  roof('tavern', 'tile', 0, 0, 700, 550),
  roof('bakery', 'tile', 900, 0, 600, 600),
  roof('weaver', 'slate', 1700, 0, 500, 500),
  roof('tall', 'tile', 2300, 0, 300, 700),
  roof('corner', 'shingle', 2700, 0, 300, 500),
  roof('apothecary', 'tile', 1950, 1500, 500, 500),
  roof('guild', 'slate', 2550, 1500, 350, 600),
  roof('cafe', 'tile', 2350, 2200, 650, 350),
  roof('laundry', 'tile', 600, 2850, 550, 550),
  roof('merchant', 'tile', 1600, 2650, 600, 350),
  roof('archway', 'tile', 1600, 3000, 600, 100),
  roof('counting', 'tile', 1600, 3100, 600, 350),
  roof('clothhall', 'slate', 2300, 3600, 600, 450),
  roof('cottage1', 'shingle', 0, 3700, 550, 550),
  roof('cottage2', 'tile', 0, 4400, 550, 550),
  roof('cooper', 'shingle', 700, 3700, 550, 500),
  roof('stable', 'shingle', 1600, 3700, 600, 550),
  roof('house_e1', 'tile', 2300, 4200, 600, 350),
  roof('house_e2', 'shingle', 2450, 4750, 550, 350),
  roof('posthouse', 'slate', 0, 5200, 650, 800),
  roof('house_s1', 'tile', 1100, 5250, 600, 750),
  roof('house_s2', 'shingle', 1850, 5350, 500, 650),
  roof('house_s3', 'tile', 2450, 5200, 450, 500),
];

export const OLDTOWN_GEOMETRY: Geometry = { polys: POLYS, doors: DOORS, roofs: ROOFS };
