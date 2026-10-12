import type { PropKind } from '../defs.ts';
import type { RangeLayout, TargetDef } from '../range.ts';
import type { MapRoof } from '../geom.ts';
import type { Center, MapDef, MapWall, WallMaterial } from '../maps.ts';

/**
 * The shooting range: a firing line on the west edge and one open field running east, with the distances painted across it from the
 * line (100, 200, 400, 700, 1000 and 1250 px) and one target standing at each, stepped along a diagonal so none hides another. A
 * narrow bay to the north holds two sliders, and one to the south a training dummy and a small blast corner. The map is not a
 * half-turn pair like the versus maps; it has one spawn, no zones and no crates, and only the Range mode plays it.
 */
const SIZE = 2400;
const LINE = 400;
const MARKS = [100, 200, 400, 700, 1000, 1250] as const;
const at = (d: number) => LINE + d;

/** Three bays, north to south: the sliders, the open field, the dummy and the blast corner. */
const BAYS = [
  { y0: 300, y1: 700, label: 'MOVING' },
  { y0: 700, y1: 1700, label: 'FIELD' },
  { y0: 1700, y1: 2100, label: 'BLAST' },
] as const;

const wall = (x: number, y: number, w: number, h: number, material: WallMaterial): MapWall => ({ x, y, w, h, material });

/**
 * Booth: a blockwork back wall with a doorway where you walk in, and a sandbag divider at each bay's edge, behind the line. The client
 * theme (src/client/themes/range*.ts) dresses the whole place as an army training range under a covered firing line.
 */
const BOOTH: MapWall[] = [
  wall(100, 150, 50, 900, 'rgwall'),
  wall(100, 1350, 50, 900, 'rgwall'),
  ...[300, 700, 1700, 2100].map((y) => wall(250, y - 25, 200, 50, 'rgbags')),
];

/** A blast wall in the blast corner to lob a grenade over, and a sandbag emplacement on the south rim. */
const COVER: MapWall[] = [
  wall(780, 1890, 50, 160, 'rgblast'),
  wall(1100, 2150, 100, 50, 'rgbags'),
];

/**
 * The dressing that stands up, all of it out of every lane's line from the firing line to its targets: shooting benches just behind
 * the line (never within 60 px of it, so a soldier stands on the line clear of them), an ammo table and a sandbag nest at the booth's ends (clear of the walk along its back),
 * the control tower and the ammo hut at the booth's ends, the shoot-house shell behind and above the sliders, and the earth backstop
 * berm along the far edge with low side berms, past the reach of every gun but the longest from the line.
 */
const DRESS: MapWall[] = [
  ...[600, 760, 960, 1640, 2040].map((y) => wall(290, y - 30, 50, 60, 'rgbench')),
  wall(175, 168, 110, 60, 'rgtable'),
  wall(170, 2160, 100, 56, 'rgbags'),
  wall(170, 20, 150, 120, 'rgtower'),
  wall(170, 2265, 150, 115, 'rghut'),
  wall(620, 200, 704, 24, 'rgply'),
  wall(1300, 224, 24, 160, 'rgply'),
  wall(1300, 480, 24, 230, 'rgply'),
  wall(2270, 0, 130, 2400, 'rgberm'),
  wall(480, 0, 1790, 70, 'rgberm'),
  wall(480, 2330, 1790, 70, 'rgberm'),
];

/** The covered firing line: a canopy over the booth, which thins out while you stand under it. */
const CANOPY: MapRoof = { id: 'canopy', points: [{ x: 160, y: 160 }, { x: 372, y: 160 }, { x: 372, y: 2240 }, { x: 160, y: 2240 }], material: 'canopy' };

const paper = (x: number, y: number): TargetDef => ({ kind: 'paper', x, y });
const plank = (x: number, y: number): TargetDef => ({ kind: 'plank', x, y });
const dummy = (x: number, y: number): TargetDef => ({ kind: 'dummy', x, y });
const rail = (x: number, y: number, speed: number, phase: number): TargetDef => ({ kind: 'rail', x, y, rail: { axis: 'y', reach: 130, speed, phase } });

const TARGETS: TargetDef[] = [
  // The field: one stand-up at each painted distance on a bowed diagonal, near ones south of the pad and far ones north. The bow keeps
  // any three off one straight line, so from anywhere on the line hardly one hides another.
  paper(at(100), 1580), paper(at(200), 1500), paper(at(400), 1420), plank(at(700), 1240), plank(at(1000), 1030),
  // The last board only the farther-reaching snipers carry to from the line.
  plank(at(1250), 830),
  // Two sliders across the line of fire, a slow one at 400 px and a quick one at 700.
  rail(at(400), 480, 170, 0), rail(at(700), 520, 300, 0.5),
  // A training dummy with a lot of health, for reading damage per second, and a paper soldier behind the blast corner's low wall.
  dummy(at(200), 1800), paper(at(500), 1970),
];

const BARRELS: Center[] = [{ x: 960, y: 1880 }, { x: 960, y: 1940 }];
const PROPS: (Center & { kind: PropKind })[] = [{ x: 1010, y: 2030, kind: 'propane' }, { x: 940, y: 2040, kind: 'oil' }];

const spawn = { x: 170, y: 1210, w: 110, h: 80 };

const RANGE: RangeLayout = { pad: spawn, targets: TARGETS, line: LINE, marks: MARKS, lanes: BAYS };

export const RANGE_MAP: MapDef = {
  name: 'Range',
  theme: 'range',
  size: SIZE,
  walls: [...BOOTH, ...COVER, ...DRESS],
  roofs: [CANOPY],
  zones: [],
  spawns: { red: [spawn], blue: [spawn], ffa: [spawn] },
  crates: [],
  barrels: BARRELS,
  props: PROPS,
  range: RANGE,
};
