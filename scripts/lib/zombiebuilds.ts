import { BUILDINGS, hordeCount, MARK, nightOf, TURRET_KINDS, UTILITY, WALL_TIERS, WORLD, ZOM, ZOMBIE_KINDS, ZOMBIES, type TurretKind, type ZombieKind } from '../../src/shared/defs.ts';
import { MAPS } from '../../src/shared/maps.ts';
import { step } from '../../src/shared/sim.ts';
import { cellRect, investedOf, maxHpOf, reachAt, repairScrapPerHp, turretDef, upgradeCost, wallTier } from '../../src/shared/sim/build.ts';
import { rectsOverlap } from '../../src/shared/sim/movement.ts';
import { zombieMaxHp } from '../../src/shared/sim/run.ts';
import { paceOf } from '../../src/shared/sim/zomroles.ts';
import { coverRects, createWorld, newId, rand, type Building, type Turret, type Vent, type World, type Zombie } from '../../src/shared/sim/world.ts';

const TICK_MS = 1000 / WORLD.tickHz;
/** The ring's half-width in cells round the core's center cell, and the walk from the spawn line to the ring. */
const RING = 4, SPAWN_PX = 700;
/** How long a dry turret waits for someone to come and refill it, when it is tended. */
const TEND_MS = 3000;

export type FortSetup = {
  night: number; seed?: number; ms?: number;
  /** The zombies that walk in: the night's own mix (default), or packs of only these kinds. */
  kinds?: readonly ZombieKind[];
  turrets?: readonly { kind: TurretKind; lv: number }[];
  /** The ring's south face at this wall tier with its real health; otherwise the whole ring stands unbreakable. */
  southTier?: number;
  /** A utility one cell further in, behind the turrets. */
  salvage?: number; post?: number;
  /** A row of spike strips laid along the outside of the south face. */
  spikes?: boolean;
  /** Whether a dry turret is refilled (after `TEND_MS`, free), as a squad does; without it a turret run dry stays dry. */
  tend?: boolean;
  /** Keep streaming zombies while fewer than this are alive. */
  alive?: number;
  /** A one-cell gap left open in the south face, two cells west of its middle: a chokepoint every zombie walks through to the core, and then in again from the south. A flame vent stands beside its inner mouth, its jet across it. */
  gap?: boolean;
  /** A decoy beacon at this level out in the open, four cells south of the south face, in the horde's way. */
  decoy?: number;
};
export type FortRun = {
  /** Health the horde lost in all, and its kills. */
  harm: number; kills: number; byKind: Record<ZombieKind, number>;
  /** Rounds the turrets fired (refills are free) and the scrap mending the turrets' wear would cost; a turret lost is its whole price. */
  rounds: number; /** The scrap the kills paid into the bank, a salvage yard's bonus included. */ income: number; repairScrap: number; turretsLost: number;
  /** What the horde took off the south face, before its armor, the scrap mending it would cost, and the first second a wall of it fell (null if none did). */
  wallBitten: number; wallRepairScrap: number; breachSec: number | null;
  /** Health a repair post gave back to the buildings, and what mending that by hand would have cost. */
  mended: number; mendedScrap: number;
  /** Zombie-seconds of walk the horde lost to holds, stuns and shoves back (a scatter's, a coil's); zombie-seconds a coil's mark was on a zombie; harm done to zombies still more than 150 px out from the south face. */
  timeBought: number; marked: number; farHarm: number;
  seconds: number;
};

const coreCell = (w: World) => Math.floor(MAPS[w.map].siege!.core.x / ZOM.cell);

/**
 * A scripted lane: the Outpost's core walled in by a ring of walls `RING` cells out (unbreakable but for a south face at `southTier`), turrets just inside the
 * south face, and packs of night `night`'s zombies (its mix, at its health and bite) streaming in from `SPAWN_PX` south while fewer than `alive` stand.
 * The Bastion's own gun is silenced (no survivors), so the horde's losses are the buildings' work. Measures what the buildings did and what they cost to keep.
 */
export function playFort(s: FortSetup): FortRun {
  const w = createWorld('ZOM', s.seed ?? 1, 'outpost');
  const run = w.run!;
  const ms = s.ms ?? 90_000, night = s.night, c = coreCell(w);
  run.night = night;
  run.core.hp = 1e12;
  run.survivors = 0;
  run.scrap = 1e9;
  run.phase = { k: 'night', toSpawn: [{ kind: 'walker', side: 'north', n: 1 }], nextSpawnAt: Infinity, dawnAt: Infinity };
  const cover = coverRects(w);
  const free = (cx: number, cy: number) => !cover.some((r) => rectsOverlap(r, cellRect(cx, cy)));
  const south: Building[] = [];
  const gap = { cx: c - 2, cy: c + RING };
  for (let cy = c - RING; cy <= c + RING; cy++) {
    for (let cx = c - RING; cx <= c + RING; cx++) {
      if (Math.max(Math.abs(cx - c), Math.abs(cy - c)) !== RING || !free(cx, cy)) continue;
      if (s.gap && cx === gap.cx && cy === gap.cy) continue;
      const real = s.southTier !== undefined && cy === c + RING;
      const lv = real ? s.southTier! : 3;
      const b: Building = { id: newId(w), kind: 'wall', cx, cy, hp: real ? wallTier(lv).hp : 1e9, ...(lv > 1 && { lv }) };
      w.buildings.push(b);
      if (real) south.push(b);
    }
  }
  // A flame vent stands just inside the wall: beside the gap's inner mouth, its jet across the way every zombie walks in by (a second one a row further in),
  // or inside the south face's middle, its jet out through the face onto the horde piled at it (a second one beside it).
  let vents = 0;
  const turrets: (Turret | Vent)[] = (s.turrets ?? []).map((t, i, all) => {
    const at = { id: newId(w), hp: maxHpOf(t.kind, t.lv), ...(t.lv > 1 && { lv: t.lv }), owner: -1, ammo: turretDef(t.kind, t.lv).ammo, nextFireAt: 0 };
    if (t.kind === 'vent') {
      const n = vents++;
      const v: Vent = s.gap ? { ...at, kind: 'vent', cx: gap.cx - 1, cy: gap.cy - 1 - n, flareUntil: 0, dir: 0 } : { ...at, kind: 'vent', cx: c + n, cy: c + RING - 1, flareUntil: 0, dir: 1 };
      w.buildings.push(v);
      return v;
    }
    const cx = c + i - Math.floor((all.length - 1) / 2);
    const b: Turret = { ...at, kind: t.kind, cx, cy: c + RING - 1 };
    w.buildings.push(b);
    return b;
  });
  if (s.decoy) w.buildings.push({ id: newId(w), kind: 'decoy', cx: c, cy: c + RING + 4, hp: maxHpOf('decoy', s.decoy), ...(s.decoy > 1 && { lv: s.decoy }) });
  if (s.salvage) w.buildings.push({ id: newId(w), kind: 'salvage', cx: c - 1, cy: c + RING - 2, hp: maxHpOf('salvage', s.salvage), ...(s.salvage > 1 && { lv: s.salvage }) });
  const post = s.post ? { id: newId(w), kind: 'post' as const, cx: c + 1, cy: c + RING - 2, hp: maxHpOf('post', s.post), ...(s.post > 1 && { lv: s.post }) } : null;
  if (post) w.buildings.push(post);
  if (s.spikes) for (let cx = c - RING; cx <= c + RING; cx++) if (free(cx, c + RING + 1)) w.floor.push({ id: newId(w), kind: 'spikes', cx, cy: c + RING + 1, hp: maxHpOf('spikes') });
  w.buildingsVersion++;

  const r = () => rand(w);
  const mix: ZombieKind[] = [];
  const def = nightOf(night).horde;
  for (const kind of s.kinds ?? ZOMBIE_KINDS) {
    const n = s.kinds ? ZOMBIES[kind].pack * 4 : hordeCount(kind, def[kind] ?? 0, 1);
    for (let left = n; left > 0; left -= ZOMBIES[kind].pack) mix.push(kind);
  }
  for (let i = mix.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [mix[i], mix[j]] = [mix[j]!, mix[i]!]; }
  const core = MAPS[w.map].siege!.core;
  let next = 0, spawnAt = 0;
  const spawnPack = (kind: ZombieKind) => {
    const n = ZOMBIES[kind].pack, x0 = core.x + (r() - 0.5) * 300;
    for (let i = 0; i < n; i++) {
      w.zombies.push({ id: newId(w), kind, x: x0 + (i - (n - 1) / 2) * 44, y: core.y + SPAWN_PX + (r() - 0.5) * 60 + (i % 2) * 40, hp: zombieMaxHp(kind, night, 1), attackAt: 0, vx: 0, vy: 0, pack: 1 });
    }
  };

  const byKind = Object.fromEntries(ZOMBIE_KINDS.map((k) => [k, 0])) as Record<ZombieKind, number>;
  const out: FortRun = {
    harm: 0, kills: 0, byKind, rounds: 0, income: 0, repairScrap: 0, turretsLost: 0, wallBitten: 0, wallRepairScrap: 0, breachSec: null, mended: 0, mendedScrap: 0,
    timeBought: 0, marked: 0, farHarm: 0, seconds: ms / 1000,
  };
  const dryAt = new Map<Turret | Vent, number>();
  const hpOf = new Map<Zombie, number>();
  const farY = (c + RING + 1) * ZOM.cell + 150;
  const standing = (b: Turret | Vent) => w.buildings.includes(b);
  for (let t = 0; t < ms; t += TICK_MS) {
    if (w.now >= spawnAt && w.zombies.length < (s.alive ?? 30)) {
      spawnPack(mix[next++ % mix.length]!);
      spawnAt = w.now + 1200;
    }
    const dt = TICK_MS / 1000;
    // Through the gap, a zombie that reaches the core has got past the chokepoint: it walks in again from the south with what it has left (and any burn on it), so the stream keeps coming through.
    if (s.gap) {
      for (const z of w.zombies) {
        if (Math.hypot(z.x - core.x, z.y - core.y) > ZOM.coreHalf + 60) continue;
        z.x = core.x + (r() - 0.5) * 300;
        z.y = core.y + SPAWN_PX;
        z.knock = null;
        delete z.ai;
      }
    }
    for (const z of w.zombies) {
      hpOf.set(z, z.hp);
      // A hold takes its share of the step; a shove back toward the south undoes walk at the zombie's own pace.
      out.timeBought += (1 - paceOf(z, w.now)) * dt + (z.knock ? Math.max(0, z.knock.vy) * dt / ZOMBIES[z.kind].speed : 0);
      if ((z.mark ?? 0) > w.now) out.marked += dt;
    }
    const ammo = turrets.map((b) => b.ammo), hp = turrets.map((b) => b.hp), wallHp = south.map((b) => b.hp), postHp = w.buildings.filter((b) => b !== post).map((b) => [b, b.hp] as const);
    step(w, TICK_MS);
    let paid = 0;
    for (const e of w.events) if (e.e === 'zkill') { out.kills++; byKind[e.kind]++; paid += e.scrap ?? 0; }
    out.income += paid;
    for (const [z, was] of hpOf) {
      const lost = w.zombies.includes(z) ? Math.max(0, was - z.hp) : Math.max(0, was);
      out.harm += lost;
      // A burn a zombie carries back out of the gap is the vent's work at the gap, not reach.
      if (z.y > farY && !(z.burn && z.burn.until > w.now)) out.farHarm += lost;
    }
    hpOf.clear();
    // A post mends before the horde's next bite: what it gave back is any rise in a building's health this tick.
    if (post) for (const [b, was] of postHp) if (b.hp > was && w.buildings.includes(b)) { out.mended += b.hp - was; out.mendedScrap += (b.hp - was) * repairScrapPerHp(b.kind, b.lv ?? 1); }
    turrets.forEach((b, i) => {
      const lv = b.lv ?? 1, tdef = turretDef(b.kind, lv);
      if (b.ammo < ammo[i]!) out.rounds += Math.round(ammo[i]! - b.ammo);
      const alive = standing(b);
      if (!alive) { if (hp[i]! > 0) { out.turretsLost++; b.hp = 0; } return; }
      if (b.hp < hp[i]!) out.repairScrap += (hp[i]! - b.hp) * repairScrapPerHp(b.kind, lv);
      if (s.tend && b.ammo < 1) {
        if (!dryAt.has(b)) dryAt.set(b, w.now);
        else if (w.now - dryAt.get(b)! >= TEND_MS) { b.ammo = tdef.ammo; dryAt.delete(b); }
      }
    });
    south.forEach((b, i) => {
      const lost = wallHp[i]! - Math.max(0, b.hp);
      if (lost <= 0) return;
      // What came off it after its armor gave its share back is what mending costs; before it, what the horde bit.
      out.wallBitten += lost / (1 - wallTier(b.lv ?? 1).armor);
      out.wallRepairScrap += lost * repairScrapPerHp('wall', b.lv ?? 1);
      if (b.hp <= 0 && out.breachSec === null) out.breachSec = w.now / 1000;
    });
  }
  for (const b of turrets) if (!standing(b) && b.hp !== 0) out.turretsLost++;
  // A turret lost must be built again: its whole price, less the mending already counted for it.
  out.repairScrap += turrets.filter((b) => b.hp === 0).reduce((n, b) => n + investedOf(b.kind, b.lv ?? 1) * (1 - ZOM.repairShare), 0);
  return out;
}

/** The scrap a building stands for: its price and every step up. */
export const priceOf = (kind: TurretKind | 'salvage' | 'post' | 'spikes' | 'decoy', lv: number) => investedOf(kind, lv);
export const NIGHTS_LIFE = 3;
/**
 * Value a scrap: what a building does (the horde's health it takes off, or the bites it saves the wall, or the walk it costs the horde) over `NIGHTS_LIFE` nights
 * like this one, over its price plus that many nights' upkeep (mending: ammo is free).
 */
export const valuePerScrap = (harm: number, price: number, upkeep: number) => (NIGHTS_LIFE * harm) / (price + NIGHTS_LIFE * upkeep);
export { BUILDINGS };

/** The axes a buildable is judged on, each higher-is-better (see `buildMatrix`). */
export const AXES = [
  'vsWalker', 'vsRunner', 'vsPlated', 'vsBloater', 'vsBrute', 'vsHeavy', 'vsMix', 'range', 'farHarm', 'pierce', 'timeBought', 'wallSaved', 'gunBoost', 'chokepoint', 'aggroPull',
  'cheap', 'hpPerScrap', 'burstHpPerScrap', 'hpPerCell', 'mendSpeed', 'harmPerRepair', 'scrapReturn', 'squadSustain', 'slow',
] as const;
export type Axis = (typeof AXES)[number];
export type Group = 'turret' | 'wall' | 'utility';
export type MatrixRow = { name: string; group: Group; price: number; at: Record<Axis, number> };
const KIND_AXES: readonly [ZombieKind, Axis][] = [['walker', 'vsWalker'], ['runner', 'vsRunner'], ['plated', 'vsPlated'], ['bloater', 'vsBloater'], ['brute', 'vsBrute']];
const zeroAxes = () => Object.fromEntries(AXES.map((a) => [a, 0])) as Record<Axis, number>;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

/** The metric a turret's niche is judged by in `upgradeRoi`: the harm it does, the walk it costs the horde, the zombie-seconds it keeps marked, or the harm it does far out. */
export type Metric = 'harm' | 'timeBought' | 'marked' | 'farHarm';

/**
 * Every buildable at its first level (each wall tier as its own) on every axis that matters, higher better:
 * - `vs<Kind>` and `vsMix`: the horde health it takes off a scrap (`valuePerScrap`, `playFort` against packs of that kind at night `kindNight`, and the real mix of `nights`); `vsHeavy` the
 *   same against brutes and plated together. A flame vent lies just outside the south face; spikes are used up, so theirs is one night's.
 * - `range`, and `farHarm`: the harm a scrap it does to zombies still well out from the wall, through the gap (where the stream keeps walking in); `pierce`: how many zombies one round can strike in a line.
 * - `timeBought`: zombie-seconds of walk a scrap its holds, stuns and shoves cost the horde; `wallSaved`: the bites a scrap it spares a steel south face, against the mix
 *   (each value a scrap over `NIGHTS_LIFE` nights, its upkeep counted).
 * - `gunBoost`: the extra harm a scrap the squad's guns would do through its marks, at `MARK.gunMul`, for a squad pouring `GUN_DPS` a second into each marked zombie.
 * - `chokepoint`: the horde health it takes off a scrap with a one-cell gap left in the south face (`FortSetup.gap`), every zombie through it to the core and round again.
 * - `aggroPull`: how far a decoy draws the horde.
 * - `cheap` (one over its price); `hpPerScrap`, `burstHpPerScrap` and `hpPerCell`: its health against bites (a wall's armor counted) and against a bloater's burst (a wall's `blast`), a scrap and in its one cell;
 *   `mendSpeed`: how fast holding use mends it; `harmPerRepair`: the harm it does a scrap of mending (ammo is free).
 * - What a utility does that nothing else does: a salvage yard's `scrapReturn` (the extra scrap its kills pay over `NIGHTS_LIFE` nights, a scrap of its price, beside two tended
 *   sentries), a medic post's `squadSustain` (health a second it gives the squad: its healing, and a revive's worth of health at its revive pace) and spikes' `slow`.
 */
export const GUN_DPS = 60;
export function buildMatrix({ seeds = [1], nights = [3, 5, 7], kindNight = 5, ms = 90_000 } = {}): MatrixRow[] {
  const rows: MatrixRow[] = [];
  const scale = 90_000 / ms;
  const runs = (s: Omit<FortSetup, 'night' | 'seed'>, ns: readonly number[]) => ns.flatMap((night) => seeds.map((seed) => playFort({ ...s, night, seed, ms })));
  // The steel south face bitten with nothing there, to measure what a building spares it.
  const bare = mean(runs({ southTier: 3, tend: true }, nights).map((r) => r.wallBitten)) * scale;
  for (const kind of TURRET_KINDS) {
    const def = turretDef(kind, 1), price = investedOf(kind, 1), at = zeroAxes();
    const upkeepOf = (r: FortRun) => r.repairScrap;
    const judge = (rs: FortRun[], what: (r: FortRun) => number = (r) => r.harm) => {
      const harm = mean(rs.map(what)) * scale, upkeep = mean(rs.map(upkeepOf)) * scale;
      return { harm, upkeep, value: valuePerScrap(harm, price, upkeep) };
    };
    const turrets = [{ kind, lv: 1 }];
    const mixRuns = runs({ turrets, tend: true }, nights);
    const mix = judge(mixRuns);
    at.vsMix = mix.value;
    at.harmPerRepair = mix.harm / Math.max(1, mix.upkeep);

    at.timeBought = judge(mixRuns, (r) => r.timeBought).value;
    at.gunBoost = judge(mixRuns, (r) => r.marked * GUN_DPS * (MARK.gunMul - 1)).value;
    for (const [z, axis] of KIND_AXES) at[axis] = judge(runs({ turrets, tend: true, kinds: [z] }, [kindNight])).value;
    at.vsHeavy = judge(runs({ turrets, tend: true, kinds: ['brute', 'plated'] }, [kindNight])).value;
    at.wallSaved = judge(runs({ turrets, tend: true, southTier: 3 }, nights), (r) => bare - r.wallBitten * scale).value;
    const gapRuns = runs({ turrets, tend: true, gap: true }, nights);
    at.chokepoint = judge(gapRuns).value;
    // Far out is judged on the gap's lane, where the stream keeps walking in: with the face shut the horde piles at it and stops coming.
    at.farHarm = judge(gapRuns, (r) => r.farHarm).value;
    at.range = def.range;
    at.pierce = 1 + (def.pierce ?? 0);
    at.cheap = 1 / price;
    at.hpPerScrap = at.burstHpPerScrap = maxHpOf(kind, 1) / price;
    at.hpPerCell = maxHpOf(kind, 1);
    at.mendSpeed = 1;
    rows.push({ name: BUILDINGS[kind].name, group: 'turret', price, at });
  }
  for (const [i, t] of WALL_TIERS.entries()) {
    const at = zeroAxes(), ehp = t.hp / (1 - t.armor);
    Object.assign(at, { cheap: 1 / t.cost, hpPerScrap: ehp / t.cost, burstHpPerScrap: t.hp / t.blast / t.cost, hpPerCell: ehp, mendSpeed: t.repairMul });
    rows.push({ name: t.name, group: 'wall', price: investedOf('wall', i + 1), at });
  }
  // What two tended sentries' kills pay with nothing else there, to measure what a yard adds.
  const pair = [{ kind: 'sentry' as const, lv: 1 }, { kind: 'sentry' as const, lv: 1 }];
  const plainIncome = mean(runs({ turrets: pair, tend: true }, nights).map((r) => r.income)) * scale;
  for (const kind of ['salvage', 'post', 'decoy'] as const) {
    const price = BUILDINGS[kind].cost, hp = maxHpOf(kind, 1), at = zeroAxes();
    Object.assign(at, { cheap: 1 / price, hpPerScrap: hp / price, burstHpPerScrap: hp / price, hpPerCell: hp, mendSpeed: 1 });
    if (kind === 'salvage') at.scrapReturn = (NIGHTS_LIFE * (mean(runs({ turrets: pair, tend: true, salvage: 1 }, nights).map((r) => r.income)) * scale - plainIncome)) / price;
    else if (kind === 'post') at.squadSustain = UTILITY.post.playerHp + (UTILITY.post.revive * ZOM.reviveHpFrac * 100) / (ZOM.reviveMs / 1000);
    else {
      at.aggroPull = reachAt(UTILITY.decoy.reach, 1);
      // A decoy is not mended in the lane: what it spares the wall is all it gives, against its price alone.
      at.wallSaved = valuePerScrap(bare - mean(runs({ southTier: 3, decoy: 1 }, nights).map((r) => r.wallBitten)) * scale, price, 0);
    }
    rows.push({ name: BUILDINGS[kind].name, group: 'utility', price, at });
  }
  const strips = runs({ spikes: true }, nights);
  const laid = 2 * RING + 1, spikePrice = BUILDINGS.spikes.cost;
  const at = zeroAxes();
  at.vsMix = mean(strips.map((r) => r.harm)) * scale / (laid * spikePrice);
  at.harmPerRepair = at.vsMix;
  Object.assign(at, { cheap: 1 / spikePrice, hpPerScrap: maxHpOf('spikes', 1) / spikePrice, hpPerCell: maxHpOf('spikes', 1), slow: 1 - UTILITY.spikes.slow });
  rows.push({ name: BUILDINGS.spikes.name, group: 'utility', price: spikePrice, at });
  return rows;
}

/** `b` dominates `a` when it is at least as good on every axis and better on one. */
export const dominates = (b: MatrixRow, a: MatrixRow) => AXES.every((x) => b.at[x] >= a.at[x]) && AXES.some((x) => b.at[x] > a.at[x]);
/** Every pair where one buildable dominates another, as [the dominated, by]. */
export const dominatedPairs = (rows: readonly MatrixRow[]): [string, string][] =>
  rows.flatMap((a) => rows.filter((b) => b !== a && dominates(b, a)).map((b) => [a.name, b.name] as [string, string]));
/** The axes on which each buildable is the strict best of its group: where it is the buy. */
export function winsOf(rows: readonly MatrixRow[]): Map<string, Axis[]> {
  return new Map(rows.map((a) => {
    const peers = rows.filter((b) => b.group === a.group && b !== a);
    return [a.name, AXES.filter((x) => a.at[x] > 0 && peers.every((b) => a.at[x] > b.at[x]))];
  }));
}

export type UpgradeRoi = { kind: TurretKind; copy: number; steps: [number, number]; levels: [number, number, number] };
/**
 * Whether a turret's steps up pay: the value a scrap (`valuePerScrap`) of each step at what the turret is for (`metric`: harm, walk bought or marks) against the night's
 * own mix (or packs of only `kinds`, or through the gap with `gap`), set beside a second level-I copy built next to the first (where space allows), all tended.
 * `levels` is the value a scrap of the whole turret at each level.
 */
export function upgradeRoi(kind: TurretKind, { seeds = [1], nights = [5], ms = 90_000, kinds = undefined as readonly ZombieKind[] | undefined, metric = 'harm' as Metric, gap = false } = {}): UpgradeRoi {
  const play = (turrets: { kind: TurretKind; lv: number }[]) => {
    const rs = nights.flatMap((night) => seeds.map((seed) => playFort({ night, seed, ms, turrets, tend: true, kinds, gap })));
    return { harm: mean(rs.map((r) => r[metric])) * (90_000 / ms), upkeep: mean(rs.map((r) => r.repairScrap)) * (90_000 / ms) };
  };
  const one = play([{ kind, lv: 1 }]), two = play([{ kind, lv: 1 }, { kind, lv: 1 }]), l2 = play([{ kind, lv: 2 }]), l3 = play([{ kind, lv: 3 }]);
  const step = (from: typeof one, to: typeof one, cost: number) => valuePerScrap(to.harm - from.harm, cost, to.upkeep - from.upkeep);
  return {
    kind, copy: step(one, two, investedOf(kind, 1)), steps: [step(one, l2, upgradeCost(kind, 1)!), step(l2, l3, upgradeCost(kind, 2)!)],
    levels: [valuePerScrap(one.harm, investedOf(kind, 1), one.upkeep), valuePerScrap(l2.harm, investedOf(kind, 2), l2.upkeep), valuePerScrap(l3.harm, investedOf(kind, 3), l3.upkeep)],
  };
}
