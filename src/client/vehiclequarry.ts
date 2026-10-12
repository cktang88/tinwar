/**
 * Quarry plant for the vehicle kit: a rigid haul truck with a load of blasted rock and a tracked excavator with its boom out.
 * Toy proportions like the rest of the kit (chunky wheels, rounded boxes, big glass), hi-vis yellow and mud. Each is a model in
 * metres with the nose toward +x; the map's footprint (src/shared/maps/quarrygeo.ts) covers the body, not the excavator's arm.
 */
import { Model, chain, mat, move, rotY } from './vehiclemesh.ts';
import { fbm, weather } from './vehiclepaint.ts';

const GLASS = mat('#1e2a3a', { gloss: true });
const MUD = { dirt: 1.4 } as const;
const YELLOW: Record<string, string> = { yellow: '#d9a22e', orange: '#d0702c', white: '#d8d4c8' };

/** A rigid haul truck, 6.4 x 3.1 m: a canopied dump body heaped with rock, the cab perched on the left of the front deck. */
export function dumpTruck(livery = 'yellow'): Model {
  const m = new Model();
  m.top = 3.1;
  const body = mat(YELLOW[livery] ?? YELLOW.yellow!), dark = mat('#2b2e34'), rib = mat('#b8862a'), steel = mat('#59606b'), grille = mat('#1c1f26');
  const paint = (base: ReturnType<typeof mat>) => (x: number, y: number, z: number, _nx: number, _ny: number, nz: number) => weather(base, MUD, x, y + z, z, nz, 3.1);
  // frame and the four big tyres (twinned at the back)
  m.box(m.part(dark), -3.0, -0.75, 0.55, 2.9, 0.75, 1.05, 0.04);
  const tyre = m.part('#26292e'), hub = m.part('#8a8f98');
  for (const s of [-1, 1]) { m.wheel(tyre, hub, 2.05, s * 1.2, 0.72, 0.62); m.wheel(tyre, hub, -1.75, s * 1.2, 0.72, 0.62); }
  // front deck over the engine, a radiator grille on its nose, the ladder up its side
  const deck = m.part((x, y, z, nx, ny, nz) => (nx > 0.6 && z < 1.85 && z > 1.0 ? grille : weather(body, MUD, x, y + z, z, nz, 3.1)));
  m.box(deck, 1.55, -1.45, 0.95, 3.15, 1.45, 1.95, 0.08);
  // the cab, on the left of the deck
  const cab = m.part((x, y, z, nx, ny, nz) => {
    if (z > 2.25 && z < 2.95 && (Math.abs(nx) > 0.5 || Math.abs(ny) > 0.5)) return GLASS;
    if (nz > 0.8) return mat('#e2dccb');
    return weather(body, MUD, x, y + z, z, nz, 3.1);
  });
  m.box(cab, 1.75, -1.42, 1.95, 2.95, -0.25, 3.05, 0.12);
  // the dump body: a tub with ribbed sides, its canopy reaching forward over the cab
  const tub = m.part((x, y, z, nx, ny, nz) => (Math.abs(ny) > 0.6 && Math.abs(((x + 3) % 0.9) - 0.45) < 0.06 ? rib : weather(body, MUD, x, y + z, z, nz, 3.1)));
  m.slab(tub, [[-3.2, -1.55], [1.45, -1.55], [1.45, 1.55], [-3.2, 1.55]], 1.05, 2.45, { bevel: 0.1 });
  m.box(m.part(paint(body)), 1.3, -0.12, 2.45, 3.05, 1.55, 3.12, 0.05);
  m.box(m.part(paint(body)), 1.3, -1.55, 2.45, 1.7, -0.12, 3.12, 0.05);
  // the load: blasted limestone heaped in the tub
  const load = m.part((x, y) => { const k = fbm(x * 3.2, y * 3.2); return k > 0.62 ? mat('#c9c1aa') : k < 0.42 ? mat('#7d776a') : mat('#a39d8f'); });
  m.blob(load, -0.9, 0, 2.35, 2.05, 1.3, 0.55, { rows: 9 });
  // exhaust stacks and a beacon
  m.box(m.part(steel), 1.6, 1.15, 1.95, 1.8, 1.35, 2.75, 0.02);
  m.blob(m.part(mat('#e8a23a', { gloss: true })), 2.4, -0.8, 3.12, 0.13, 0.13, 0.11);
  m.lights.push({ key: 'beacon', at: [2.4, -0.8, 3.2], color: '#ffb347', radius: 170, intensity: 0.55, blinkMs: 1400, size: 5 });
  m.sideDecals(-3.2, 1.05, 1.45, 2.45, 44, [tub], (g) => {
    g.save(); g.translate(-0.9, -1.75); g.scale(0.0055, 0.0055);
    g.font = '700 100px "Barlow Condensed", "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#1c1f26'; g.fillText('No. 9', 0, 0); g.restore();
  });
  return m;
}

/** A tracked excavator, 4.2 x 3.0 m on its tracks: the house with its counterweight, the cab front-left, the boom, stick and bucket reaching ahead. */
export function excavator(livery = 'yellow'): Model {
  const m = new Model();
  m.top = 3.2;
  const body = mat(YELLOW[livery] ?? YELLOW.yellow!), steel = mat('#3d4450'), black = mat('#26292e');
  const worn = (x: number, y: number, z: number, _nx: number, _ny: number, nz: number) => weather(body, MUD, x, y + z, z, nz, 3.2);
  // tracks: lugged rubber round a steel frame
  const track = m.part((x, _y, _z, _nx, _ny, nz) => (nz > 0.5 && Math.abs(((x + 4) % 0.32) - 0.16) < 0.05 ? steel : black));
  for (const s of [-1, 1]) m.box(track, -2.1, s * 1.2 - 0.34, 0.0, 2.1, s * 1.2 + 0.34, 0.85, 0.2);
  m.box(m.part(steel), -1.2, -0.85, 0.5, 1.2, 0.85, 0.95, 0.04);
  // the house and its rounded counterweight
  const house = m.part(worn);
  m.box(house, -1.5, -1.3, 0.95, 1.05, 1.3, 2.0, 0.12);
  m.slab(house, [[-1.5, -1.3], [-1.95, -1.0], [-2.05, 0], [-1.95, 1.0], [-1.5, 1.3]], 0.95, 1.95, { bevel: 0.1 });
  m.box(m.part(mat('#3d4450')), -1.3, 0.2, 2.0, -0.4, 1.1, 2.12, 0.03);
  // the cab, glass all round
  const cab = m.part((x, y, z, nx, ny, nz) => (nz > 0.8 ? mat('#e2dccb') : z > 2.2 && z < 3.0 && (Math.abs(nx) > 0.45 || Math.abs(ny) > 0.45) ? GLASS : worn(x, y, z, nx, ny, nz)));
  m.box(cab, 0.0, -1.28, 2.0, 1.15, -0.3, 3.15, 0.12);
  // boom up and out, stick down, the bucket's teeth in the dirt
  const arm = m.part(worn);
  const boomAt = { x: 0.9, y: 0.4, z: 1.7 }, boomLen = 3.0, boomUp = 0.6;
  m.box(arm, 0, -0.24, -0.26, boomLen, 0.24, 0.26, 0.06, chain(rotY(-boomUp), move(boomAt.x, boomAt.y, boomAt.z)));
  const tipX = boomAt.x + Math.cos(boomUp) * boomLen, tipZ = boomAt.z + Math.sin(boomUp) * boomLen;
  const stickDown = 1.15, stickLen = 2.5;
  m.box(arm, 0, -0.2, -0.22, stickLen, 0.2, 0.22, 0.05, chain(rotY(stickDown), move(tipX, boomAt.y, tipZ)));
  const bx = tipX + Math.cos(stickDown) * stickLen, bz = tipZ - Math.sin(stickDown) * stickLen;
  m.box(m.part(steel), -0.35, -0.55, 0, 0.45, 0.55, 0.62, 0.08, move(bx, boomAt.y, Math.max(0.02, bz - 0.5)));
  // the hydraulic ram along the boom, polished
  m.box(m.part(mat('#c8ccd2', { gloss: true })), 0.2, -0.08, 0.3, boomLen * 0.75, 0.08, 0.42, 0.03, chain(rotY(-boomUp), move(boomAt.x, boomAt.y, boomAt.z)));
  m.blob(m.part(mat('#e8a23a', { gloss: true })), -0.9, -0.9, 2.08, 0.12, 0.12, 0.1);
  m.lights.push({ key: 'beacon', at: [-0.9, -0.9, 2.2], color: '#ffb347', radius: 160, intensity: 0.5, blinkMs: 1600, size: 5 });
  m.lights.push({ key: 'work', at: [1.2, -0.8, 3.0], color: '#ffe8b0', radius: 240, intensity: 0.45, size: 8 });
  return m;
}
