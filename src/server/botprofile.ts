import { badgeKey, CAREER, CAREER_IDS, KM_PX, MEDAL_IDS, WEAPON_IDS, type Badge, type MedalId, type WeaponId, type ZomStat } from '../shared/defs.ts';
import { NAME_MAX } from '../shared/protocol.ts';
import { botLevel, botPicks, hash32, seeded, xpForLevel, xpToLevel } from '../shared/cosmetics.ts';
import { BOT_NAMES } from './bots.ts';
import { featuredBadge, freshProfile, trackCount, type Profile } from './profiles.ts';
import { grantUnlocks } from './progression.ts';

/**
 * A bot's service record. Bots keep no profile, but a lobby should read as people, and a person's name links to their record from the
 * death recap and the board: so a bot's name gets a stub, made up the same way every time from its name alone. Its level is the one on
 * its name plate (`botLevel`); its matches follow from the XP that level takes, and its kills, deaths, streak, distance, medals and
 * lifetime medals from those matches at a casual player's rates, each with a lean of its own.
 */

/** Every name a room can seat a bot under, lower case: the roster, its `name NN` overflow, and the numbered copies `uniqueName` makes. */
let botNames: Set<string> | null = null;
export function isBotName(name: string): boolean {
  if (!botNames) {
    botNames = new Set();
    for (const base of BOT_NAMES) {
      const add = (n: string) => botNames!.add(n.toLowerCase());
      add(base);
      for (let i = 10; i < 100; i++) add(`${base} ${i}`);
      for (let i = 2; i < 100; i++) add(base.slice(0, NAME_MAX - String(i).length) + i);
    }
  }
  return botNames.has(name.toLowerCase());
}

/** Rates per match, at the middle of a bot's lean: a casual player's medal haul. */
const MEDAL_RATE: Partial<Record<MedalId, number>> = {
  firstBlood: 0.06, doubleKill: 0.7, tripleKill: 0.09, quadKill: 0.015, massacre: 0.004, longShot: 0.35, pointBlank: 0.4, clutch: 0.12, closeCall: 0.35,
  revenge: 0.5, shutdown: 0.12, bounty: 0.05, onFire: 0.3, rampage: 0.08, unstoppable: 0.015, untouchable: 0.004, legendary: 0.0004, ghost: 0.06,
};
const OTHER_MEDAL_RATE = 0.04;
const DAY_MS = 86_400_000;

/** The stub record for bot `name`, as of `now` (only its first and last seen, and when it earned each lifetime medal, move with `now`). */
export function botProfile(name: string, now = Date.now()): Profile {
  const r = seeded(hash32(`profile:${name.toLowerCase()}`));
  const between = (a: number, b: number) => a + r() * (b - a);
  const level = botLevel(name);
  const xp = xpForLevel(level) + Math.floor(r() * xpToLevel(level));
  const games = Math.max(3, Math.round(xp / between(300, 520)));
  const kills = Math.round(games * between(3, 8));
  const deaths = Math.max(1, Math.round(kills / between(0.6, 1.35)));
  const p = freshProfile(name, now);
  Object.assign(p, { xp, level, kills, deaths, games, bestStreak: Math.min(kills, Math.round(between(4, 9) + Math.log2(games) * between(0, 1.6))), distance: Math.round(games * between(1.1, 2.6) * KM_PX) });
  // Kills by class: a favourite gun takes the lion's share.
  const fav = WEAPON_IDS[Math.floor(r() * WEAPON_IDS.length)]!;
  const weights = WEAPON_IDS.map((w) => (w === fav ? between(2.5, 5) : between(0.1, 1)));
  const sum = weights.reduce((a, b) => a + b, 0);
  p.weaponKills = Object.fromEntries(WEAPON_IDS.map((w, i) => [w, Math.round((kills * weights[i]!) / sum)]).filter(([, n]) => (n as number) > 0)) as Partial<Record<WeaponId, number>>;
  const lean = between(0.6, 1.5);
  for (const m of MEDAL_IDS) {
    const n = Math.round(games * (MEDAL_RATE[m] ?? OTHER_MEDAL_RATE) * lean * between(0.5, 1.5));
    if (n > 0) p.medals[m] = n;
  }
  // About two in five have tried the Zombies squad.
  if (r() < 0.4) {
    const runs = Math.max(1, Math.round(games * between(0.05, 0.2)));
    const zom: Partial<Record<ZomStat, number>> = {
      nights: Math.round(runs * between(2, 5)), bestNight: Math.round(between(2, 7)), kills: Math.round(runs * between(60, 180)), built: Math.round(runs * between(8, 30)),
      rounds: Math.round(runs * between(400, 1200)), revives: Math.round(runs * between(0, 1.5)), repaired: Math.round(runs * between(200, 1500)), maxed: Math.round(runs * between(0, 1)),
    };
    p.zombies = Object.fromEntries(Object.entries(zom).filter(([, n]) => n > 0));
  }
  // Played on and off over some months, last on lately.
  p.lastSeen = now - Math.round(between(0.02, 3) * DAY_MS);
  p.firstSeen = p.lastSeen - Math.round(Math.min(400, games * between(0.4, 1.5)) * DAY_MS);
  for (const track of CAREER_IDS) {
    const have = trackCount(p, track);
    CAREER[track].at.forEach((need, tier) => {
      if (have < need) return;
      // A rung was reached the share of the way through its career that its count is of today's.
      const share = Math.min(1, need / Math.max(1, have));
      p.badges[badgeKey({ track, tier: tier as Badge['tier'] })] = Math.round(p.firstSeen + share * (p.lastSeen - p.firstSeen));
    });
  }
  grantUnlocks(p);
  p.equipped = botPicks(name);
  return p;
}

/** The lifetime medal a bot wears by its name in a match, the rarest on its record, as a person's is. */
export const botBadge = (name: string): Badge | null => featuredBadge(botProfile(name, 0));
