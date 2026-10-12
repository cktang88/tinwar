/**
 * Plaza: a downtown block round a civic square. The west half is drawn as a 50 px plan in plaza.ts; its building letters become
 * polygons here (one rect per merged run), and the round and odd-shaped things (the fountain ring, the statue, trees, the bus, parked
 * cars, food trucks, cafe tables) are listed by hand. withGeometry adds the half turn of every piece, so the east half is the same
 * bones dressed as other places: the theme (src/client/themes/plaza*.ts) reads `PLACES` to know what each room is on each side.
 */
import { make, poly, type MapDoor, type MapPoly, type MapRoof, type Pt } from '../geom.ts';
import type { Geometry } from '../mapgeo.ts';

const CELL = 50;
export const PLAZA_SIZE = 6000;

/** Plan letters: the polygon material each stands for, its front-face height, and whether rounds and sight pass. */
export const PLAN_KEY: Readonly<Record<string, { material: string; height: number; low?: true }>> = {
  W: { material: 'pzwall', height: 18 },     // facade wall
  I: { material: 'pzpart', height: 14 },     // block courses of the frame going up
  G: { material: 'pzglass', height: 16 },    // shopfront and curtain glass on a low sill
  K: { material: 'pzdesk', height: 12 },     // counters, desks, booths, turnstiles
  S: { material: 'pzshelf', height: 16 },    // shelving: books, groceries, pastries
  P: { material: 'pzplanter', height: 14 },  // concrete planters with shrubs
  H: { material: 'pzhoard', height: 20 },    // the site hoarding
  O: { material: 'pzpillar', height: 22 },   // concrete columns
  Q: { material: 'pzstack', height: 14 },    // pallets of block, rebar, pipe
  E: { material: 'pzcore', height: 20 },     // lift cores, ramps, ovens
  Y: { material: 'pzscaffold', height: 24, low: true }, // scaffolding: you can see and shoot through it
  C: { material: 'pzcabin', height: 22 },    // the site office cabin
  M: { material: 'pzmetro', height: 10, low: true },    // the metro stairwell under its canopy
  N: { material: 'pzkiosk', height: 20 },    // the newsstand
  L: { material: 'pzhedge', height: 22 },    // park hedges
};
export const PLAN_LETTERS = new RegExp(`[${Object.keys(PLAN_KEY).join('')}]`, 'g');

function planRows(text: string): string[] {
  const lines = text.split('\n').map((l) => l.trimEnd());
  while (lines.length && lines[0] === '') lines.shift();
  while (lines.length && lines.at(-1) === '') lines.pop();
  const indent = Math.min(...lines.filter((l) => l !== '').map((l) => l.length - l.trimStart().length));
  return lines.map((l) => l.slice(indent));
}

/** Every plan letter as merged rect polygons: runs along a row first, then grown down while the next row holds the same run. */
export function planPolys(text: string): MapPoly[] {
  const rows = planRows(text);
  const out: MapPoly[] = [];
  const count = new Map<string, number>();
  for (const [ch, spec] of Object.entries(PLAN_KEY)) {
    const on = rows.map((row) => [...row].map((c) => c === ch));
    const used = on.map((r) => r.map(() => false));
    const free = (x: number, y: number) => y >= 0 && y < on.length && x >= 0 && x < on[y]!.length && on[y]![x]! && !used[y]![x]!;
    for (let y = 0; y < on.length; y++) {
      for (let x = 0; x < on[y]!.length; x++) {
        if (!free(x, y)) continue;
        let x1 = x;
        while (free(x1 + 1, y)) x1++;
        let y1 = y;
        const same = (r: number) => !free(x - 1, r) && !free(x1 + 1, r) && Array.from({ length: x1 - x + 1 }, (_, i) => free(x + i, r)).every(Boolean);
        while (y1 + 1 < on.length && same(y1 + 1)) y1++;
        for (let yy = y; yy <= y1; yy++) for (let xx = x; xx <= x1; xx++) used[yy]![xx] = true;
        const n = count.get(spec.material) ?? 0;
        count.set(spec.material, n + 1);
        out.push(make(poly.rect(x * CELL, y * CELL, (x1 - x + 1) * CELL, (y1 - y + 1) * CELL), spec.material, {
          id: `${spec.material}${n}`, height: spec.height, ...(spec.low && { blocksBullets: false, blocksSight: false }),
        }));
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ places */

/** What a stretch of floor is, for the floor painter. */
export type PlazaFloor = 'garage' | 'site' | 'marble' | 'station' | 'cafe' | 'terrace' | 'oak' | 'square' | 'platform' | 'vinyl' | 'lot' | 'park' | 'tile' | 'checker' | 'alley' | 'terrazzo';
/** What a room's furniture and shelves are dressed as on one side of the map. */
export type PlazaStyle = 'garage' | 'site' | 'lobby' | 'bank' | 'cafe' | 'trattoria' | 'library' | 'archive' | 'pharmacy' | 'optician' | 'mart' | 'grocer' | 'bakery' | 'noodles' | 'florist' | 'barber' | 'books' | 'games' | 'thrift' | 'phones' | 'pizza' | 'sushi' | 'park' | 'street' | 'terminal' | 'trucks' | 'station';
export type PlazaPlace = {
  id: string; x: number; y: number; w: number; h: number;
  /** West-half name and dressing, then the name and dressing its half turn wears. */
  name: string; style: PlazaStyle; twinName: string; twinStyle: PlazaStyle;
  floor: PlazaFloor; twinFloor?: PlazaFloor;
  /** The sign's spot (west half), hung over the street or the door. */
  sign?: Pt;
  /** Neon accent of the place on each side. */
  accent: string; twinAccent: string;
  roofed?: true;
};

const P = (id: string, x: number, y: number, w: number, h: number, name: string, style: PlazaStyle, twinName: string, twinStyle: PlazaStyle, floor: PlazaFloor, accent: string, twinAccent: string, o: Partial<PlazaPlace> = {}): PlazaPlace =>
  ({ id, x, y, w, h, name, style, twinName, twinStyle, floor, accent, twinAccent, ...o });

/** Smaller places first: `placeAt` takes the first that holds a point. */
export const PLACES: readonly PlazaPlace[] = [
  P('cafe', 2300, 1500, 550, 600, 'CAFÉ LUMEN', 'cafe', 'TRATTORIA SOLE', 'trattoria', 'cafe', '#ffb35c', '#ff6a5a', { sign: { x: 2575, y: 2140 }, roofed: true, twinFloor: 'checker' }),
  P('pharmacy', 1450, 3300, 450, 400, 'PHARMACY', 'pharmacy', 'OPTICIAN', 'optician', 'vinyl', '#5cff9a', '#8ac8ff', { sign: { x: 1675, y: 3290 }, roofed: true }),
  P('mart', 1400, 3850, 750, 650, 'SUPER 24', 'mart', 'GREENGROCER', 'grocer', 'vinyl', '#ff5a7a', '#9ae05a', { sign: { x: 1725, y: 3840 }, roofed: true, twinFloor: 'tile' }),
  P('library', 1450, 2450, 750, 700, 'PUBLIC LIBRARY', 'library', 'CITY ARCHIVE', 'archive', 'oak', '#ffd27a', '#c8d8ff', { sign: { x: 1640, y: 2440 }, roofed: true }),
  P('office', 0, 1400, 1000, 950, 'MERIDIAN TOWER', 'lobby', 'HALCYON BANK', 'bank', 'marble', '#8ad8ff', '#ffd27a', { sign: { x: 1020, y: 1600 }, roofed: true, twinFloor: 'terrazzo' }),
  P('bakery', 0, 4950, 550, 750, 'BAKERY', 'bakery', 'NOODLE BAR', 'noodles', 'tile', '#ffc46a', '#ff5a5a', { sign: { x: 300, y: 4940 }, roofed: true, twinFloor: 'checker' }),
  P('florist', 500, 4950, 500, 750, 'FLOWERS', 'florist', 'BARBER', 'barber', 'terrazzo', '#ff8ad0', '#6ac8ff', { sign: { x: 725, y: 4940 }, roofed: true, twinFloor: 'checker' }),
  P('books', 1300, 4950, 550, 750, 'BOOKS & RECORDS', 'books', 'GAME STORE', 'games', 'oak', '#ffd27a', '#c86aff', { sign: { x: 1575, y: 4940 }, roofed: true, twinFloor: 'vinyl' }),
  P('thrift', 1800, 4950, 550, 750, 'THRIFT', 'thrift', 'PHONE REPAIR', 'phones', 'oak', '#ffa05a', '#5affe0', { sign: { x: 2075, y: 4940 }, roofed: true, twinFloor: 'vinyl' }),
  P('pizza', 2300, 4950, 550, 750, 'PIZZERIA', 'pizza', 'SUSHI', 'sushi', 'checker', '#ff6a3a', '#ff4a8a', { sign: { x: 2575, y: 4940 }, roofed: true, twinFloor: 'oak' }),
  P('garage', 0, 0, 1200, 1050, 'CENTRAL PARKING', 'garage', 'P2 PARKING', 'garage', 'garage', '#ffd34d', '#ffd34d', { sign: { x: 600, y: 1080 }, roofed: true }),
  P('terrace', 2300, 2100, 550, 250, 'TERRACE', 'cafe', 'TERRACE', 'trattoria', 'terrace', '#ffb35c', '#ff6a5a'),
  P('site', 1300, 0, 1550, 1100, 'TOWER 3 SITE', 'site', 'HOTEL SITE', 'site', 'site', '#ffb000', '#ffb000', { sign: { x: 1900, y: 1090 } }),
  P('station', 1300, 1400, 1000, 700, 'CIVIC CENTRE', 'station', 'MARKET STREET', 'station', 'station', '#3ab0ff', '#3ab0ff', { sign: { x: 2075, y: 1385 } }),
  P('square', 2200, 2350, 800, 1300, 'CIVIC SQUARE', 'street', 'CIVIC SQUARE', 'street', 'square', '#ffe0a0', '#ffe0a0'),
  P('terminal', 0, 2350, 1000, 1350, 'BUS TERMINAL', 'terminal', 'CROSSTOWN BUSES', 'terminal', 'platform', '#ffd34d', '#ffd34d', { sign: { x: 520, y: 2370 } }),
  P('trucks', 2200, 3700, 800, 900, 'FOOD TRUCKS', 'trucks', 'FOOD TRUCKS', 'trucks', 'lot', '#ff8a3a', '#ff8a3a'),
  P('park', 0, 3700, 850, 950, 'LINDEN PARK', 'park', 'ROSE GARDEN', 'park', 'park', '#9ae05a', '#ff8ab0', { sign: { x: 425, y: 3690 } }),
  P('alley', 0, 5700, 3000, 300, 'SERVICE ALLEY', 'street', 'SERVICE ALLEY', 'street', 'alley', '#ffb000', '#ffb000'),
];

/** The place a point stands in, and whether it is the half-turn twin (the east half). */
export function placeAt(x: number, y: number): { place: PlazaPlace; twin: boolean } | null {
  const twin = x >= PLAZA_SIZE / 2;
  const px = twin ? PLAZA_SIZE - x : x, py = twin ? PLAZA_SIZE - y : y;
  for (const p of PLACES) if (px >= p.x && px < p.x + p.w && py >= p.y && py < p.y + p.h) return { place: p, twin };
  return null;
}

/* ------------------------------------------------------------------ streets (floor only) */

/** Road carriageways in the west half (x, y, w, h); their twins carry them across. Sidewalks frame each. */
export const ROADS: readonly { x: number; y: number; w: number; h: number; axis: 'h' | 'v' }[] = [
  { x: 0, y: 1150, w: 3000, h: 200, axis: 'h' },     // north avenue (its twin the south avenue's east end)
  { x: 0, y: 4700, w: 3000, h: 200, axis: 'h' },     // south avenue
  { x: 1050, y: 1350, w: 200, h: 3350, axis: 'v' },  // the boulevard
  { x: 1050, y: 4900, w: 200, h: 1100, axis: 'v' },  // the boulevard's run past the shops to the alley
];
/** Zebra crossings: [x, y, w, h]. */
export const CROSSINGS: readonly (readonly [number, number, number, number])[] = [
  [1300, 1150, 150, 200], [850, 1150, 150, 200], [2750, 1150, 150, 200],
  [1300, 4700, 150, 200], [850, 4700, 150, 200], [2400, 4700, 150, 200],
  [1050, 1400, 200, 120], [1050, 4570, 200, 120], [1050, 2900, 200, 120],
];

/* ------------------------------------------------------------------ hand-placed pieces */

export const FOUNTAIN = { x: 3000, y: 3000, rIn: 250, rOut: 330, gap: 0.3 } as const;
export const STATUE = { x: 2450, y: 3000, r: 70 } as const;
export const CRANE = { x: 2650, y: 820, mast: 70 } as const;

export type Vehicle = { id: string; kind: 'car' | 'bus' | 'foodtruck' | 'mixer' | 'van'; x: number; y: number; rot: number; livery: number };
export const VEHICLE_SIZE = { car: { len: 250, wid: 116 }, van: { len: 290, wid: 130 }, bus: { len: 560, wid: 140 }, foodtruck: { len: 360, wid: 150 }, mixer: { len: 380, wid: 150 } } as const;
const H = Math.PI / 2;
export const VEHICLES: readonly Vehicle[] = [
  // the garage: cars nosed into their bays
  { id: 'g-car1', kind: 'car', x: 560, y: 190, rot: -H, livery: 0 },
  { id: 'g-car2', kind: 'car', x: 850, y: 190, rot: -H, livery: 1 },
  { id: 'g-car3', kind: 'car', x: 560, y: 680, rot: H, livery: 2 },
  { id: 'g-car4', kind: 'van', x: 850, y: 690, rot: H, livery: 3 },
  { id: 'g-car5', kind: 'car', x: 300, y: 760, rot: -H, livery: 4 },
  // the avenues: parked at the kerb
  { id: 'a-car1', kind: 'car', x: 640, y: 1215, rot: 0, livery: 5 },
  { id: 'a-car2', kind: 'van', x: 2250, y: 1280, rot: Math.PI, livery: 6 },
  { id: 'a-car3', kind: 'car', x: 520, y: 4840, rot: Math.PI, livery: 7 },
  { id: 'a-car4', kind: 'car', x: 1900, y: 4765, rot: 0, livery: 1 },
  // the terminal's bus at its stand
  { id: 'bus', kind: 'bus', x: 760, y: 2950, rot: -H, livery: 0 },
  // the site's mixer truck by the gate
  { id: 'mixer', kind: 'mixer', x: 1850, y: 880, rot: 0, livery: 0 },
  // the food trucks
  { id: 'truck1', kind: 'foodtruck', x: 2420, y: 3950, rot: 0, livery: 0 },
  { id: 'truck2', kind: 'foodtruck', x: 2700, y: 4480, rot: Math.PI, livery: 1 },
];

/** Round cafe and picnic tables (low: rounds fly over), each [x, y, r, umbrella?]. */
export const TABLES: readonly (readonly [number, number, number, 0 | 1])[] = [
  [2420, 1820, 28, 0], [2600, 1920, 28, 0], [2470, 1950, 26, 0], [2560, 1760, 26, 0],
  [2390, 2160, 28, 1], [2700, 2160, 28, 1], [2800, 2255, 26, 1],
  [2420, 4230, 32, 1], [2600, 4150, 32, 1], [2860, 3880, 32, 1],
];
/** Benches: [x, y, rot]. */
export const BENCHES: readonly (readonly [number, number, number])[] = [
  [2600, 2560, 0], [2600, 3440, 0], [2300, 2850, H], [2300, 3150, H],
  [300, 3900, 0], [620, 4480, 0], [1450, 1700, H], [2000, 1880, 0],
];
/** Street and park trees: [x, y, crown radius]. */
export const TREES: readonly (readonly [number, number, number])[] = [
  [1150, 2150, 64], [1150, 4300, 64], [1150, 5300, 60],
  [2330, 2420, 60], [2330, 3580, 60], [2900, 2420, 56], [2900, 3580, 56],
  [160, 3850, 70], [720, 3880, 64], [140, 4300, 66], [330, 4500, 60], [700, 4300, 72],
  [1380, 1450, 58], [2250, 2000, 54], [100, 2450, 56],
];
export const POND = { x: 470, y: 4150, rx: 160, ry: 105 } as const;

const ring = (a0: number, a1: number, id: string) => make(poly.arc(FOUNTAIN.x, FOUNTAIN.y, FOUNTAIN.rIn, FOUNTAIN.rOut, a0, a1, 10), 'pzbasin', { id, group: 'fountain', height: 12, blocksBullets: false, blocksSight: false });
const oval = (cx: number, cy: number, rx: number, ry: number, n = 20): Pt[] => Array.from({ length: n }, (_, i) => ({ x: cx + Math.cos((i / n) * Math.PI * 2) * rx, y: cy + Math.sin((i / n) * Math.PI * 2) * ry }));
const boxAt = (v: Vehicle): Pt[] => { const s = VEHICLE_SIZE[v.kind]; return poly.transform(poly.fromPath([[-s.len / 2 + 14, -s.wid / 2], [s.len / 2 - 14, -s.wid / 2], [s.len / 2, -s.wid / 2 + 14], [s.len / 2, s.wid / 2 - 14], [s.len / 2 - 14, s.wid / 2], [-s.len / 2 + 14, s.wid / 2], [-s.len / 2, s.wid / 2 - 14], [-s.len / 2, -s.wid / 2 + 14]]), { x: v.x, y: v.y, rot: v.rot }); };
const VEHICLE_HEIGHT = { car: 26, van: 32, bus: 44, foodtruck: 40, mixer: 42 } as const;

const HAND: readonly MapPoly[] = [
  ring(Math.PI / 2 + FOUNTAIN.gap, Math.PI - FOUNTAIN.gap, 'basin-sw'),
  ring(Math.PI + FOUNTAIN.gap, Math.PI * 1.5 - FOUNTAIN.gap, 'basin-nw'),
  make(poly.circle(STATUE.x, STATUE.y, STATUE.r, 12), 'pzstatue', { id: 'statue', height: 46 }),
  make(poly.rect(CRANE.x - CRANE.mast / 2, CRANE.y - CRANE.mast / 2, CRANE.mast, CRANE.mast), 'pzcrane', { id: 'crane', height: 30 }),
  make(oval(POND.x, POND.y, POND.rx, POND.ry), 'pzpond', { id: 'pond', height: 8, blocksBullets: false, blocksSight: false }),
  ...VEHICLES.map((v) => make(boxAt(v), 'pzvehicle', { id: v.id, shape: v.kind, height: VEHICLE_HEIGHT[v.kind] })),
  ...TABLES.map(([x, y, r], i) => make(poly.circle(x, y, r, 10), 'pztable', { id: `table${i}`, height: 10, blocksBullets: false, blocksSight: false })),
  ...BENCHES.map(([x, y, rot], i) => make(poly.transform(poly.rect(-55, -14, 110, 28), { x, y, rot }), 'pzbench', { id: `bench${i}`, height: 9, blocksBullets: false, blocksSight: false })),
  ...TREES.map(([x, y], i) => make(poly.circle(x, y, 22, 10), 'pztree', { id: `tree${i}`, height: 18 })),
];

/* ------------------------------------------------------------------ doors and roofs */

const D = (id: string, kind: MapDoor['kind'], x: number, y: number, w: number, axis: 'h' | 'v', material: string, o: Partial<MapDoor> = {}): MapDoor => ({ id, kind, x, y, w, axis, material, ...o });
const WARM = '#ffd9a0', COOL = '#cfe4ff';
const DOORS: readonly MapDoor[] = [
  D('office-n', 'double-swing', 400, 1425, 150, 'h', 'glass', { glow: COOL }),
  D('office-s', 'swing', 300, 2325, 150, 'h', 'metal'),
  D('office-e', 'double-slide', 975, 1700, 150, 'v', 'glass', { glow: COOL, closeMs: 1600 }),
  D('cafe-w', 'swing', 2325, 1700, 100, 'v', 'wood', { glow: WARM }),
  D('cafe-s', 'swing', 2500, 2075, 100, 'h', 'wood', { glow: WARM, hinge: 'end' }),
  D('library-w', 'double-swing', 1475, 2700, 150, 'v', 'wood', { glow: WARM }),
  D('library-e', 'double-swing', 2175, 2750, 150, 'v', 'wood', { glow: WARM }),
  D('library-n', 'double-swing', 1750, 2475, 150, 'h', 'wood'),
  D('pharmacy-n', 'slide', 1600, 3325, 100, 'h', 'glass', { glow: '#d8ffe8', closeMs: 1400 }),
  D('pharmacy-e', 'slide', 1875, 3450, 100, 'v', 'glass', { closeMs: 1400 }),
  D('mart-n', 'double-slide', 1650, 3875, 150, 'h', 'glass', { glow: '#f4f4ff', closeMs: 1400 }),
  D('mart-w', 'swing', 1425, 4100, 100, 'v', 'metal'),
  D('mart-e', 'swing', 2125, 4250, 100, 'v', 'metal', { hinge: 'end' }),
  D('bakery-f', 'slide', 250, 4975, 100, 'h', 'glass', { glow: WARM, closeMs: 1400 }),
  D('bakery-b', 'swing', 150, 5675, 100, 'h', 'metal'),
  D('florist-f', 'slide', 650, 4975, 100, 'h', 'glass', { closeMs: 1400 }),
  D('florist-b', 'swing', 800, 5675, 100, 'h', 'metal', { hinge: 'end' }),
  D('books-f', 'double-slide', 1500, 4975, 150, 'h', 'glass', { glow: WARM, closeMs: 1400 }),
  D('books-b', 'swing', 1650, 5675, 100, 'h', 'metal'),
  D('thrift-f', 'swing', 2000, 4975, 100, 'h', 'wood'),
  D('thrift-b', 'swing', 1900, 5675, 100, 'h', 'metal', { hinge: 'end' }),
  D('pizza-f', 'double-swing', 2450, 4975, 150, 'h', 'wood', { glow: '#ffb070' }),
  D('pizza-b', 'swing', 2650, 5675, 100, 'h', 'metal'),
];

const R = (id: string, x: number, y: number, w: number, h: number, material: string): MapRoof => ({ id, points: poly.rect(x, y, w, h), material });
/** Roof materials are the theme's own (plazapolys.ts): deck, gravel, green, solar, skylight. */
const ROOFS: readonly MapRoof[] = [
  R('garage', 0, 0, 1200, 1050, 'pzdeck'),
  R('office', 0, 1400, 1000, 950, 'pzglassroof'),
  R('cafe', 2300, 1500, 550, 600, 'pzgreen'),
  R('library', 1450, 2450, 750, 700, 'pzcopper'),
  R('pharmacy', 1450, 3300, 450, 400, 'pzgravel'),
  R('mart', 1400, 3850, 750, 650, 'pzsolar'),
  R('bakery', 0, 4950, 550, 750, 'pzgravel'),
  R('florist', 500, 4950, 500, 750, 'pzgreen'),
  R('books', 1300, 4950, 550, 750, 'pzgravel'),
  R('thrift', 1800, 4950, 550, 750, 'pzsolar'),
  R('pizza', 2300, 4950, 550, 750, 'pzgravel'),
];

export function plazaGeometry(plan: string): Geometry {
  return { polys: [...planPolys(plan), ...HAND], doors: DOORS, roofs: ROOFS };
}
