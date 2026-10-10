import { effectiveStats, hasPerk, PERK_RULES } from './stats.ts';
import type { Player, World, Zombie } from './world.ts';

/**
 * Zombies only: what the picks built for versus do against the horde instead (`PERK_INFO.zom`, `PERK_RULES`), so none of them is dead weight in a
 * zombies run. Every caller is a path a round, blast, kill or zombie's choice of prey takes, so nothing here reaches a versus room.
 */

/** Whether a Tracker hit or a radar sensor has `z` marked now. */
export const isTracked = (z: Zombie, now: number): boolean => (z.tracked ?? 0) > now;

/** Marks `z` for `ms` (a later mark never shortens one already on it). */
export function trackZombie(z: Zombie, now: number, ms: number) {
  z.tracked = Math.max(z.tracked ?? 0, now + ms);
}

/** What `a`'s own hit of `dealt` on `z` does beyond its damage: Bloodlust heals by a share of it, and Tracker marks the zombie for the squad. */
export function perkOnZombieHit(w: World, a: Player, z: Zombie, dealt: number, via: 'hit' | 'blast') {
  if (a.life.k !== 'alive') return;
  if (hasPerk(a, 'bloodlust')) a.life.hp = Math.min(effectiveStats(a).maxHp, a.life.hp + PERK_RULES.bloodlust.zombieShare * dealt);
  if (via === 'hit' && z.hp > 0 && hasPerk(a, 'tracker')) trackZombie(z, w.now, PERK_RULES.tracker.ms);
}

/** A zombie `a` killed: Adrenaline's rush, and Fast hands' share of a magazine back (not mid-reload). */
export function perkOnZombieKill(w: World, a: Player) {
  if (a.life.k !== 'alive') return;
  if (hasPerk(a, 'adrenaline')) a.life.rushUntil = w.now + PERK_RULES.adrenaline.ms;
  if (hasPerk(a, 'fastHands')) topUp(a, PERK_RULES.fastHands.zombieShare);
}

/** Puts `share` of `p`'s magazine back, unless they are mid-reload (a reload fills it anyway). */
export function topUp(p: Player, share: number) {
  if (p.life.k !== 'alive' || p.life.reloadUntil !== null) return;
  const mag = effectiveStats(p).mag;
  p.life.ammo = Math.min(mag, p.life.ammo + Math.max(1, Math.round(share * mag)));
}

/** The Silencer's edge on a zombie: its holder's rounds deal more to one that is not chasing them (after the core, a wall or someone else). */
export function sneakMul(z: Zombie, owner: Player | null): number {
  if (!owner || !hasPerk(owner, 'silencer')) return 1;
  return z.ai?.tgt === 'player' && z.ai.pid === owner.id ? 1 : PERK_RULES.silencer.unawareMul;
}

/** How hard `by`'s rounds and blasts shove a zombie, as a multiplier (Brace). */
export const braceShoveMul = (by: Player | null): number => (by && hasPerk(by, 'brace') ? PERK_RULES.brace.zombieShove : 1);

/** How far a zombie whose pull usually reaches `range` notices `p` (Ninja). */
export const noticeRange = (p: Player, range: number): number => (hasPerk(p, 'ninja') ? range * PERK_RULES.ninja.zombieNoticeMul : range);

/** Whether `p` stands hidden from a zombie `d` px off: a Ghillie suit, still long enough, and the zombie not close enough to bump into them. */
export function hiddenFromZombie(w: World, p: Player, d: number): boolean {
  if (p.life.k !== 'alive' || d <= PERK_RULES.ghillie.zombieFindPx || !effectiveStats(p).ghillie) return false;
  return w.now - p.life.lastMoveAt >= PERK_RULES.ghillie.stillMs;
}
