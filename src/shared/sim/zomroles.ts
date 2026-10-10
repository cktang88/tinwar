import { HORDE_GUN_MUL, KNOCK, MARK, ZOMBIES, zombieRole, type GunId } from '../defs.ts';
import { addKnock } from './movement.ts';
import type { Bullet, Zombie } from './world.ts';
import { PERK_RULES } from './stats.ts';
import { isTracked } from './zomperks.ts';

/**
 * Zombies only (see `ZombieRole` in defs.ts): how a player's gun treats the horde. Every caller is a path a round, blast or kill against a zombie takes,
 * so nothing here can reach a player or a versus room.
 */

/**
 * What a round of `damage` from `gun` does to `z`: its plate (the share of it the gun's role leaves on, none for an armor-piercing round), then, for a player's
 * gun, `HORDE_GUN_MUL` and the role's multiplier for the kind. A turret's round (no gun) loses only the plate.
 */
export function roundOnZombie(z: Zombie, gun: GunId | null, damage: number, piercing: boolean, now = 0): number {
  const role = gun ? zombieRole(gun) : null;
  const plate = piercing ? 0 : ZOMBIES[z.kind].plate * (role?.plate ?? 1);
  return Math.max(1, damage - plate) * (role ? HORDE_GUN_MUL * (role.vs[z.kind] ?? 1) * markMul(z, now) : 1);
}

/** Whether a tesla coil's mark is on `z` now. */
export const isMarked = (z: Zombie, now: number): boolean => (z.mark ?? 0) > now;
/** What a player's gun does more to a zombie a tesla coil (`MARK`), a Tracker or a radar sensor (`PERK_RULES.tracker`) has marked. */
const markMul = (z: Zombie, now: number) => (isMarked(z, now) ? MARK.gunMul : 1) * (isTracked(z, now) ? PERK_RULES.tracker.zombieMul : 1);

/** What a blast of `damage` from `gun` does to `z`: `HORDE_GUN_MUL`, the role's blast multiplier, and the share of it plating lets through. */
export function blastOnZombie(z: Zombie, gun: GunId | null, damage: number, now = 0): number {
  if (!gun) return damage;
  const role = zombieRole(gun);
  return damage * HORDE_GUN_MUL * role.blast * (ZOMBIES[z.kind].plate > 0 ? role.blastPlated : 1) * markMul(z, now);
}

/**
 * A hit from `gun` holds `z` to its role's share of its pace for a while; a stronger hold, or a longer one as strong, replaces the one it has.
 * What no shove moves (brutes and the Colossus, `KNOCK.zombie`) no hold slows either.
 */
export function holdZombie(z: Zombie, gun: GunId | null, now: number) {
  const slow = gun ? zombieRole(gun).slow : null;
  if (slow) applyHold(z, slow, now);
}

/** Holds `z` to `mul` of its pace for `ms`, unless it already has a stronger hold, or is a kind no shove moves. A `mul` of 0 is a stun. */
export function applyHold(z: Zombie, slow: { mul: number; ms: number }, now: number) {
  if (KNOCK.zombie[z.kind] <= 0) return;
  const cur = z.slow && z.slow.until > now ? z.slow : null;
  if (cur && cur.mul < slow.mul) return;
  z.slow = { mul: slow.mul, until: Math.max(now + slow.ms, cur && cur.mul === slow.mul ? cur.until : 0) };
}

/**
 * A turret round's hit on `z` beyond its damage: a scatter's pellet holds it (`TurretDef.hold`) and shoves it back along the round, harder than any other round.
 * Answers false for a round that only shoves as any round does.
 */
export function turretHit(z: Zombie, hold: Bullet['hold'], now: number, dirX: number, dirY: number): boolean {
  if (!hold) return false;
  applyHold(z, hold, now);
  const weight = KNOCK.zombie[z.kind];
  if (weight > 0 && z.hp > 0) z.knock = addKnock(z.knock, dirX, dirY, hold.shove * weight, hold.shoveCap);
  return true;
}

/** The share of its pace a zombie keeps now: a hold's, or all of it. */
export const paceOf = (z: Zombie, now: number): number => (z.slow && z.slow.until > now ? z.slow.mul : 1);


/** Scales the shove a hit from `gun` gives a zombie. */
export const zombieShove = (gun: GunId | null): number => (gun ? zombieRole(gun).shove : 1);
