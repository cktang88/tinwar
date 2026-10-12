import { WORLD, type AbilityId } from '../../shared/defs.ts';
import type { PlayerView } from '../../shared/protocol.ts';
import { intercept, MUZZLE_PX } from '../../shared/sim/ballistics.ts';

export { intercept, MUZZLE_PX };
import type { Point } from './nav.ts';

/** `sway`: the idle sway (see `swayAt` in motor.ts) already in `want`, so the next tick's sway replaces it rather than piling on. */
export type AimState = { angle: number; spin: number; want: number; err: number; sway?: number };

/** `leadMul` is how this bot judges this target's lead: 1 leads exactly, below under-leads, drawn once per engagement as a person's read of one target. */
export type Engagement = { id: number; x: number; y: number; vx: number; vy: number; acquiredTick: number; noticeAtTick: number; leadMul: number; at?: number };

export type Hand = { omega: number; zeta: number; maxSpin: number; maxAccel: number };

const DEG = Math.PI / 180;

export const HANDS = {
  flick: { omega: 30, zeta: 0.72, maxSpin: 800 * DEG, maxAccel: 10_000 * DEG },
  calm: { omega: 9, zeta: 0.9, maxSpin: 240 * DEG, maxAccel: 2_500 * DEG },
  /** Caught off-angle by an enemy it has just seen (one come round its cover, or at its back): a quick turn of the head, not yet an aimed flick. */
  startle: { omega: 16, zeta: 0.8, maxSpin: 500 * DEG, maxAccel: 5_000 * DEG },
  /** Looking round with nobody about (a lane from its spot, a sound): an unhurried sweep, never a snap. */
  scan: { omega: 4, zeta: 1, maxSpin: 70 * DEG, maxAccel: 300 * DEG },
} as const satisfies Record<string, Hand>;

const BOT_AIM = {
  noticeMs: [220, 350],
  baseSigma: 0.03,
  sigmaPerRadPerSec: 0.25,
  unsettledMul: 1.5,
  settleMs: 700,
  errTauMs: 400,
  motionTauMs: 30,
  /** A bot leads by the round's real flight to where the target will be, times a judgment drawn per engagement in `mean ± spread`. */
  leadJudgment: { mean: 0.95, spread: 0.15 },
  fireSlackRad: 2.5 * DEG,
  /**
   * Scales every bot's aim error (its drifting error and the landing error when it takes a target in), keeping each persona's and
   * sharpness row's share of it: how steady its hand is, a skill (its gun's spread and bloom are a person's).
   */
  errMul: 0.82,
} as const;

const SUBSTEP_MS = 5;

export const TICK_MS = 1000 / WORLD.tickHz;

/**
 * Bots sharpen against a human who has climbed further, indexed by the human's level; a hunted human gets the last row.
 * A fresh player meets the base aim, so the room is beatable on arrival and fights back as they snowball.
 * Bots fight each other at the base row, so a bot that climbs keeps climbing and the room shows abilities and hunted bots.
 */
export const SHARPNESS: readonly { aimMul: number; reactionMul: number }[] = [
  { aimMul: 1, reactionMul: 1 },
  { aimMul: 0.55, reactionMul: 0.8 },
  { aimMul: 0.4, reactionMul: 0.7 },
  { aimMul: 0.3, reactionMul: 0.6 },
  { aimMul: 0.2, reactionMul: 0.5 },
  { aimMul: 0.15, reactionMul: 0.45 },
];
/**
 * How sharp a bot is against one target: the target's `SHARPNESS` row times the bot's own skill (`skilled`). The optional parts come
 * from skill alone: `errMul` scales its aim error, `turnMul` how quick its hand is on a tracked enemy, `lagMul` how slowly it reads his motion (tracking lag),
 * `lead` its judgment of a crossing enemy's lead. Left out, a veteran's (today's) hand.
 */
export type Sharpness = { aimMul: number; reactionMul: number; errMul?: number; turnMul?: number; lagMul?: number; lead?: { mean: number; spread: number } };
export const sharpnessAgainst = (target: PlayerView) =>
  target.kind === 'bot' ? SHARPNESS[0]! : SHARPNESS[target.hunted ? SHARPNESS.length - 1 : Math.min(target.level, SHARPNESS.length - 1)]!;

/**
 * A bot's skill, drawn once for its name in a room (`skillFor`) and kept across its lives: half rookies, a quarter regulars, a quarter veterans.
 * Skill is the bot's brain only; its gun, body and health are a person's whatever its skill (test/bot-parity.test.ts).
 * `bands` are the share of bots below each tier's top; the skill value is a uniform draw in [0, 1), so its band is its tier and its
 * place in the band its continuous value. Each knob is read off the rows by `skillKnobs`: flat at a rookie's row below the rookie band's
 * middle, a line from there to the regular row at the regular band's middle, a line from there to the veteran row at the veteran band's
 * floor, and flat (today's bot) above it. Every veteran knob is the identity.
 *
 * - `aimMul`: its aim error (the drifting error and the landing error), times its target's `SHARPNESS` row.
 * - `reactMul`: the time to take in an enemy that comes into sight (`noticeMs`).
 * - `turnMul`: how quick its hand is (the tracking flick and the startled turn); `lagMul`: how slowly it reads a target's motion.
 * - `lead`: its judgment of a crossing enemy's lead (mean and spread; 1 is exact), so a rookie under-leads and guesses wider.
 * - `sprayMul`: how much longer it holds a tapping gun's trigger before it lets go; `patienceMul`: how long it waits on its bloom (a rookie taps less).
 * - `readsHeld`: the odds it reads an angle as held (and does not peek it); `oddsShift`: added to its temper's `takesOdds` (lower takes worse fights);
 *   `flankMul`: its temper's odds of going round; `flankRead`: the odds a think notices its cover blown (someone come round it).
 * - `abilityOdds`: the odds a think uses an ability whose moment has come.
 * - `fear`: how scared it is (see `FEAR`), the root of a green player's worst habits: it opens fire from too far, sprays in a panic, keeps
 *   its distance rather than push, and runs from fire rather than reposition. Pressure (rounds cracking past, a hit, low health) raises it.
 */
export type SkillTier = 'rookie' | 'regular' | 'veteran';
export type SkillKnobs = {
  aimMul: number; reactMul: number; turnMul: number; lagMul: number; lead: { mean: number; spread: number };
  sprayMul: number; patienceMul: number; readsHeld: number; oddsShift: number; flankMul: number; flankRead: number; abilityOdds: number; fear: number;
};
export type Skill = { tier: SkillTier; value: number };

export const BOT_SKILL = {
  bands: { rookie: 0.5, regular: 0.75, veteran: 1 },
  rookie: { aimMul: 2.6, reactMul: 1.35, turnMul: 0.7, lagMul: 3, lead: { mean: 0.8, spread: 0.3 }, sprayMul: 1.8, patienceMul: 0.5, readsHeld: 0.35, oddsShift: -0.3, flankMul: 0.4, flankRead: 0.35, abilityOdds: 0.5, fear: 1 },
  regular: { aimMul: 1.35, reactMul: 1.12, turnMul: 0.88, lagMul: 1.6, lead: { mean: 0.9, spread: 0.2 }, sprayMul: 1.3, patienceMul: 0.8, readsHeld: 0.75, oddsShift: -0.1, flankMul: 0.8, flankRead: 0.7, abilityOdds: 0.8, fear: 0.3 },
  veteran: { aimMul: 1, reactMul: 1, turnMul: 1, lagMul: 1, lead: BOT_AIM.leadJudgment, sprayMul: 1, patienceMul: 1, readsHeld: 1, oddsShift: 0, flankMul: 1, flankRead: 1, abilityOdds: 1, fear: 0 },
} as const satisfies { bands: Record<SkillTier, number> } & Record<SkillTier, SkillKnobs>;

export const tierOf = (value: number): SkillTier => (value < BOT_SKILL.bands.rookie ? 'rookie' : value < BOT_SKILL.bands.regular ? 'regular' : 'veteran');
export const skillOf = (value: number): Skill => ({ tier: tierOf(value), value });
/** A veteran: today's bot, every knob the identity. Scripted duels and modes that draw no skill use it. */
export const VETERAN: Skill = { tier: 'veteran', value: 1 };

/** A skill for a bot's name in a room seeded `seed`: hashed, not drawn, so the same name in the same room is the same player each time it joins. */
export function skillFor(name: string, seed: number): Skill {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 0x01000193) >>> 0;
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; h ^= h >>> 16;
  return skillOf((h >>> 0) / 2 ** 32);
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
function mixKnobs(a: SkillKnobs, b: SkillKnobs, k: number): SkillKnobs {
  const out = {} as Record<string, unknown>;
  for (const key of Object.keys(a) as (keyof SkillKnobs)[]) {
    const x = a[key], y = b[key];
    out[key] = typeof x === 'number' ? lerp(x, y as number, k) : { mean: lerp(x.mean, (y as SkillKnobs['lead']).mean, k), spread: lerp(x.spread, (y as SkillKnobs['lead']).spread, k) };
  }
  return out as SkillKnobs;
}

/** The knobs for a skill value (see `BOT_SKILL`). */
export function skillKnobs(skill: Skill = VETERAN): SkillKnobs {
  const { bands } = BOT_SKILL, v = skill.value;
  const rookieMid = bands.rookie / 2, regularMid = (bands.rookie + bands.regular) / 2;
  if (v >= bands.regular) return BOT_SKILL.veteran;
  if (v <= rookieMid) return BOT_SKILL.rookie;
  if (v <= regularMid) return mixKnobs(BOT_SKILL.rookie, BOT_SKILL.regular, (v - rookieMid) / (regularMid - rookieMid));
  return mixKnobs(BOT_SKILL.regular, BOT_SKILL.veteran, (v - regularMid) / (bands.regular - regularMid));
}

/**
 * Fear (`SkillKnobs.fear`) as it plays out. A scared bot's fear right now is its skill's `fear` times a share that grows with pressure
 * (`fearNow`): `calm` of it with nothing on it, all of it pinned, hit or hurt. Then:
 * - `judge`: it misjudges range, opening fire on an enemy out to `1 + judge x fear` times as far as a cool head would (past its gun's
 *   reach, rounds that fall short) and reading its cone as good enough as if he stood that much nearer;
 * - `spray`, `patience`: it holds each tap `1 + spray x fear` times longer and waits `1 - patience x fear` as long on its bloom;
 * - `band`: it settles `1 + band x fear` times as far off as its gun's ideal, head-on and hold distances (its skill's fear, not the
 *   moment's: it keeps its distance, a scared SMG hanging back at mid range; the farthest it lets a fight sit is a cool head's);
 * - `push`: its temper's odds of pushing a man, times `1 - push x fear`;
 * - `panic`: shot at in cover, the odds it runs for it (`panic x fear`) rather than shifting, peeking another way or going round.
 * A veteran's fear is 0, so it plays as it always has.
 */
export const FEAR = { calm: 0.6, judge: 0.6, spray: 0.5, patience: 0.4, band: 0.25, push: 0.5, panic: 0.8 } as const;
/** How much pressure a bot is under, 0 to 1: rounds cracking past (`suppression`), a hit in the last 1.5 s, health under half. */
export function stressOf(suppression: number, hitAgoMs: number, hpFrac: number): number {
  return Math.min(1, 0.6 * Math.min(1, suppression / 0.5) + (hitAgoMs <= 1500 ? 0.5 : 0) + Math.max(0, 0.5 - hpFrac));
}
/** Its fear right now (see `FEAR`): none for a veteran whatever the pressure. */
export const fearNow = (k: SkillKnobs, stress: number): number => (k.fear === 0 ? 0 : k.fear * (FEAR.calm + (1 - FEAR.calm) * Math.max(0, Math.min(1, stress))));

/** The sharpness a bot of skill `k` brings against a target of row `s`; a veteran's is the row itself. */
export function skilled(s: Sharpness, k: SkillKnobs): Sharpness {
  if (k === BOT_SKILL.veteran) return s;
  return { aimMul: s.aimMul, reactionMul: s.reactionMul * k.reactMul, errMul: k.aimMul, turnMul: k.turnMul, lagMul: k.lagMul, lead: k.lead };
}

/** A hand slowed by skill: its spring, top spin and acceleration scaled by `turnMul` (the spring's acceleration by its square). */
export const slowHand = (h: Hand, turnMul = 1): Hand => (turnMul === 1 ? h : { ...h, omega: h.omega * turnMul, maxSpin: h.maxSpin * turnMul, maxAccel: h.maxAccel * turnMul * turnMul });

const gaussian = (rand: () => number) => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
export const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (x: number, lim: number) => Math.max(-lim, Math.min(lim, x));

export const bearingSpin = (rx: number, ry: number, vx: number, vy: number) => (rx * vy - ry * vx) / Math.max(1, rx * rx + ry * ry);

export const freshAim = (angle: number): AimState => ({ angle, spin: 0, want: angle, err: 0 });

export function turn(aim: AimState, want: number, wantSpin: number, hand: Hand, dtMs: number): AimState {
  const n = Math.max(1, Math.ceil(dtMs / SUBSTEP_MS)), h = dtMs / 1000 / n;
  let angle = aim.angle, spin = aim.spin, goal = angle + wrapAngle(want - angle);
  for (let i = 0; i < n; i++) {
    const accel = hand.omega * hand.omega * (goal - angle) + 2 * hand.zeta * hand.omega * (wantSpin - spin);
    spin = clamp(spin + clamp(accel, hand.maxAccel) * h, hand.maxSpin);
    angle += spin * h;
    goal += wantSpin * h;
  }
  return { ...aim, angle: wrapAngle(angle), spin, want: wrapAngle(goal) };
}

export function drift(err: number, sigma: number, dtMs: number, rand: () => number): number {
  const keep = Math.exp(-dtMs / BOT_AIM.errTauMs);
  return err * keep + sigma * Math.sqrt(1 - keep * keep) * gaussian(rand);
}

export function handFor(sharpness: Sharpness): Hand {
  // The flick's spring follows the target's row (a sharper row, a quicker hand); skill then slows it (`turnMul`).
  const f = Math.min(2.5, 1 / Math.sqrt(sharpness.aimMul));
  return slowHand({ ...HANDS.flick, omega: HANDS.flick.omega * f, maxAccel: HANDS.flick.maxAccel * f * f }, sharpness.turnMul);
}


const onTarget = (aim: AimState, d: number) => Math.abs(wrapAngle(aim.angle - aim.want)) <= Math.max(BOT_AIM.fireSlackRad, Math.atan2(WORLD.playerRadius, d));

/** This engagement's lead judgment, hashed from the target and the moment rather than drawn, so it leaves the bot's random stream untouched. */
function leadJudgment(id: number, tick: number, judgment: { mean: number; spread: number } = BOT_AIM.leadJudgment): number {
  const v = Math.sin(id * 12.9898 + tick * 78.233) * 43758.5453;
  const { mean, spread } = judgment;
  return mean + ((v - Math.floor(v)) * 2 - 1) * spread;
}

/** Further than this a tick is a teleport, not a run: about three times the fastest dash. */
const TELEPORT_PX_PER_TICK = 120;

/**
 * How long a person takes to take in an enemy, as the reaction-time literature has it: lognormal about a median of `medianMs` (log-sd
 * `logSd`, so most come in a band round it and a few come late), times its sharpness, its temper's and its mood's share. On top:
 * `busyMul` when it is already fighting someone else (a second choice to make, Hick's law), up to `offAngleMs` more for an enemy as far as
 * behind it from where its gun points (scaled by the angle), and a startle of `surpriseMs` for one who appears this close (`surprisePx`).
 * Capped at `capMul` times the median, so a slow one is slow, not absent.
 */
export const NOTICE = { medianMs: 260, logSd: 0.3, busyMul: 1.5, offAngleMs: 90, surprisePx: 220, surpriseMs: [100, 200], capMul: 3.5 } as const;
/** What the moment adds to a reaction (see `NOTICE`): already fighting another, how far off its aim he is (rad), how far off he stands (px). */
export type NoticeCue = { busy?: boolean; offRad?: number; d?: number };

/** The standard normal quantile of `p` (Acklam's approximation, to about 1e-9): a normal draw from one uniform, as the flat draw it replaced took. */
export function probit(p: number): number {
  const q = Math.min(1 - 1e-12, Math.max(1e-12, p));
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const tail = (r: number) => (((((c[0]! * r + c[1]!) * r + c[2]!) * r + c[3]!) * r + c[4]!) * r + c[5]!) / ((((d[0]! * r + d[1]!) * r + d[2]!) * r + d[3]!) * r + 1);
  if (q < 0.02425) return tail(Math.sqrt(-2 * Math.log(q)));
  if (q > 1 - 0.02425) return -tail(Math.sqrt(-2 * Math.log(1 - q)));
  const r = (q - 0.5) * (q - 0.5);
  return ((((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * (q - 0.5)) / (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1);
}

/** A fresh reaction time, ms, by `NOTICE` (`mul` the sharpness, temper and mood shares together). */
export function noticeDelayMs(mul: number, cue: NoticeCue, rand: () => number): number {
  const median = NOTICE.medianMs * mul * (cue.busy ? NOTICE.busyMul : 1);
  const base = Math.min(median * NOTICE.capMul, median * Math.exp(NOTICE.logSd * probit(rand())));
  const angle = NOTICE.offAngleMs * Math.min(1, Math.abs(cue.offRad ?? 0) / Math.PI) * mul;
  const close = cue.d !== undefined && cue.d < NOTICE.surprisePx ? NOTICE.surpriseMs[0] + rand() * (NOTICE.surpriseMs[1] - NOTICE.surpriseMs[0]) : 0;
  return base + angle + close;
}

/**
 * `reactMul` is the bot's own temper's share of the reaction time (`Personality.reactMul`). With a `cue` (a versus bot), it takes him in
 * after a human-shaped reaction (`noticeDelayMs`); without one (a squad bot on the horde), after the flat `noticeMs` the horde was tuned on.
 */
export function engage(prev: Engagement | null, enemy: Point & { id: number }, sharpness: Sharpness, tick: number, rand: () => number, reactMul = 1, cue?: NoticeCue): Engagement {
  if (!prev) {
    const [fastest, slowest] = BOT_AIM.noticeMs.map((ms) => ms * sharpness.reactionMul * reactMul);
    const ms = cue ? noticeDelayMs(sharpness.reactionMul * reactMul, cue, rand) : fastest + rand() * (slowest - fastest);
    const noticeAtTick = tick + Math.round(ms / TICK_MS);
    return { id: enemy.id, x: enemy.x, y: enemy.y, vx: 0, vy: 0, acquiredTick: tick, noticeAtTick, leadMul: leadJudgment(enemy.id, tick, sharpness.lead), at: tick };
  }
  // Its read of his motion is over the time since it last looked (`at`), so a bot that looked away a few ticks does not read a burst of speed.
  const dt = Math.max(1, tick - (prev.at ?? tick - 1));
  if (prev.at === tick) return prev;
  // A jump no body could make in the time (a respawn, a round's restart on a new map) is a new read of him, not a burst of speed: read as
  // motion it threw his lead point out to infinity and the bot's aim to NaN.
  if (Math.hypot(enemy.x - prev.x, enemy.y - prev.y) > TELEPORT_PX_PER_TICK * dt) return { ...prev, id: enemy.id, x: enemy.x, y: enemy.y, vx: 0, vy: 0, at: tick };
  const k = 1 - Math.exp(-(dt * TICK_MS) / (BOT_AIM.motionTauMs * (sharpness.lagMul ?? 1)));
  const vx = prev.vx + k * (((enemy.x - prev.x) * WORLD.tickHz) / dt - prev.vx);
  const vy = prev.vy + k * (((enemy.y - prev.y) * WORLD.tickHz) / dt - prev.vy);
  return { ...prev, id: enemy.id, x: enemy.x, y: enemy.y, vx, vy, at: tick };
}

export function aimSigma(e: Engagement, me: Point, sharpness: Sharpness, tick: number): number {
  const rx = e.x - me.x, ry = e.y - me.y;
  const crossing = Math.abs(rx * e.vy - ry * e.vx) / Math.max(1, rx * rx + ry * ry);
  const unsettled = 1 + BOT_AIM.unsettledMul * Math.exp(-(Math.max(0, tick - e.noticeAtTick) * TICK_MS) / BOT_AIM.settleMs);
  return (BOT_AIM.baseSigma + BOT_AIM.sigmaPerRadPerSec * crossing) * unsettled * sharpness.aimMul * (sharpness.errMul ?? 1) * BOT_AIM.errMul;
}

export const landingErr = (sigma: number, rand: () => number) => sigma * gaussian(rand);

export const GRENADES: ReadonlySet<AbilityId | null> = new Set(['fragGrenade', 'gasGrenade']);
/** Aimed before use: the throws, the knife, the shield, and the claymore, which is set facing the enemy. */
const AIMED_ABILITIES: ReadonlySet<AbilityId | null> = new Set([...GRENADES, 'radar', 'knife', 'engineer', 'claymore']);

/** `sway`: the idle sway added into `want` (see `AimState.sway`); none on an aimed look. */
export type Look = { want: number; spin: number; hand: Hand; d: number; err: number; sway?: number };

export function aimAndTrigger(before: AimState, look: Look, wantsFire: boolean, wanted: AbilityId | null, shots: number): { aim: AimState; fire: boolean; ability: boolean; shots: number } {
  const aim = { ...turn({ ...before, err: look.err }, look.want, look.spin, look.hand, TICK_MS), sway: look.sway };
  const aimed = onTarget(aim, look.d);
  const fire = wantsFire && aimed;
  return { aim, fire, ability: wanted !== null && (aimed || !AIMED_ABILITIES.has(wanted)), shots: shots + (fire ? 1 : 0) };
}
