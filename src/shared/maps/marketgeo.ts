/**
 * Night Market geometry (docs/maps/GEOMETRY.md), authored for the west half; `withGeometry` adds the half-turn twin.
 * - The Old Canal: open water bodies cannot cross but rounds and sight pass over, cut by three bridges.
 * - Roofs over the walled halls (temple, night bazaar, parking deck, arcade) and the open canopies: the covered produce market and
 *   the tarps strung over the narrow lantern alleys. The halls' walls are thin shopfront cells in the grid (market.ts).
 * - A few roll-up shutters and doors in the halls' gaps, round food carts, the round shrine posts and the parking deck's pillars.
 */
import { make, poly, type MapDoor, type MapPoly, type MapRoof, type Pt } from '../geom.ts';
import type { Geometry } from '../mapgeo.ts';

const P = (s: string): Pt[] => poly.fromPath(s);
const rect = (x0: number, y0: number, x1: number, y1: number): Pt[] => poly.rect(x0, y0, x1 - x0, y1 - y0);
const water = (id: string, pts: Pt[]): MapPoly => make(pts, 'canal', { id, height: 0, blocksBullets: false, blocksSight: false, shape: 'canal' });

/** The canal runs east from the west edge and ends in a round basin short of the crossing; the gaps are the bridges. */
export const CANAL = {
  /** The bridges: the dry gaps between the water's pieces (west half). */
  bridges: [{ x0: 400, x1: 550, y0: 2025, y1: 2175 }, { x0: 1250, x1: 1400, y0: 1925, y1: 2075 }, { x0: 2050, x1: 2200, y0: 1925, y1: 2075 }] as const,
  polys: [
    water('canal-a', rect(0, 2025, 400, 2175)),
    water('canal-b', P('550,2025 800,2025 1000,1925 1250,1925 1250,2075 1000,2075 800,2175 550,2175')),
    water('canal-c', rect(1400, 1925, 2050, 2075)),
    water('canal-d', [...rect(2200, 1925, 2400, 2075).slice(0, 1), ...Array.from({ length: 9 }, (_, i) => {
      const a = -Math.PI / 2 + (i / 8) * Math.PI;
      return { x: Math.round(2400 + Math.cos(a) * 110), y: Math.round(2000 + Math.sin(a) * 110) };
    }), { x: 2200, y: 2075 }]),
  ],
};

/** The halls: outer boxes of their grid walls (market.ts), each with a roof. */
export const HALLS = {
  temple: { x0: 250, y0: 200, x1: 850, y1: 650 },
  bazaar: { x0: 1950, y0: 1150, x1: 2550, y1: 1650 },
  parking: { x0: 250, y0: 4000, x1: 1050, y1: 4700 },
  arcade: { x0: 1150, y0: 5150, x1: 1800, y1: 5650 },
} as const;
/** Open-sided canopies: the produce market and the tarps over the narrow alleys. */
export const CANOPIES = {
  produce: { x0: 950, y0: 3150, x1: 1650, y1: 3700 },
  'alley-a': { x0: 1200, y0: 450, x1: 1300, y1: 800 },
  'alley-b': { x0: 1650, y0: 400, x1: 1750, y1: 900 },
  'alley-c': { x0: 2150, y0: 5300, x1: 2250, y1: 5650 },
  'alley-d': { x0: 2450, y0: 4900, x1: 2550, y1: 5150 },
} as const;

const PILLARS: readonly (readonly [number, number])[] = [[475, 4225], [825, 4225], [475, 4475], [825, 4475]];
const CARTS: readonly (readonly [number, number])[] = [[1450, 1050], [1000, 1650], [1950, 2750], [1050, 4800], [2100, 4650]];
const SHRINES: readonly (readonly [number, number])[] = [[550, 900], [2950, 175]];

const POLYS: MapPoly[] = [
  ...CANAL.polys,
  ...PILLARS.map(([x, y], i) => make(poly.circle(x, y, 32, 12), 'pillar', { id: `pillar-${i}`, height: 30, shape: 'pillar' })),
  ...CARTS.map(([x, y], i) => make(poly.capsule(x + 50, y + 50, x + 150, y + 50, 50, 6), 'cart', { id: `cart-${i}`, height: 14, shape: 'cart' })),
  ...SHRINES.map(([x, y], i) => make(poly.circle(x, y, 75, 16), 'shrine', { id: `shrine-${i}`, height: 26, shape: 'shrine' })),
];

const DOORS: MapDoor[] = [
  { id: 'temple-e', kind: 'swing', x: 825, y: 350, w: 100, axis: 'v', material: 'wood' },
  { id: 'bazaar-n', kind: 'slide', x: 2300, y: 1175, w: 150, axis: 'h', material: 'metal', hinge: 'start', closeMs: 1800, glow: '#ffc27a' },
  { id: 'arcade-e', kind: 'double-slide', x: 1775, y: 5300, w: 150, axis: 'v', material: 'glass', glow: '#6fb8ff' },
];

const box = (r: { x0: number; y0: number; x1: number; y1: number }) => rect(r.x0, r.y0, r.x1, r.y1);
const ROOFS: MapRoof[] = [
  ...Object.entries(HALLS).map(([id, r]): MapRoof => ({ id: `hall-${id}`, points: box(r), material: id })),
  ...Object.entries(CANOPIES).map(([id, r]): MapRoof => ({ id: `canopy-${id}`, points: box(r), material: id === 'produce' ? 'canopy' : 'tarp' })),
];

export const MARKET_GEO: Geometry = { polys: POLYS, doors: DOORS, roofs: ROOFS };
