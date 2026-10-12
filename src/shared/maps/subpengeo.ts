/**
 * Sub Pen geometry (docs/maps/GEOMETRY.md), authored for the west half; `withGeometry` adds the half-turn twin. The boat in the slip is a
 * cigar polygon (the water round it stays grid wall), the machine shop and the crew quarters are roofed rooms with steel doors (their
 * twins are the control room and the second crew hut), the torpedo store gets bulkhead hatches, a blast door and a roof, and a round
 * fuel tank stands in the depot.
 */
import { halfTurn, make, type MapDoor, type MapPoly, type MapRoof, type Pt } from '../geom.ts';
import type { Geometry } from '../mapgeo.ts';
import { cigar, roomDoor, roomRoof, roomWalls, type RoomSpec } from './roomkit.ts';
import { poly } from '../geom.ts';

const SHOP: RoomSpec = { id: 'shop', x: 1250, y: 4850, w: 900, h: 700, material: 'bulkhead', gaps: [{ side: 'n', at: 1800, w: 150 }, { side: 'w', at: 5320, w: 150 }, { side: 'e', at: 5100, w: 150 }, { side: 's', at: 1500, w: 150, open: true }] };
const CREW: RoomSpec = { id: 'crew', x: 150, y: 3700, w: 700, h: 450, material: 'bulkhead', gaps: [{ side: 'n', at: 600, w: 150 }, { side: 'e', at: 3850, w: 150 }, { side: 's', at: 300, w: 150, open: true }] };

const POLYS: MapPoly[] = [
  // The boat in the west slip: bow west, 300 px beam, 1800 px long. The pit round it is water cells in the grid.
  make(cigar(500, 2300, 2000, 150, 300, 180), 'hull', { id: 'sub', height: 40, group: 'sub', part: 'hull', shape: 'submarine' }),
  ...roomWalls(SHOP),
  ...roomWalls(CREW),
  make(poly.circle(2860, 5790, 120, 20), 'tank', { id: 'fuel-tank', height: 52, shape: 'roundTank' }),
];

const DOORS: MapDoor[] = [
  { id: 'store-n', kind: 'swing', x: 450, y: 2700, w: 150, axis: 'h', hinge: 'start', material: 'metal', closeMs: 3000 },
  { id: 'store-e', kind: 'slide', x: 900, y: 3000, w: 150, axis: 'v', hinge: 'start', material: 'metal', thick: 20, glow: '#ff9a3c', closeMs: 2000 },
  { id: 'store-s', kind: 'swing', x: 300, y: 3500, w: 150, axis: 'h', hinge: 'end', material: 'metal', closeMs: 3000 },
  roomDoor(SHOP, SHOP.gaps[0]!, 'shop-n', { kind: 'swing', material: 'metal', hinge: 'start' }),
  roomDoor(SHOP, SHOP.gaps[1]!, 'shop-w', { kind: 'swing', material: 'metal', hinge: 'end' }),
  roomDoor(SHOP, SHOP.gaps[2]!, 'shop-e', { kind: 'slide', material: 'metal', hinge: 'start', glow: '#7fe0c0' }),
  roomDoor(CREW, CREW.gaps[0]!, 'crew-n', { kind: 'swing', material: 'metal', hinge: 'start' }),
  roomDoor(CREW, CREW.gaps[1]!, 'crew-e', { kind: 'double-swing', material: 'metal', glow: '#ffd9a0' }),
];

const ROOFS: MapRoof[] = [
  { id: 'store', material: 'metal', points: poly.rect(150, 2650, 800, 900) },
  roomRoof(SHOP, 'shop', 'metal'),
  roomRoof(CREW, 'crew', 'corrugated'),
];

export const SUBPEN_GEO: Geometry = { polys: POLYS, doors: DOORS, roofs: ROOFS };

/*
 * The districts' furniture. Twin halves share every footprint (so cover stays fair) but not the costume: each piece below is authored
 * once in the west with the art it wears there and the art its half-turn twin wears in the east. The machine shop's lathes are the
 * control room's console banks, its drill press the periscope, the torpedo store's trolleys and hoist are the comms bunker's radio racks
 * and aerial mast, the flood room's valve manifolds are the crew's bunks and its flood board the wardroom table, and the fuel depot's bowser and tanks are the sump yard's pumps.
 */
type Kit = { id: string; pts: Pt[]; west: string; east: string; height: number; material?: string; low?: boolean };
const KIT: readonly Kit[] = [
  // DOCK 1 / DOCK 2: torpedo loading cranes on the dock side of each slip, and a fish on its trolley waiting for one.
  { id: 'crane-a', pts: poly.circle(1100, 1420, 42, 16), west: 'crane', east: 'crane', height: 30 },
  { id: 'crane-b', pts: poly.circle(2200, 1430, 42, 16), west: 'crane', east: 'crane', height: 30 },
  { id: 'dock-trolley', pts: poly.rect(350, 800, 240, 60), west: 'trolley', east: 'trolley', height: 14, low: true },
  { id: 'dock-trolley-b', pts: poly.rect(1820, 380, 60, 220), west: 'trolley', east: 'trolley', height: 14, low: true },
  // TORPEDO STORE (A) / COMMS (C).
  { id: 'store-trolley', pts: poly.rect(1480, 2650, 260, 60), west: 'trolley', east: 'radiorack', height: 14, low: true },
  { id: 'store-hoist', pts: poly.circle(1900, 3300, 46, 16), west: 'hoist', east: 'mast', height: 56 },
  { id: 'store-cart', pts: poly.rect(1060, 3250, 60, 200), west: 'trolley', east: 'radiorack', height: 14, low: true },
  // FLOOD CONTROL / CREW QUARTERS: inside the hut, valve manifolds and the flood board / two bunks and the wardroom table.
  { id: 'hut-a', pts: poly.rect(200, 3755, 70, 150), west: 'manifold', east: 'bunk', height: 14, low: true },
  { id: 'hut-b', pts: poly.rect(200, 3945, 70, 150), west: 'manifold', east: 'bunk', height: 14, low: true },
  { id: 'hut-table', pts: poly.rect(470, 3850, 200, 90), west: 'floodboard', east: 'messtable', height: 12, low: true },
  { id: 'hut-c', pts: poly.rect(560, 4040, 200, 50), west: 'valvestand', east: 'locker', height: 22 },
  { id: 'flood-valves', pts: poly.rect(1300, 3640, 120, 60), west: 'valvestand', east: 'radiorack', height: 22 },
  { id: 'flood-valves-b', pts: poly.rect(1950, 4180, 60, 140), west: 'valvestand', east: 'console', height: 22 },
  // MACHINE SHOP / CONTROL: lathes and benches / consoles and chart tables, the drill press / the periscope, the gantry's legs / searchlights.
  { id: 'shop-lathe', pts: poly.rect(1880, 4960, 60, 200), west: 'lathe', east: 'console', height: 14, low: true },
  { id: 'shop-drill', pts: poly.circle(1800, 5330, 28, 14), west: 'drill', east: 'periscope', height: 40 },
  { id: 'yard-lathe', pts: poly.rect(950, 5150, 220, 60), west: 'lathe', east: 'console', height: 14, low: true },
  { id: 'yard-bench', pts: poly.rect(950, 5600, 200, 90), west: 'bench', east: 'chart', height: 12, low: true },
  { id: 'gantry-w', pts: poly.circle(1300, 5700, 26, 12), west: 'gantry', east: 'searchlight', height: 44 },
  { id: 'gantry-e', pts: poly.circle(2000, 5700, 26, 12), west: 'gantry', east: 'searchlight', height: 44 },
  // FUEL DEPOT / SUMP YARD.
  { id: 'fuel-bowser', pts: poly.rect(2540, 5700, 100, 230), west: 'bowser', east: 'pumpskid', height: 30 },
  { id: 'fuel-tank-b', pts: poly.circle(2600, 4750, 60, 18), west: 'smalltank', east: 'sumppump', height: 44, material: 'tank' },
  { id: 'sump-pump', pts: poly.circle(2600, 1050, 55, 18), west: 'sumppump', east: 'smalltank', height: 44, material: 'tank' },
  { id: 'sump-skid', pts: poly.rect(2550, 150, 230, 100), west: 'pumpskid', east: 'bowser', height: 30 },
];

const kitPolys = (k: Kit): MapPoly[] => {
  const opts = { id: k.id, height: k.height, ...(k.low && { blocksSight: false }) };
  const west = make(k.pts, k.material ?? 'steel', { ...opts, shape: k.west });
  return [west, { ...halfTurn(west, 6000), shape: k.east }];
};

/** The furniture, west and east already paired: pass it to `withGeometry` with no twinning. */
export const SUBPEN_KIT: Geometry = { polys: KIT.flatMap(kitPolys), twin: false };
