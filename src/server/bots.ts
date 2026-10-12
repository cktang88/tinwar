import { ARMOR_IDS, COLOR_IDS, GUNS, isPerkId, pickOptions, WEAPON_IDS, type BuildingKind, type GunId, type PerkId, type PickOption, type WeaponId } from '../shared/defs.ts';
import type { InputState, Loadout, Snapshot } from '../shared/protocol.ts';
import { hash32, seeded } from '../shared/cosmetics.ts';
import type { BotArena } from './bot/arena.ts';
import { freshAwareness, perceive, type Awareness } from './bot/awareness.ts';
import { fearNow, skillFor, skillKnobs, skillOf, stressOf, TICK_MS as BOT_TICK_MS, type Skill } from './bot/aim.ts';
import { bandFor, GUN_BAND, nextIntent, PERSONALITIES, PERSONALITY_IDS, roleFor, skilledPersona, startIntent, type Intent, type IntentCtx, type PersonalityId } from './bot/intent.ts';
import { act, freshMotor, type Motor } from './bot/motor.ts';
import { royaleThink } from './bot/royale.ts';
import { supplyFor } from './bot/supplies.ts';
import { isOpen } from './bot/nav.ts';
import { readTactics, type Tactics } from './bot/tactics.ts';
import { DEAD_ZONE, siegeThink, type SiegeMemory } from './bot/siege.ts';
import { spareTruce, type SocialMem } from './bot/social.ts';

export type BotMemory = {
  persona: PersonalityId;
  /** How good a player it is (`BOT_SKILL` in bot/aim.ts): drawn once for its name in its room and kept across its lives. Absent, a veteran. */
  skill?: Skill;
  intent: Intent | null;
  awareness: Awareness;
  motor: Motor;
  /** When it last thought and last planned, and what it saw then, for the think cadence (see tick.ts). */
  beat?: Beat;
  /** How it last saw each enemy, and where it pre-aims (see tactics.ts); fresh each life. */
  tactics?: Tactics;
  /** The zombies a squad bot has lately had in sight (see siege.ts). */
  siege?: SiegeMemory;
  /**
   * Benches only: `always` keeps a bot on the squad's build plan with humans in the squad, as a human who builds sensibly would be;
   * `never` has it spend nothing at all (no building, upgrading, mending or reloading), as a human who never builds. Unset, it follows the squad's rule.
   */
  siegeBuild?: 'always' | 'never';
  /**
   * Who it is between lives: the colour and armor it picked when it joined, kept for its whole stay, and the gun it usually comes back with
   * (see `nextLoadout`). Absent (a bench's or a test's bot), it keeps whatever it last spawned with.
   */
  loadout?: Loadout;
  /** Lives in a row it has ended without a kill: a run of them makes it likelier to try another gun. */
  dry?: number;
  /** Server time a fresh spawn's settle ends: until then it only looks round, as a person getting their bearings does (see `SPAWN_SETTLE`). */
  settleUntil?: number;
  /** Which way it faced as it spawned: its settle looks round from there. */
  settleFacing?: number;
  /** The open pick it is mulling over, and the server time it takes it (see `pickDelayMs`). */
  pickWait?: { level: number; at: number };
  /** What it says and does for no reason, and whom it holds fire on (see bot/social.ts); only rooms run that layer. */
  social?: SocialMem;
};

/**
 * `seen` is how many enemies stood in its view box when it last thought, `inSight` which of them it had a line on, `zones` who held each
 * zone, `view` the view radius it saw by (its box follows its aim every tick, `botSight`).
 */
export type Beat = { thought: number; planned: number; seen: number; zones: string; view: number; inSight?: readonly number[] };

/** Whether this think re-plans (see `nextIntent`), and when the bot last did. */
export type ThinkTier = { strategic?: boolean; lastPlan?: number };

export type BotDecision = { input: InputState; pick: { level: number; option: PickOption } | null; mem: BotMemory; build?: { kind: BuildingKind; cx: number; cy: number; lv?: number }; upgrade?: { cx: number; cy: number } };

const IDLE_BOT_INPUT: InputState = { up: false, down: false, left: false, right: false, angle: 0, fire: false, shots: 0, reload: false, ability: false, aimDist: 0, use: false };

const pick = <T>(xs: readonly T[], rand: () => number): T => xs[Math.floor(rand() * xs.length)];

/**
 * Bots read minimap marks only as leads and do not sprint much, so Recon, Ninja and Tracker are rarer picks; fights reward Bloodlust, Second Wind and
 * Fast Hands. A bot never holds still long enough for a Ghillie suit.
 */
const PERK_WEIGHT: Partial<Record<PerkId, number>> = {
  ghillie: 0, quickReload: 1.5, choke: 2,
  recon: 0.4, ninja: 0.4, tracker: 0.4, marathon: 0.6, demolitions: 0.7, brace: 0.8, steadyHands: 0.4, bloodlust: 1.5, secondWind: 1.5, fastHands: 1.5, adrenaline: 1.2,
};
const CLASS_PERK_WEIGHT: Partial<Record<WeaponId, Partial<Record<PerkId, number>>>> = {
  lmg: { quickReload: 2, steadyHands: 2.5 }, assault: { steadyHands: 2.5 }, smg: { steadyHands: 2 }, shotgun: { brace: 1.6, bloodlust: 2 }, sniper: { recon: 1, steadyHands: 0 },
};

/** Which evolution a bot leans to by its temper: a daredevil takes the rushers, a marksman the long guns, a careful one the guns that hold a mid-range lane. */
export function gunWeight(option: GunId, persona: PersonalityId): number {
  const [, ideal, , rush] = GUN_BAND[option];
  if (persona === 'aggressive') return rush ? 2 : 1;
  if (persona === 'marksman') return ideal >= 450 ? 2 : 1;
  return ideal >= 300 && !rush ? 1.5 : 1;
}

function choosePickOption(options: readonly PickOption[], gun: GunId, persona: PersonalityId, rand: () => number): PickOption {
  const weight = (o: PickOption) => (isPerkId(o) ? CLASS_PERK_WEIGHT[GUNS[gun].base]?.[o] ?? PERK_WEIGHT[o] ?? 1 : gunWeight(o, persona));
  let roll = rand() * options.reduce((sum, o) => sum + weight(o), 0);
  return options.find((o) => (roll -= weight(o)) < 0) ?? pick(options, rand);
}

/**
 * A fresh bot's memory: its temper drawn from `rand`, and its skill hashed from its name and the room's seed (`skillFor`: the same name in
 * the same room is the same player each time it joins), or given (`skill`), or else drawn from `rand` after its temper.
 */
export function newBotMemory(rand: () => number, who: { name: string; seed: number } | { skill: Skill } | null = null, loadout?: Loadout): BotMemory {
  const persona = pick(PERSONALITY_IDS, rand);
  const skill = who === null ? skillOf(rand()) : 'skill' in who ? who.skill : skillFor(who.name, who.seed);
  return { persona, skill, intent: null, awareness: freshAwareness(), motor: freshMotor(), ...(loadout && { loadout }) };
}

/** A bot staying on for another match keeps who it is (temper, skill, loadout) but nothing of the last match's fight: a fresh brain. */
export const forgetMatch = (mem: BotMemory): BotMemory => {
  const { beat: _b, tactics: _t, siege: _s, settleUntil: _u, settleFacing: _f, pickWait: _p, ...rest } = mem;
  return { ...rest, intent: null, awareness: freshAwareness(), motor: { ...freshMotor(), shots: mem.motor.shots } };
};

/** A small stream hashed from `key`, for a bot's per-life whims: it leaves the world's random stream (and so every other bot) alone. */
export const whim = (key: string): (() => number) => seeded(hash32(key));

/** A standard normal draw from two uniforms (Box-Muller). */
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());

/**
 * How long past the moment it may respawn a bot takes to click back in: people read the recap, change their mind, glance at their phone.
 * A lognormal with a median of `medianMs` and a tail to about `tailMs`, and now and then (`afkShare`) an AFK of `afk` ms.
 */
export const RESPAWN_DELAY = { medianMs: 1800, logSd: 0.6, capMs: 9000, afkShare: 0.025, afk: [15_000, 25_000] as const };

/** The delay for the life that ended with the respawn clock at `respawnAt` (a server time), the same every time for the same bot and death. */
export function respawnDelayMs(name: string, respawnAt: number): number {
  const r = whim(`respawn:${name}:${respawnAt}`);
  if (r() < RESPAWN_DELAY.afkShare) return RESPAWN_DELAY.afk[0] + r() * (RESPAWN_DELAY.afk[1] - RESPAWN_DELAY.afk[0]);
  return Math.min(RESPAWN_DELAY.capMs, RESPAWN_DELAY.medianMs * Math.exp(RESPAWN_DELAY.logSd * gauss(r)));
}

/** A fresh spawn's settle: a moment of only looking round before the first key is pressed. A hit or a round at it ends it at once. */
export const SPAWN_SETTLE = { minMs: 300, maxMs: 1200 };
export const spawnSettleMs = (name: string, at: number): number => SPAWN_SETTLE.minMs + whim(`settle:${name}:${at}`)() * (SPAWN_SETTLE.maxMs - SPAWN_SETTLE.minMs);

/** How often a bot comes back with another gun: now and then, more after a run of lives without a kill. */
export const GUN_SWITCH = { base: 0.15, perDry: 0.1, max: 0.55 };

/**
 * What a bot comes back with: its own colour and armor every life, and usually the gun it had. `dry` counts lives in a row without a kill,
 * this one included; past the first, each makes another gun likelier.
 */
export function nextLoadout(kept: Loadout, dry: number, name: string, at: number): Loadout {
  const r = whim(`loadout:${name}:${at}`);
  const odds = Math.min(GUN_SWITCH.max, GUN_SWITCH.base + GUN_SWITCH.perDry * Math.max(0, dry - 1));
  if (r() >= odds) return kept;
  const others = WEAPON_IDS.filter((w) => w !== kept.weapon);
  return { ...kept, weapon: others[Math.floor(r() * others.length)]! };
}

/**
 * How long a bot mulls over a pick that has just opened: a person finishes the moment they are in, or glances at the menu between fights,
 * so 1 to 8 s, short ones commoner. In a fight it waits longer still (`PICK_DELAY.engagedMs` more).
 */
export const PICK_DELAY = { minMs: 1000, maxMs: 8000, engagedMs: 4000 };
export const pickDelayMs = (name: string, level: number, at: number): number => {
  const r = whim(`pick:${name}:${level}:${at}`)();
  return PICK_DELAY.minMs + r * r * (PICK_DELAY.maxMs - PICK_DELAY.minMs);
};

export function randomLoadout(rand: () => number): Loadout {
  return { weapon: pick(WEAPON_IDS, rand), armor: pick(ARMOR_IDS, rand), color: pick(COLOR_IDS, rand) };
}

export function botThink(snap: Snapshot, arena: BotArena, mem: BotMemory, rand: () => number, tier: ThinkTier = {}): BotDecision {
  const me = snap.players.find((p) => p.id === snap.self.id);
  if (me?.downed && snap.run) {
    const core = snap.run.core;
    const input = { ...IDLE_BOT_INPUT, shots: mem.motor.shots, up: core.y < me.y - DEAD_ZONE, down: core.y > me.y + DEAD_ZONE, left: core.x < me.x - DEAD_ZONE, right: core.x > me.x + DEAD_ZONE };
    return { input, pick: null, mem };
  }
  if (!me || !me.alive) {
    const forgotten = mem.intent ? { ...mem, intent: null, awareness: freshAwareness(), motor: { ...freshMotor(), shots: mem.motor.shots } } : mem;
    return { input: { ...IDLE_BOT_INPUT, shots: mem.motor.shots }, pick: null, mem: forgotten };
  }
  const pending = snap.self.pending;
  const choice = pending ? { level: pending.level, option: choosePickOption(pickOptions(pending, me.gun), me.gun, mem.persona, rand) } : null;
  if (snap.run) return { ...siegeThink(snap, snap.run, me, arena, mem, rand), pick: choice };
  if (snap.royale) return { ...royaleThink(snap, snap.royale, me, arena, mem, rand), pick: choice };

  const perceived = perceive(snap, arena, me, mem.awareness);
  const { awareness } = perceived;
  // What it read off each enemy it saw, whom it shoots first, and where it pre-aims (see tactics.ts); a fresh life starts a fresh read.
  const { view, tactics } = readTactics(mem.intent ? mem.tactics ?? null : null, spareTruce(mem, perceived.view), awareness);
  const skill = skillKnobs(mem.skill);
  // Its fear right now (a rookie's grows under pressure; a veteran has none): see `FEAR`.
  const fear = fearNow(skill, stressOf(snap.self.suppression, (snap.tick - awareness.hitTick) * BOT_TICK_MS, view.hpFrac));
  const persona = skilledPersona(PERSONALITIES[mem.persona], skill, fear);
  const ctx: IntentCtx = { tick: snap.tick, persona, role: roleFor(me.id, me.team), band: bandFor(view.me.gun, persona), arena, rand, ...tier, supply: supplyFor(snap, me, (p) => isOpen(arena.nav, p)), tac: tactics, skill, ...(fear > 0 && { fear }) };
  const intent = nextIntent(mem.intent ?? startIntent({ k: 'patrol', goal: me }, ctx), view, ctx);
  const { input, motor } = act(intent, view, ctx, mem.motor, snap);
  return { input, pick: choice, mem: { ...mem, intent, awareness, motor, tactics } };
}

export type TeamCounts = { red: number; blue: number };

/**
 * How many bots each team gets so the room holds at least `minPlayers` and both sides are equally strong, a human counting as `botsPerHuman` bots.
 * A team left without its humans gets extra bots rather than playing short against the other side's humans, up to `maxBots` in all.
 */
export function botSeats(humans: TeamCounts, minPlayers: number, botsPerHuman: number, maxBots: number): TeamCounts {
  const gap = (humans.red - humans.blue) * botsPerHuman;
  const total = Math.min(maxBots, Math.max(minPlayers - humans.red - humans.blue, Math.round(Math.abs(gap))));
  const imbalance = (red: number) => Math.abs(humans.red * botsPerHuman + red - humans.blue * botsPerHuman - (total - red));
  const red = Math.max(0, Math.min(total, Math.floor((total - gap) / 2)));
  const best = red + 1 <= total && imbalance(red + 1) < imbalance(red) ? red + 1 : red;
  return { red: best, blue: total - best };
}

/** Bots go by everyday gamertags, so a room reads like a lobby of real players. */
export const BOT_NAMES: readonly string[] = [
  'mariah_27', 'TheoPlays', 'robby500', 'KayOnXbox', 'HassanK9', 'livin4games', 'BigAl1978', 'sandybeach88',
  'Jules_404', 'FrancoPlays', 'nickatnite22', 'MindyMoo', 'rajplaysgames', 'benji2k', 'ItsMeTori', 'DustyController',
  'cameron_17', 'lizzieQ', 'MoRunsMid', 'JakeFromIT', 'paulieB', 'KeishaPlays', 'ArcticMikey', 'Nando_6',
  'amberwaves', 'GabiOnTheGo', 'trevorD93', 'yusuf_13', 'JessPlaysLate', 'chuckwagon7', 'DeejayRico', 'MarnieMae',
  'leodotexe', 'tonybologna', 'kimchiKris', 'birdwatcher84', 'Maxine_5', 'MikeLikesTacos', 'danielpdx',
  'shortstack42', 'ChrisWithThePlan', 'wendyw', 'OmarWasTaken', 'RonnieRae', 'JaeTheGreat', 'dani_plays',
  'HeatherB33', 'chillinwithphil', 'BigMoe77', 'SofiaSaysHi', 'nicknackpaddy', 'justincredible', 'ElizaBee9',
  'jojo_lefty', 'larsen_21', 'VeeDubJay', 'HannahBanana', 'FrankieFourEyes', 'malikonline', 'StevieNicksFan',
  'gabe_plays', 'PriyankaP', 'Scotty2Hotty', 'BonnieOnBreak', 'JordanWasHere', 'DonnyD35', 'Akiro88', 'HayleyK',
  'papabear101', 'LozzaB', 'CharliPlays', 'mrbiggles', 'ErinGoBragh', 'RudyRuiz', 'debs_17', 'SamwiseNot',
  'lilacsky9', 'JamalFromWork', 'dougieFresh', 'MsBeccaB', 'MannyTheMan', 'KaylaKay', 'marcoPolo88', 'audrey_3',
  'TimFromOhio', 'vinnyb', 'zainplays', 'kelleyokeefe', 'PattyCakes7', 'ReeceTheBeast', 'justmaddie', 'ZedIsDead',
  'harperjune', 'DevWithTheMoves', 'MaureenM', 'rayray_22', 'RandySavageish', 'ShilohB', 'lancealot', 'abbycadabby',
  'Chuy_64', 'ItsProbablyDan', 'monicagellerish', 'JonoPlays', 'OldSchoolKev', 'NiaNiaNia', 'ShaneTrain9',
  'boba_fettish', 'YukiOnXbox', 'TrentB', 'frankthetank', 'MaddogMaddie', 'drewdrew', 'TheRealTerry', 'AnaBanana',
  'TimoTime', 'wildbill83', 'RachelFromHR', 'BigPermEnergy', 'SaltyGary', 'matthewcooks', 'jessicah_8',
  'ZekeTheGeek', 'LouieLouie', 'CarlaConQueso', 'AaronAtHome', 'pinksocks', 'DarnellDidIt', 'noahisland', 'bethanyK',
  'jaybird_6', 'CassieCakes', 'MohanPlays', 'RoxyRocks', 'jimmyjam21', 'CelesteOnMic', 'AlFromAccounting',
  'Bradster', 'lucasM45', 'ImNotYourDad', 'TaraTastic', 'GhostedByWifi', 'NikoWithThePlan', 'lil_miss_mayhem',
  'frankie2phones', 'CurtisB', 'SkaterJay', 'MitskiFan99', 'DevonDoesStuff', 'SantiPlays', 'janetjacksonfan',
  'Theo_77', 'ShrekIsLove', 'AdilKhanish', 'tori_rocks', 'CoachMiller', 'maxxpower', 'WandaAtLarge', 'RenPlaysCoop',
  'thatsmydog', 'ClaudiaC', 'PeanutButterDan', 'karlwithak', 'amirthegamer', 'nancyb_12', 'BigDaleEnergy',
  'mitchyRich', 'LoloOnXbox', 'EugeneKrabsish', 'JessFromPayroll', 'simbaFan23', 'RobynHood', 'dylan_d',
  'onewheelmike', 'raeofsunshine', 'ArchieBunkerish', 'clarkkentish', 'BenThereDoneThat', 'Kiki_88', 'SoCalManny',
  'mariachiMike', 'DeannaRose', 'TboneSteak', 'HikeAndSeek', 'Finnigan_7', 'poormanspro', 'MegInAccounting',
  'QuentinQ', 'ShabazPlays', 'bertandernie', 'LaurenSaysGG', 'treefrogTom', 'StefanTheMan', 'KrispyKremeKid',
  'Amal_5', 'PapaMoose', 'samwisegamer', 'KariOn', 'MackenzieM', 'olliepop',
];

export function botName(taken: ReadonlySet<string>, rand: () => number): string {
  const free = BOT_NAMES.filter((n) => !taken.has(n));
  if (free.length) return pick(free, rand);
  for (;;) {
    const name = `${pick(BOT_NAMES, rand)} ${Math.floor(rand() * 90) + 10}`;
    if (!taken.has(name)) return name;
  }
}
