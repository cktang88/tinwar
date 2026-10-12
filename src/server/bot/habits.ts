/**
 * What makes one bot play unlike the next, and unlike itself from one minute to the next: its movement style and habits (`Style`, hashed
 * from its name like its skill, so the same name in the same room is the same player), what it remembers between lives (who killed it, how
 * often it has died lately), and its moods (`Mood`: warming up, tilted, bored). Nothing here touches its gun, body or health: a mood only
 * ever makes it aim or react worse, or play looser (test/bot-parity.test.ts).
 */
import type { PlayerView } from '../../shared/protocol.ts';
import type { Skill } from './aim.ts';
import { TICK_MS } from './aim.ts';
import type { Point } from './nav.ts';

type Temper = 'aggressive' | 'cautious' | 'marksman';

/**
 * A bot's own way of playing, fixed for its stay:
 * - `legMs`: how long a strafe leg runs in a fight (a base from 250 to 1500 ms, with its own spread: a rookie's legs run longer, a veteran's vary more);
 * - `standOdds`, `standMs`: the odds a fight leg is a pause instead, and how long (a rookie stands more); `stepMul` scales its temper's odds of a
 *   planted sidestep;
 * - `jitter`: how far a leg's angle wanders from the 45/90/135-degree marks, rad; `lean`: its pull toward closing in (+) or backing off (-) on a side-on leg;
 * - `sprint`: the share of the time it bothers to sprint when it could;
 * - `reloadAt`: the share of its magazine below which it reloads with nobody about (0.3 to 0.95); `forget`: the odds a magazine goes unreloaded
 *   until it runs dry (a rookie's habit);
 * - `farm`: how keen it is to shoot crates for score with nobody about (some never, some always); `farmDelayMs`: how long it looks at one first;
 * - `idle`: the odds it stops a while on getting where it wandered to; `goof`: how readily it fools about (a stray burst, a wander);
 * - `greed`: the odds it goes for a pack in some danger; `tunnel`: the odds it fixes on one man past the point of breaking off; `revenge`: the
 *   odds it goes after whoever killed it; `pull`: how readily gunfire draws it;
 * - `miss`: the odds, a think, that it overlooks an enemy at the edge of its screen while busy (fighting another, reloading);
 * - `warmMs`, `tiltAt`, `boredMs`: when its moods set in (see `moodOf`).
 */
export type Style = {
  legMs: readonly [number, number]; standOdds: number; standMs: readonly [number, number]; stepMul: number; jitter: number; lean: number;
  sprint: number; reloadAt: number; forget: number; farm: number; farmDelayMs: number; idle: number; goof: number;
  greed: number; tunnel: number; revenge: number; pull: number; miss: number; warmMs: number; tiltAt: number; boredMs: number;
  /** 0 for a rookie to 1 for a veteran: how steady its habits and moods are. */
  steady: number;
};

/** A number in [0, 1) for this name and salt, the same every time (the hash `skillFor` uses). */
export function hashed(name: string, salt: number): number {
  let h = (salt * 0x9e3779b1 ^ 0x85ebca6b) >>> 0;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 0x01000193) >>> 0;
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; h ^= h >>> 16;
  return (h >>> 0) / 2 ** 32;
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
/** No strafe leg runs shorter than this, whatever its style: a leg of a few ticks is keys flickering, not a strafe (test/bots.test.ts). */
const LEG_FLOOR_MS = 450;
const DEG = Math.PI / 180;

/** How steady a skill plays (0 a rookie, 1 a veteran), off its value's place in the bands (see `BOT_SKILL`). */
const steadiness = (skill: Skill | undefined) => (!skill ? 1 : skill.value < 0.25 ? 0 : skill.value >= 0.75 ? 1 : (skill.value - 0.25) / 0.5);

/** This bot's style (see `Style`), hashed from its name and skill: no draw from the room's random stream. */
export function styleFor(name: string, skill: Skill | undefined, temper: Temper): Style {
  const u = (i: number) => hashed(name, i * 7919 + Math.floor((skill?.value ?? 1) * 1e6));
  const sk = steadiness(skill);
  // Strafe legs: a base spread log-evenly over 250 to 1500 ms; a rookie's run longer, a veteran's vary more about its base.
  const base = Math.min(1500, 250 * 6 ** u(1) * (1 + 0.3 * (1 - sk)));
  const spread = 0.15 + 0.2 * u(2) + 0.25 * sk;
  const lean = Math.max(-0.4, Math.min(0.4, (u(6) * 2 - 1) * 0.3 + (temper === 'aggressive' ? 0.1 : temper === 'cautious' ? -0.1 : -0.05)));
  const f = u(9);
  return {
    legMs: [Math.max(LEG_FLOOR_MS, base * (1 - spread)), Math.max(LEG_FLOOR_MS * 1.2, base * (1 + spread))],
    standOdds: u(3) * (0.015 + 0.05 * (1 - sk)),
    standMs: [400, 450 + 200 * (1 - sk)],
    stepMul: lerp(0.6, 1.3, u(4)) * (0.8 + 0.2 * sk),
    jitter: (3 + 5 * u(5) + 4 * sk) * DEG,
    lean,
    sprint: 0.55 + 0.45 * u(7),
    reloadAt: 0.3 + 0.65 * u(8),
    forget: lerp(0.25, 0.03, sk) * (0.5 + u(10)),
    farm: f < 0.2 ? 0 : f >= 0.8 ? 1 : (f - 0.2) / 0.6,
    farmDelayMs: 300 + 1200 * u(11),
    idle: 0.1 + 0.75 * u(12) + 0.1 * (1 - sk),
    goof: 0.3 + 0.7 * u(13),
    greed: (temper === 'aggressive' ? 0.5 : temper === 'cautious' ? 0.15 : 0.25) * (0.5 + u(14)),
    tunnel: (temper === 'aggressive' ? 0.25 : temper === 'cautious' ? 0.08 : 0.12) * (0.6 + 0.8 * u(15)),
    revenge: 0.2 + 0.4 * u(16) + (temper === 'aggressive' ? 0.2 : 0),
    pull: temper === 'aggressive' ? 1.15 : temper === 'cautious' ? 0.8 : 0.9,
    miss: 0.3 + 0.3 * (1 - sk),
    warmMs: 30_000 + 30_000 * u(17),
    tiltAt: u(18) < 0.5 ? 2 : 3,
    boredMs: (5 + 5 * u(19)) * 60_000,
    steady: sk,
  };
}

/**
 * What a bot carries between its lives in a room: its style, when it came in, when it has lately died quickly (a life under `QUICK_LIFE_MS`),
 * who last hurt it (and where he was), and the one it means to pay back (`nemesis`, for a while after he killed it). `alive` is the last tick
 * it thought alive (its death, roughly), `life` the first of this life.
 */
export type Habits = {
  style: Style; born: number; deaths: readonly number[]; alive: number | null; life: number;
  hurt: { by: number; tick: number; at: Point } | null;
  nemesis: { id: number; at: Point; until: number; seek: boolean } | null;
};

/** A death counts toward tilt this long, and its tilt fades with this time constant. */
const TILT_WINDOW_MS = 60_000;
const TILT_TAU_MS = 45_000;
/** A hit this long before it died names its killer; it bears him a grudge this long. */
const KILLER_MS = 3000;
const GRUDGE_MS: readonly [number, number] = [25_000, 45_000];
/** A life this short is a quick death, the kind that tilts a player when they come in a row. */
const QUICK_LIFE_MS = 20_000;

/**
 * Its habits after this think: made on its first (its style from its name), a fresh life read for the one before (a death, maybe a
 * nemesis), who hurt it lately, and a grudge settled by a kill. `kills` are the ids it killed since it last thought.
 */
export function liveHabits(prev: Habits | undefined, name: string, skill: Skill | undefined, temper: Temper, tick: number, me: Point, freshLife: boolean,
  hitBy: { owner: number; tick: number } | null | undefined, seen: (id: number) => Point | null, kills: readonly number[]): Habits {
  let h: Habits = prev ?? { style: styleFor(name, skill, temper), born: tick, deaths: [], alive: null, life: tick, hurt: null, nemesis: null };
  if (freshLife && h.alive !== null) {
    // It died at about the last tick it thought alive: whoever hurt it just before is its killer.
    const died = h.alive;
    const quick = (died - h.life) * TICK_MS < QUICK_LIFE_MS;
    const deaths = [...h.deaths.filter((t) => (died - t) * TICK_MS < TILT_WINDOW_MS * 2), ...(quick ? [died] : [])];
    const killer = h.hurt && (died - h.hurt.tick) * TICK_MS <= KILLER_MS ? h.hurt : null;
    const grudge = GRUDGE_MS[0] + (GRUDGE_MS[1] - GRUDGE_MS[0]) * hashed(name, died);
    const nemesis = killer ? { id: killer.by, at: killer.at, until: tick + Math.round(grudge / TICK_MS), seek: hashed(name, died + 1) < h.style.revenge + 0.3 * tiltOf(h.style, deaths, tick) } : h.nemesis;
    h = { ...h, deaths, hurt: null, nemesis, life: tick };
  }
  if (hitBy && hitBy.tick === tick && hitBy.owner !== undefined) h = { ...h, hurt: { by: hitBy.owner, tick, at: seen(hitBy.owner) ?? { x: me.x, y: me.y } } };
  const settled = h.nemesis && (kills.includes(h.nemesis.id) || tick > h.nemesis.until);
  return { ...h, alive: tick, ...(settled && { nemesis: null }) };
}

/** Tilt, 0 to 1: `tiltAt` quick deaths inside the window, fading from the last of them; a veteran's is half. */
function tiltOf(s: Style, deaths: readonly number[], tick: number): number {
  const last = deaths[deaths.length - 1];
  if (last === undefined) return 0;
  const recent = deaths.filter((t) => (last - t) * TICK_MS <= TILT_WINDOW_MS).length;
  if (recent < s.tiltAt) return 0;
  return Math.exp(-((tick - last) * TICK_MS) / TILT_TAU_MS) * (1 - 0.5 * s.steady);
}

/**
 * Its mood now: `aimMul` and `reactMul` (never under 1) on its aim error and reaction, `tilt` (more reckless, fixes on one man) and `boredom`
 * (idles and fools about more), each 0 to 1. Warming up, the first `warmMs` of its stay, it aims and reacts about 15% worse, easing off over the
 * last third; tilted, a little worse again. A veteran is half as moved by any of it.
 */
export type Mood = { aimMul: number; reactMul: number; tilt: number; boredom: number };
export function moodOf(h: Habits, tick: number): Mood {
  const s = h.style, damp = 1 - 0.5 * s.steady;
  const stay = (tick - h.born) * TICK_MS;
  const warm = stay >= s.warmMs ? 0 : Math.min(1, (s.warmMs - stay) / (s.warmMs / 3)) * damp;
  const tilt = tiltOf(s, h.deaths, tick);
  const boredom = stay <= s.boredMs ? 0 : Math.min(1, (stay - s.boredMs) / 300_000) * damp;
  return { aimMul: 1 + 0.15 * warm + 0.1 * tilt, reactMul: 1 + 0.15 * warm + 0.05 * tilt, tilt, boredom };
}

/** What the intent and motor read of a bot's habits on a think. */
export type HabitCtx = {
  style: Style; mood: Mood; nemesis: Habits['nemesis'];
  /** Busy with something of its own (shooting crates, holding a spot): it lets more gunfire go. */
  busy: boolean;
  /** This magazine it forgets to reload (its style's `forget`, one decision a magazine): it fights on until it runs dry. */
  forgets: boolean;
  /** Its stay so far, ms. */
  stayMs: number;
};

/** Its habits as a think reads them; `mags` counts the magazines it has fired (its rounds over its magazine), for `forgets`. */
export function habitCtx(h: Habits, name: string, tick: number, busy: boolean, mags: number): HabitCtx {
  return { style: h.style, mood: moodOf(h, tick), nemesis: h.nemesis, busy, forgets: hashed(name, 50_000 + mags) < h.style.forget, stayMs: (tick - h.born) * TICK_MS };
}

/** The enemy it most wants among those it sees: its nemesis, if he is in sight. */
export const nemesisIn = (c: HabitCtx | undefined, threats: readonly { p: PlayerView }[]): number | null =>
  c?.nemesis && threats.some((t) => t.p.id === c.nemesis!.id) ? c.nemesis.id : null;
