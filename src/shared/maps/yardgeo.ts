/**
 * Geometry for the three plain yard maps (plaza, old town, quarry), authored for the west half; `withGeometry` adds the half-turn twin.
 * Each gets roofed buildings with doors (an office with swing doors, a warehouse with a double slider...) and a few angled or curved
 * pieces (a hex kiosk, curved retaining walls, round silos and towers). Roof materials are named on the roofs (src/client/roofart.ts).
 */
import { make, poly, type MapDoor, type MapPoly, type MapRoof } from '../geom.ts';
import type { Geometry } from '../mapgeo.ts';
import { arcWall, hexKiosk, place } from '../shapes.ts';
import { roomDoor, roomRoof, roomWalls, type RoomSpec } from './roomkit.ts';

/* -------------------------------------------------------------- old town */

/** Buildings of the old town's street grid are 500 px shells with 100 px gaps in each wall; these get doors and roofs. */
const swingPair = (id: string, x: number, y: number, axis: 'h' | 'v', material = 'wood'): MapDoor => ({ id, kind: 'double-swing', x, y, w: 100, axis, material });
export const OLDTOWN_GEO: Geometry = {
  polys: [
    ...place(arcWall, { x: 1350, y: 3200, scale: 0.4 }, 'brick', { id: 'curve' }),
    make(poly.circle(1200, 3500, 110, 18), 'brick', { id: 'tower', height: 60, shape: 'roundTower' }),
    ...place(hexKiosk, { x: 2325, y: 3625, scale: 0.8 }, 'wood', { id: 'hexkiosk' }),
  ],
  doors: [
    swingPair('bank-n', 1400, 1125, 'h'),
    { id: 'bank-s', kind: 'swing', x: 1400, y: 1575, w: 100, axis: 'h', hinge: 'start', material: 'wood' },
    { id: 'depot-n', kind: 'double-slide', x: 1850, y: 1125, w: 100, axis: 'h', material: 'metal', closeMs: 1800 },
    { id: 'depot-s', kind: 'double-slide', x: 1850, y: 1575, w: 100, axis: 'h', material: 'metal', closeMs: 1800 },
    swingPair('hall-n', 1400, 3825, 'h'),
    { id: 'hall-s', kind: 'swing', x: 1400, y: 4275, w: 100, axis: 'h', hinge: 'end', material: 'wood' },
  ],
  roofs: [
    { id: 'bank', material: 'tile', points: poly.rect(1200, 1100, 500, 500) },
    { id: 'depot', material: 'corrugated', points: poly.rect(1650, 1100, 500, 500) },
    { id: 'hall', material: 'tile', points: poly.rect(1200, 3800, 500, 500) },
  ],
};

/* ---------------------------------------------------------------- quarry */

export const QUARRY_GEO: Geometry = {
  polys: [
    make(poly.circle(2075, 3300, 130, 24), 'tank', { id: 'silo', height: 52, shape: 'roundTank' }),
    ...place(arcWall, { x: 1450, y: 3550, scale: 0.5, rot: Math.PI }, 'rock', { id: 'retaining' }),
  ],
  doors: [
    { id: 'office-e', kind: 'double-swing', x: 725, y: 1350, w: 150, axis: 'v', material: 'wood' },
    { id: 'office-s', kind: 'swing', x: 400, y: 1775, w: 150, axis: 'h', hinge: 'start', material: 'wood' },
    { id: 'shed-n', kind: 'double-slide', x: 1250, y: 4225, w: 150, axis: 'h', material: 'metal', closeMs: 1800 },
    { id: 'shed-e', kind: 'swing', x: 1575, y: 4400, w: 150, axis: 'v', hinge: 'start', material: 'wood' },
    { id: 'works-n', kind: 'double-swing', x: 550, y: 4925, w: 150, axis: 'h', material: 'metal' },
    { id: 'works-e', kind: 'double-slide', x: 875, y: 5050, w: 150, axis: 'v', material: 'metal', closeMs: 1800 },
  ],
  roofs: [
    { id: 'office', material: 'tar', points: poly.rect(200, 1200, 550, 600) },
    { id: 'shed', material: 'corrugated', points: poly.rect(1000, 4200, 600, 500) },
    { id: 'works', material: 'metal', points: poly.rect(300, 4900, 600, 500) },
  ],
};
