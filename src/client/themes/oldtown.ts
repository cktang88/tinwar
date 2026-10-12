import { registerTheme } from './registry.ts';
import { paintOldtownFloor } from './oldtownfloor.ts';
import { oldtownOver, oldtownUnder } from './oldtownlive.ts';
import { drawOldtownDoor, drawOldtownPoly, drawOldtownRoof } from './oldtownpolys.ts';
import { OLDTOWN_WALLS } from './oldtownwalls.ts';

/**
 * Old Town: a walled European quarter at dusk. This file registers the theme; the ground (cobbles, squares, the canal, every
 * room's floor) is oldtownfloor.ts with its hand-placed dressing in oldtowndecor.ts, the rect walls (half-timbering, stone,
 * furniture, stalls) oldtownwalls.ts, the polygons, roofs and doors oldtownpolys.ts, and everything that glows, moves or names
 * a place oldtownlive.ts. Shared palette, places and helpers: oldtownkit.ts.
 */
registerTheme('oldtown', {
  floor: paintOldtownFloor,
  walls: OLDTOWN_WALLS,
  under: oldtownUnder,
  over: oldtownOver,
  drawPoly: drawOldtownPoly,
  roof: drawOldtownRoof,
  door: drawOldtownDoor,
});
