import { UTILITY, ZOM, ZOMBIES, type ZombieKind } from '../defs.ts';
import { auraOf, inJet, jetOf, levelOf, maxHpOf, reachAt, salvageBonusOf, turretDef } from './build.ts';
import { damageZombie } from './run.ts';
import { effectiveStats } from './stats.ts';
import { dist2 } from './movement.ts';
import type { Building, Run, World, Zombie } from './world.ts';

/**
 * What the utilities do besides stand there: spike strips slow, hurt and wear under the horde that walks over them, a steel wall shrugs off part of each bite,
 * a medic post tends everything in its reach and a salvage yard pays more for the kills in its. The horde's own tick (horde.ts) knows none of it, so each hook here is handed what it needs
 * from just before that tick and corrects the result after it: a slowed zombie keeps `slow` of the step it took, an armoured wall gets back its share of the bites.
 */

const key = (cx: number, cy: number) => cx * 4096 + cy;
const heavy: ReadonlySet<ZombieKind> = new Set<ZombieKind>(['brute', 'bloater', 'colossus']);
const everySecond = (w: World, dtMs: number) => Math.floor(w.now / 1000) !== Math.floor((w.now - dtMs) / 1000);

/**
 * How much of its step a zombie standing at (`x`, `y`) keeps: `UTILITY.spikes.slow` over a spike strip, 1 anywhere else. `tickTraps` applies it after the horde's tick;
 * a zombie AI that wants to slow its own walk instead can multiply its speed by this and drop the correction.
 */
export const spikeSlowAt = (w: World, x: number, y: number): number => {
  const cx = Math.floor(x / ZOM.cell), cy = Math.floor(y / ZOM.cell);
  return w.floor.some((s) => s.kind === 'spikes' && s.cx === cx && s.cy === cy) ? UTILITY.spikes.slow : 1;
};

type TrapWatch = Map<Zombie, { x: number; y: number }>;

/** Zombies standing on a spike strip, where they stand before the horde moves. Null with no strips down. */
export function trapWatch(w: World): TrapWatch | null {
  if (w.floor.length === 0 || w.zombies.length === 0) return null;
  const strips = new Set(w.floor.filter((s) => s.kind === 'spikes').map((s) => key(s.cx, s.cy)));
  if (strips.size === 0) return null;
  const on: TrapWatch = new Map();
  for (const z of w.zombies) if (strips.has(key(Math.floor(z.x / ZOM.cell), Math.floor(z.y / ZOM.cell)))) on.set(z, { x: z.x, y: z.y });
  return on.size ? on : null;
}

/** Slows and hurts what was on a strip, and wears the strip by its weight; a strip worn through is gone. */
export function tickTraps(w: World, dtMs: number, on: TrapWatch | null) {
  if (!on) return;
  const wear = new Map<number, number>();
  for (const [z, from] of on) {
    if (z.hp <= 0 || !w.zombies.includes(z)) continue;
    z.x = from.x + (z.x - from.x) * UTILITY.spikes.slow;
    z.y = from.y + (z.y - from.y) * UTILITY.spikes.slow;
    z.vx *= UTILITY.spikes.slow;
    z.vy *= UTILITY.spikes.slow;
    const at = key(Math.floor(from.x / ZOM.cell), Math.floor(from.y / ZOM.cell));
    wear.set(at, (wear.get(at) ?? 0) + ((heavy.has(z.kind) ? UTILITY.spikes.heavyWear : UTILITY.spikes.wear) * dtMs) / 1000);
    damageZombie(w, z, (UTILITY.spikes.dps * dtMs) / 1000, null, 'blast');
  }
  for (const strip of [...w.floor]) {
    if (strip.kind !== 'spikes') continue;
    const worn = wear.get(key(strip.cx, strip.cy));
    if (!worn) continue;
    strip.hp -= worn;
    if (strip.hp > 0) continue;
    w.floor = w.floor.filter((s) => s !== strip);
    w.events.push({ e: 'boom', x: (strip.cx + 0.5) * ZOM.cell, y: (strip.cy + 0.5) * ZOM.cell, r: ZOM.cell / 2 });
  }
}

const centerOf = (b: { cx: number; cy: number }) => ({ x: (b.cx + 0.5) * ZOM.cell, y: (b.cy + 0.5) * ZOM.cell });

/**
 * The best bonus any salvage yard pays for a kill at (`x`, `y`): `salvageBonusOf` its level within its reach, 0 out of every yard's reach. Yards do not stack,
 * and the yard that pays is the one with that bonus nearest the kill. Null when no yard reaches.
 */
export function salvageAt(w: World, x: number, y: number): { yard: Building; bonus: number } | null {
  let best: { yard: Building; bonus: number; d: number } | null = null;
  for (const b of w.buildings) {
    if (b.kind !== 'salvage') continue;
    const lv = levelOf(b), at = centerOf(b), d = dist2(x, y, at.x, at.y), bonus = salvageBonusOf(lv);
    if (d > reachAt(UTILITY.salvage.reach, lv) ** 2) continue;
    if (!best || bonus > best.bonus || (bonus === best.bonus && d < best.d)) best = { yard: b, bonus, d };
  }
  return best && { yard: best.yard, bonus: best.bonus };
}

/** How fast a medic post revives a squad player downed at (`x`, `y`), as a share of a squadmate's pace: the fastest post in reach, 0 out of every one's. */
export function medicReviveAt(w: World, x: number, y: number): number {
  let rate = 0;
  for (const b of w.buildings) {
    if (b.kind !== 'post') continue;
    const lv = levelOf(b), at = centerOf(b);
    if (dist2(x, y, at.x, at.y) <= reachAt(UTILITY.post.reach, lv) ** 2) rate = Math.max(rate, UTILITY.post.revive * auraOf(lv));
  }
  return rate;
}

/**
 * A medic post heals squad players and mends the other buildings in its reach, free (its reviving is `medicReviveAt`, which the downed tick reads). It says so,
 * at most once a second, in an `aid` event. A salvage yard says once a second what extra scrap its kills paid since it last did.
 */
export function tickUtilities(w: World, run: Run, dtMs: number) {
  const dt = dtMs / 1000;
  const say = everySecond(w, dtMs);
  for (const u of w.buildings) {
    if (u.kind === 'salvage') {
      const owed = say ? run.salvaged?.get(u.id) : undefined;
      if (owed) {
        const at = centerOf(u);
        w.events.push({ e: 'aid', kind: 'salvage', x: at.x, y: at.y, scrap: Math.round(owed) || 1 });
        run.salvaged!.delete(u.id);
      }
      continue;
    }
    if (u.kind !== 'post') continue;
    const lv = levelOf(u), aura = auraOf(lv), at = centerOf(u);
    const reach = reachAt(UTILITY.post.reach, lv);
    let did = false;
    for (const p of w.players.values()) {
      if (dist2(p.x, p.y, at.x, at.y) > reach ** 2) continue;
      if (p.life.k === 'downed') { did = true; continue; }
      if (p.life.k !== 'alive') continue;
      const max = effectiveStats(p).maxHp;
      if (p.life.hp < max) { p.life.hp = Math.min(max, p.life.hp + UTILITY.post.playerHp * aura * dt); did = true; }
    }
    for (const b of w.buildings) {
      if (b === u) continue;
      const c = centerOf(b), max = maxHpOf(b.kind, levelOf(b));
      if (b.hp < max && dist2(at.x, at.y, c.x, c.y) <= reach ** 2) { b.hp = Math.min(max, b.hp + UTILITY.post.buildingHp * aura * dt); did = true; }
    }
    if (did && say) w.events.push({ e: 'aid', kind: u.kind, x: at.x, y: at.y });
  }
}

/** How hard a burn of `stacks` licks bites: the first lick in full, each one after it half again. */
export const burnMul = (stacks: number) => 1 + 0.5 * (stacks - 1);

/**
 * Flame vents: while a zombie stands in a vent's jet (`jetOf`, the zombie's own size besides) the vent puffs, one fuel, and its jet then burns on
 * `patchMs` free. Every `fireMs` the jet licks whatever stands in it: alight for `burn.ms`, a lick more (up to `burn.stacks`) on one already burning.
 * Each puff says so in a `turret` event, its angle the vent's facing, as a gun turret's shot does.
 */
export function tickVents(w: World) {
  for (const v of w.buildings) {
    if (v.kind !== 'vent' || w.now < v.nextFireAt) continue;
    const lv = levelOf(v), def = turretDef('vent', lv), burn = def.burn!;
    const jet = jetOf(v.cx, v.cy, v.dir, lv);
    const inFlame = w.zombies.filter((z) => inJet(jet, z.x, z.y, ZOMBIES[z.kind].radius));
    if (inFlame.length === 0) continue;
    if (w.now >= v.flareUntil) {
      if (v.ammo < 1) continue;
      v.ammo--;
      v.flareUntil = w.now + burn.patchMs;
      const at = centerOf(v);
      w.events.push({ e: 'turret', kind: 'vent', x: at.x, y: at.y, angle: Math.round(Math.atan2(jet.uy, jet.ux) * 100) / 100 });
    }
    v.nextFireAt = w.now + def.fireMs;
    for (const z of inFlame) {
      const lit = z.burn && z.burn.until > w.now ? z.burn : null;
      z.burn = { dps: Math.max(def.damage, lit?.dps ?? 0), stacks: Math.min(burn.stacks, (lit?.stacks ?? 0) + 1), until: w.now + burn.ms, owner: v.owner };
    }
  }
}

/** What burns, burns: each zombie alight takes its burn's bite a tick, its kill the vent's. */
export function tickBurns(w: World, dtMs: number) {
  for (const z of [...w.zombies]) {
    const b = z.burn;
    if (!b) continue;
    if (b.until <= w.now) { delete z.burn; continue; }
    damageZombie(w, z, (b.dps * burnMul(b.stacks) * dtMs) / 1000, w.players.get(b.owner) ?? null, 'vent');
  }
}
