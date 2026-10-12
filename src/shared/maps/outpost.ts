import { SIDES, type Side } from '../defs.ts';
import type { Rect } from '../sim/movement.ts';
import type { MapDef, MapWall, WallMaterial } from '../maps.ts';

/**
 * Outpost: Firebase Bastion, a forward operating base holding out against the horde at night (the Zombies map). The core is the
 * command bunker (TOC) in the middle of an open parade ground, where the squad builds its own defences (everything within
 * `ZOM.buildRadius` of the core is kept clear, bar four sandbag fallback nests). A ring of HESCO barriers with a watchtower on each
 * corner walls the compound in: each side has a main gate and a blown breach, so the horde funnels through chokepoints. Between the
 * wire and the parade ground stand the base's places: the mess tent, the comms shack and radio mast, the helipad, the supply depot,
 * the medical tent, the motor pool with its trucks and fuel bladders, the ammo container and the barracks. Outside the wire lie the
 * outskirts the base lost: two overrun checkpoints on the roads in, a supply drop that came down wide, a burned convoy, a crashed
 * helicopter, a toppled tower and a burn pit. The client theme paints all of it (src/client/themes/outpost*.ts).
 *
 * The HESCO ring, its towers and the fallback nests are four-way symmetric, so every side the horde walks in from is as long and as
 * open; what stands inside and outside the wire differs side to side but keeps the gates' approaches clear. Every gap between solids
 * is at least 100 px, so nothing wedges a squad player or a zombie.
 * Materials: ophesco HESCO barrier, opbags sandbags, optower watchtower or mast, optent canvas tent, opcont container or cabin,
 * optruck parked truck, opcrate supply crates, opfuel fuel bladder or drums, opwreck burned-out wreck.
 */
export const OUTPOST_SIZE = 3000;
const S = OUTPOST_SIZE;

const quarterTurn = <T extends Rect>(r: T): T => ({ ...r, x: S - r.y - r.h, y: r.x, w: r.h, h: r.w });
/** A quarter's rects and their three quarter turns about the map's centre. */
function fourWays<T extends Rect>(quarter: readonly T[]): T[] {
  const out: T[] = [];
  let turn = [...quarter];
  for (let i = 0; i < 4; i++) { out.push(...turn); turn = turn.map(quarterTurn); }
  return out;
}
const w = (material: WallMaterial, x: number, y: number, ww: number, h: number): MapWall => ({ x, y, w: ww, h, material });

/** The HESCO line runs 600..650 px in from each edge; its main gate and its breach, on the north side, turn round with it. */
export const WIRE = { out: 600, in: 650, gate: { from: 1250, to: 1450 }, breach: { from: 1900, to: 2050 } } as const;

/** The north side of the ring: a corner tower, the HESCO line with its gate and breach, and a sandbag nest by the parade ground. */
const RING_QUARTER: MapWall[] = [
  w('optower', 550, 550, 100, 100),
  w('ophesco', 650, 600, 600, 50), w('ophesco', 1450, 600, 450, 50), w('ophesco', 2050, 600, 300, 50),
  w('opbags', 1050, 1050, 100, 50), w('opbags', 1050, 1100, 50, 50),
];

/** Inside the wire, between it and the parade ground. */
const COMPOUND: MapWall[] = [
  w('optent', 750, 750, 250, 150), // mess tent
  w('opcont', 2000, 750, 150, 100), // comms shack
  w('optower', 2200, 800, 50, 50), // radio mast
  w('optruck', 2050, 1000, 200, 100), // motor pool
  w('optruck', 2050, 1600, 200, 100),
  w('opfuel', 2150, 1800, 100, 50), // fuel drums
  w('optent', 2100, 2050, 150, 200), // medical tent
  w('opfuel', 1850, 2150, 150, 100), // fuel point: the bladder
  w('opcrate', 1100, 2100, 100, 100), // supply depot
  w('opcont', 750, 2100, 100, 150), // ammo container
  w('optent', 750, 1150, 150, 250), // barracks
  w('optent', 750, 1850, 150, 150),
];

/** Outside the wire: what the base lost. */
const OUTSKIRTS: MapWall[] = [
  // Checkpoint Alpha on the north road
  w('opcont', 1100, 300, 100, 100), w('opbags', 1500, 300, 150, 50), w('opbags', 1000, 450, 100, 50),
  // the supply drop that came down wide
  w('opcrate', 300, 300, 100, 100), w('opcrate', 450, 250, 50, 50), w('opcrate', 250, 450, 50, 50),
  // a burned-out APC and a truck off the north-east track
  w('opwreck', 2500, 250, 200, 100), w('opwreck', 2700, 450, 100, 150),
  // the convoy that never made the east gate, and its fuel drums
  w('opwreck', 2600, 1000, 100, 200), w('opwreck', 2650, 1700, 100, 150), w('opfuel', 2500, 1450, 100, 50),
  // Checkpoint Bravo on the south road, overrun; an overturned humvee
  w('opcont', 1800, 2600, 100, 100), w('opbags', 1350, 2700, 150, 50), w('opwreck', 1300, 2500, 150, 100),
  // the toppled watchtower
  w('opwreck', 2550, 2550, 100, 100), w('opcrate', 2400, 2750, 50, 50),
  // the burn pit's last crates and a sandbag wall
  w('opcrate', 350, 2600, 100, 50), w('opbags', 250, 2400, 50, 150),
  // the crashed helicopter: fuselage and tail boom
  w('opwreck', 250, 1300, 250, 100), w('opwreck', 150, 1350, 100, 50),
  w('opbags', 400, 1800, 50, 150),
];

/** Where the squad stands at the start: a pad on each side of the core. */
const SQUAD_PAD: Rect = { x: 1330, y: 1400, w: 60, h: 200 };
const HORDE_EDGE: Rect = { x: 40, y: 40, w: 2920, h: 30 };

const squad = fourWays([SQUAD_PAD]);

export const OUTPOST: MapDef = {
  name: 'Outpost',
  theme: 'outpost',
  size: S,
  walls: [...fourWays(RING_QUARTER), ...COMPOUND, ...OUTSKIRTS],
  zones: [],
  spawns: { red: squad, blue: squad, ffa: squad },
  crates: [],
  barrels: [],
  props: [],
  siege: { core: { x: S / 2, y: S / 2 }, horde: Object.fromEntries(fourWays([HORDE_EDGE]).map((r, i) => [SIDES[i], r])) as Record<Side, Rect> },
};
