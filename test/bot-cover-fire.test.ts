/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WORLD } from '../src/shared/defs.ts';
import { step } from '../src/shared/sim.ts';
import { rand, type Player, type World } from '../src/shared/sim/world.ts';
import { skillOf, VETERAN, type Skill } from '../src/server/bot/aim.ts';
import { arenaFor } from '../src/server/bot/arena.ts';
import { bodyExposed, pickCover } from '../src/server/bot/cover.ts';
import type { PersonalityId } from '../src/server/bot/intent.ts';
import { thinkBots } from '../src/server/bot/tick.ts';
import { newBotMemory, type BotMemory } from '../src/server/bots.ts';
import { emptyWorld, press, setWalls, spawnAt, TICK_MS } from './helpers.ts';

/** A slab with a bot west of it and a shooter far to the east, a little south: his line grazes the slab's south end. */
const SLAB = { x: 1040, y: 900, w: 30, h: 130 };
const SHOOTER = { x: 1600, y: 1000 };
const SECOND = 1000 / TICK_MS;

type Scene = { w: World; bot: Player; human: Player; mems: Map<number, BotMemory> };

function scene(at: { x: number; y: number }, persona: PersonalityId = 'cautious', skill: Skill = VETERAN, shielded = false): Scene {
  const w = emptyWorld();
  setWalls(w, [SLAB]);
  const bot = spawnAt(w, at.x, at.y, { loadout: { weapon: 'assault' }, kind: 'bot' });
  const human = spawnAt(w, SHOOTER.x, SHOOTER.y, { loadout: { weapon: 'lmg' }, kind: 'human', ...(shielded && { shielded: true as const }) });
  const mem: BotMemory = { ...newBotMemory(() => rand(w), { skill }), persona };
  mem.intent = { k: 'hold', target: human.id, spot: { x: at.x, y: at.y }, watch: { x: human.x, y: human.y }, until: 1e9, since: 0, holdUntil: 0 };
  return { w, bot, human, mems: new Map([[bot.id, mem]]) };
}

/** One tick: the bots think, the human fires (aiming at `aim` of the bot), the world steps. */
function tick(s: Scene, aim: ((bot: Player) => { x: number; y: number }) | null, shots: { n: number }) {
  thinkBots(s.w, s.mems, () => rand(s.w), { respawn: false, watched: true });
  if (aim) {
    const at = aim(s.bot);
    press(s.w, s.human, { angle: Math.atan2(at.y - s.human.y, at.x - s.human.x), fire: true, shots: ++shots.n });
  } else press(s.w, s.human, { angle: Math.PI });
  step(s.w, TICK_MS);
}

const hitOn = (s: Scene) => s.w.events.some((e) => e.e === 'dmg' && e.kind === 'player' && e.victim === s.bot.id);
const solids = () => [SLAB];

test('a bot holding cover it picked keeps all of its body out of an angled shooter\'s line, not just its centre', () => {
  const w = emptyWorld();
  setWalls(w, [SLAB]);
  const arena = arenaFor(w);
  for (const from of [{ x: 950, y: 1100 }, { x: 900, y: 950 }, { x: 960, y: 860 }]) {
    const pick = pickCover(arena.cover, arena.nav, solids(), from, [SHOOTER], { reach: 400, range: 400, peek: false });
    assert.ok(pick, `cover from (${from.x}, ${from.y})`);
    // He stands under his spawn shield, so the bot walks to its spot and holds it rather than turn to fight him on the way.
    const s = scene(from, 'cautious', VETERAN, true);
    (s.mems.get(s.bot.id)!.intent as { spot: { x: number; y: number } }).spot = pick.spot;
    const shots = { n: 0 };
    let held = 0;
    for (let t = 0; t < 3 * SECOND; t++) {
      tick(s, null, shots);
      // Once it stands at its spot (the motor pulls up a step short), no part of it is in his line.
      if (Math.hypot(s.bot.x - pick.spot.x, s.bot.y - pick.spot.y) < 16) {
        held++;
        assert.ok(!bodyExposed(solids(), s.bot, SHOOTER, 0), `from (${from.x}, ${from.y}) at (${s.bot.x.toFixed(0)}, ${s.bot.y.toFixed(0)}) a part of it shows`);
      }
    }
    assert.ok(held > SECOND, `it got to its spot from (${from.x}, ${from.y}) and held it`);
  }
});

test('hit with a shoulder past the corner, a bot tucks into a spot that hides all of it within half a second', () => {
  // Its centre is behind the slab's south end, from him; its shoulder is not.
  const corner = { x: SLAB.x - WORLD.playerRadius - 6, y: SLAB.y + SLAB.h - 12 };
  for (const persona of ['cautious', 'aggressive', 'marksman'] as const) {
    const s = scene(corner, persona);
    assert.ok(bodyExposed(solids(), s.bot, SHOOTER, 0), 'the scene: its shoulder shows');
    const shots = { n: 0 };
    let hitAt: number | null = null;
    for (let t = 0; t < 4 * SECOND && s.bot.life.k === 'alive'; t++) {
      // He shoots at its shoulder.
      tick(s, (b) => ({ x: b.x, y: b.y + 20 }), shots);
      if (hitAt === null && hitOn(s)) hitAt = t;
      if (hitAt !== null && t - hitAt >= SECOND / 2) break;
    }
    assert.ok(hitAt !== null, `${persona}: he hit its shoulder`);
    assert.ok(Math.hypot(s.bot.x - corner.x, s.bot.y - corner.y) > 20, `${persona}: moved off the spot it was hit at`);
    assert.ok(!bodyExposed(solids(), s.bot, SHOOTER, 0), `${persona}: half a second after the hit, all of it is out of his line (at ${s.bot.x.toFixed(0)}, ${s.bot.y.toFixed(0)})`);
  }
});

test('pinned behind cover by rounds that miss, a bot moves within a second and a half, whatever its temper and skill', () => {
  // Fully hidden, a long way up the slab: he hoses the slab beside it, so the rounds crack past and suppress it but none land.
  const hidden = { x: SLAB.x - WORLD.playerRadius - 6, y: SLAB.y + 50 };
  for (const persona of ['cautious', 'aggressive', 'marksman'] as const) {
    for (const value of [0.1, 0.6, 0.9]) {
      const s = scene(hidden, persona, skillOf(value));
      const shots = { n: 0 };
      let firstFire: number | null = null, movedAt: number | null = null;
      for (let t = 0; t < 3 * SECOND && movedAt === null; t++) {
        tick(s, () => ({ x: SLAB.x, y: SLAB.y + 70 }), shots);
        if (firstFire === null && s.w.events.some((e) => e.e === 'shot' && e.owner === s.human.id)) firstFire = t;
        if (Math.hypot(s.bot.x - hidden.x, s.bot.y - hidden.y) > 20) movedAt = t;
      }
      assert.ok(firstFire !== null && movedAt !== null, `${persona} at skill ${value}: moved under fire`);
      assert.ok(movedAt - firstFire <= 1.5 * SECOND, `${persona} at skill ${value}: sat ${((movedAt - firstFire) / SECOND).toFixed(2)} s under fire`);
    }
  }
});

/** A bot alone on a quiet map for `seconds`: its gun angle each tick (degrees, unwrapped). */
function idleAngles(facing: { x: number; y: number } | null, seconds: number): number[] {
  const w = emptyWorld();
  setWalls(w, [{ x: 900, y: 700, w: 400, h: 40 }]);
  const bot = spawnAt(w, 1000, 1000, { loadout: { weapon: 'assault' }, kind: 'bot' });
  const mem = newBotMemory(() => rand(w), { skill: VETERAN });
  mem.intent = { k: 'takePosition', spot: { x: 1000, y: 1000 }, facing: facing as { x: number; y: number }, since: 0, holdUntil: 1e9 };
  const mems = new Map([[bot.id, mem]]);
  const out: number[] = [];
  let prev = bot.angle, acc = (bot.angle * 180) / Math.PI;
  for (let t = 0; t < seconds * SECOND; t++) {
    thinkBots(w, mems, () => rand(w), { respawn: false, watched: true });
    step(w, TICK_MS);
    acc += (Math.atan2(Math.sin(bot.angle - prev), Math.cos(bot.angle - prev)) * 180) / Math.PI;
    prev = bot.angle;
    out.push(acc);
  }
  return out;
}

const spread = (xs: readonly number[]) => Math.max(...xs) - Math.min(...xs);
const rates = (xs: readonly number[]) => xs.slice(1).map((x, i) => (x - xs[i]!) * SECOND);
/** Turns of direction in the angle's travel, ignoring steps under `deadDeg`. */
function turnsBack(xs: readonly number[], deadDeg = 0.05): number {
  let n = 0, dir = 0;
  for (const r of rates(xs)) {
    const d = Math.abs(r / SECOND) < deadDeg ? 0 : Math.sign(r);
    if (d !== 0 && dir !== 0 && d !== dir) n++;
    if (d !== 0) dir = d;
  }
  return n;
}

test('holding an angle with nobody about, a bot\'s gun wobbles a few degrees, slowly: no dead-still gun and no jitter', () => {
  const angles = idleAngles({ x: 1600, y: 1000 }, 12).slice(SECOND);
  const wobble = spread(angles);
  assert.ok(wobble > 2 && wobble < 10, `wobbles ${wobble.toFixed(1)} degrees`);
  const fastest = Math.max(...rates(angles).map(Math.abs));
  assert.ok(fastest < 20, `at most ${fastest.toFixed(1)} deg/s`);
  // Under about 1 Hz: a turn back at most every half second or so.
  assert.ok(turnsBack(angles) <= 11 * 2, `${turnsBack(angles)} turns back in 11 s`);
});

test('standing with nothing to look at, a bot looks round its open lanes: its aim covers a wide arc over a few seconds, at an unhurried pace, never a snap', () => {
  const angles = idleAngles(null, 15);
  assert.ok(spread(angles.slice(SECOND)) > 30, `looks round ${spread(angles).toFixed(0)} degrees`);
  const fastest = Math.max(...rates(angles).map(Math.abs));
  assert.ok(fastest <= 90, `at most ${fastest.toFixed(0)} deg/s`);
  const jump = Math.max(...rates(angles).map((r) => Math.abs(r / SECOND)));
  assert.ok(jump < 3, `no tick turns it more than 3 degrees (${jump.toFixed(2)})`);
  // Most of the time it drifts slowly rather than sweeping.
  const slow = rates(angles).filter((r) => Math.abs(r) < 35).length / (angles.length - 1);
  assert.ok(slow > 0.8, `${(100 * slow).toFixed(0)}% of ticks under 35 deg/s`);
  assert.deepEqual(idleAngles(null, 15), angles, 'seeded: the same look round each run');
});
