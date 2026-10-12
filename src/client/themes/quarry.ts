import { registerTheme } from './registry.ts';
import { quarryOver, quarryUnder } from './quarrydecor.ts';
import { paintQuarryFloor } from './quarryfloor.ts';
import { drawQuarryPoly, drawQuarryRoof } from './quarrygeo.ts';
import { QUARRY_WALLS } from './quarrywalls.ts';

/**
 * Quarry No. 9, a working open-pit stone quarry under a storm sky: registers the theme. Floor in quarryfloor.ts, rect walls in
 * quarrywalls.ts, the pit's ledges, stockpiles, conveyors, pond, tank, vehicles and roofs in quarrygeo.ts, and the small stories,
 * signs, lights and everything that moves in quarrydecor.ts. Its birds and dust devils stay in ambientmaps.ts, its weather in mood.ts.
 */
registerTheme('quarry', { floor: paintQuarryFloor, walls: QUARRY_WALLS, under: quarryUnder, over: quarryOver, drawPoly: drawQuarryPoly, roof: drawQuarryRoof });
