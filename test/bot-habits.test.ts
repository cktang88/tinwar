/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setInput, step } from '../src/shared/sim.ts';
import { snapshotFor } from '../src/shared/sim/snapshot.ts';
import { segmentBlocked } from '../src/shared/sim/movement.ts';
import { rand as worldRand } from '../src/shared/sim/world.ts';
import { botName, botThink, newBotMemory, type BotMemory } from '../src/server/bots.ts';
import { noticeDelayMs, skillOf } from '../src/server/bot/aim.ts';
import { arenaFor } from '../src/server/bot/arena.ts';
import { moodOf, styleFor, type Habits } from '../src/server/bot/habits.ts';
import { thinkBots } from '../src/server/bot/tick.ts';
import { emptyWorld, setWalls, spawnAt, TICK_MS } from './helpers.ts';

const seeded = (seed: number) => { let x = seed; return () => ((x = (x * 16807) % 2147483647) / 2147483647); };
const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const cv = (xs: readonly number[]) => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))) / m; };
const quantile = (xs: readonly number[], q: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]!; };
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

test('bots move in styles of their own: strafe legs, pauses and leanings differ from bot to bot, and a name keeps its style', () => {
  const r = seeded(11), taken = new Set<string>();
  const styles = Array.from({ length: 80 }, () => {
    const name = botName(taken, r); taken.add(name);
    const skill = skillOf(r());
    return { name, skill, style: styleFor(name, skill, 'cautious') };
  });
  const legMean = styles.map(({ style }) => (style.legMs[0] + style.legMs[1]) / 2);
  assert.ok(cv(legMean) >= 0.3, `between-bot CV of mean strafe leg ${cv(legMean).toFixed(2)}`);
  // Variety only ever makes a bot easier to hit than the bots of old: no style strafes quicker on average than their 725 ms legs, nor
  // sidesteps a planted gun more often, nor wants less ground for a leg.
  assert.ok(Math.min(...legMean) >= 725 && Math.max(...legMean) > 1500, `legs from ${Math.min(...legMean).toFixed(0)} to ${Math.max(...legMean).toFixed(0)} ms`);
  assert.ok(styles.every(({ style }) => style.legMs[0] >= 450 && style.stepMul <= 1 && style.strafePx >= 120), 'no style dodgier than the old bots');
  const ons = styles.map(({ style }) => style.strafeOn), pxs = styles.map(({ style }) => style.strafePx);
  assert.ok(Math.min(...ons) < 0.15 && Math.max(...ons) > 0.4 && Math.max(...pxs) - Math.min(...pxs) > 40, 'legs run on and want ground by the bot');
  assert.ok(new Set(styles.map(({ style }) => style.standOdds.toFixed(5))).size > 60, 'stand odds differ');
  assert.ok(new Set(styles.map(({ style }) => Math.sign(style.lean))).size === 2, 'some lean in, some back off');
  const reloads = styles.map(({ style }) => style.reloadAt);
  assert.ok(Math.min(...reloads) >= 0.3 && Math.max(...reloads) <= 0.95 && cv(reloads) > 0.2, 'reload habits spread over 0.3 to 0.95');
  assert.ok(styles.some(({ style }) => style.farm === 0) && styles.some(({ style }) => style.farm === 1), 'some never farm crates, some always do');
  // Rookies stand more and run longer legs than veterans.
  const tier = (t: string) => styles.filter(({ skill }) => skill.tier === t);
  assert.ok(mean(tier('rookie').map(({ style }) => style.legMs[0])) > mean(tier('veteran').map(({ style }) => style.legMs[0])), 'rookie legs run longer');
  assert.ok(mean(tier('rookie').map(({ style }) => style.standOdds)) > mean(tier('veteran').map(({ style }) => style.standOdds)), 'rookies stand more');
  // Hashed, not drawn: the same name and skill is the same style.
  const { name, skill, style } = styles[0]!;
  assert.deepEqual(styleFor(name, skill, 'cautious'), style);
});

test('reaction times have a right tail: lognormal about ~260 ms, slower when busy with another man, far off the aim, or startled up close', () => {
  const r = seeded(3);
  const plain = Array.from({ length: 4000 }, () => noticeDelayMs(1, {}, r));
  const p10 = quantile(plain, 0.1), p50 = quantile(plain, 0.5), p90 = quantile(plain, 0.9), p99 = quantile(plain, 0.99);
  assert.ok(p50 > 280 && p50 < 310, `median ${p50.toFixed(0)}ms`);
  assert.ok(Math.min(...plain) >= 220, 'never quicker than the old flat draw allowed');
  assert.ok(mean(plain) >= 285, `mean ${mean(plain).toFixed(0)}ms: no quicker on average than the old 220-350 ms`);
  assert.ok(mean(plain) > p50, 'mean past the median: skewed right');
  assert.ok(p90 - p50 > p50 - p10, `the slow side stretches further (p10 ${p10.toFixed(0)}, p50 ${p50.toFixed(0)}, p90 ${p90.toFixed(0)})`);
  assert.ok(p99 > 1.8 * p50, `a tail: p99 ${p99.toFixed(0)}ms`);
  const busy = quantile(Array.from({ length: 4000 }, () => noticeDelayMs(1, { busy: true }, r)), 0.5);
  assert.ok(busy > 1.4 * p50 && busy < 1.6 * p50, `already fighting another: median ${busy.toFixed(0)}ms (Hick's law)`);
  const behind = quantile(Array.from({ length: 4000 }, () => noticeDelayMs(1, { offRad: Math.PI }, r)), 0.5);
  const close = quantile(Array.from({ length: 4000 }, () => noticeDelayMs(1, { d: 100 }, r)), 0.5);
  assert.ok(behind > p50 + 70, `one behind it: ${behind.toFixed(0)}ms`);
  assert.ok(close > p50 + 90 && close < p50 + 220, `one who appears close: ${close.toFixed(0)}ms`);
});

test('a bot does not track a man through a wall: it aims where he went, and lets go of the trigger', () => {
  let firedHidden = 0, onHim = 0, hiddenTicks = 0;
  const wall = { x: 1180, y: 940, w: 40, h: 750 };
  for (let seed = 1; seed <= 8; seed++) {
    const w = emptyWorld();
    w.rng = seed;
    // He starts in the open north-east of the bot, then walks south behind a long wall. Nobody human is about, so the bot thinks at its
    // off-screen pace and its motor carries it longest between thinks.
    setWalls(w, [wall]);
    const bot = spawnAt(w, 1000, 1000, { loadout: { weapon: 'assault' }, name: `b${seed}` });
    const foe = spawnAt(w, 1600, 650, { loadout: { weapon: 'assault' } });
    const mems = new Map<number, BotMemory>([[bot.id, newBotMemory(seeded(seed), { name: `b${seed}`, seed })]]);
    const r = () => worldRand(w);
    let hiddenAt: number | null = null;
    for (let i = 0; i < 130; i++) {
      for (const p of [bot, foe]) if (p.life.k === 'alive') p.life.hp = 100;
      // The bot is held where it stands (whatever it would do about him), so the wall stays between them; he holds still till he walks.
      bot.x = 1000; bot.y = 1000; foe.x = 1600;
      if (i >= 60) foe.y = Math.min(1350, foe.y + 12);
      thinkBots(w, mems, r, { picks: false, respawn: false });
      const hidden = segmentBlocked([wall], bot.x, bot.y, foe.x - bot.x, foe.y - bot.y);
      if (hidden && hiddenAt === null) hiddenAt = i;
      if (!hidden) hiddenAt = null;
      // Past the spray it had going (`SPRAY_CARRY_MS`): no rounds, and its aim no longer on him where he really is.
      if (hiddenAt !== null && (i - hiddenAt) * TICK_MS > 300) {
        hiddenTicks++;
        if (bot.input.fire) firedHidden++;
        if (Math.abs(wrap(bot.input.angle - Math.atan2(foe.y - bot.y, foe.x - bot.x))) < (4 * Math.PI) / 180) onHim++;
      }
      step(w, TICK_MS);
    }
  }
  assert.ok(hiddenTicks > 200, `${hiddenTicks} ticks hidden`);
  assert.equal(firedHidden, 0, 'no rounds at a man hidden behind a wall past the spray it had going');
  assert.ok(onHim / hiddenTicks < 0.1, `its aim stayed on him through the wall ${(100 * onHim / hiddenTicks).toFixed(0)}% of the time`);
});

test('after a kill a bot stands a beat and looks round, and most reload there and then', () => {
  let paused = 0, reloaded = 0, kills = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const w = emptyWorld();
    const name = `killer${seed}`;
    const bot = spawnAt(w, 1000, 1000, { loadout: { weapon: 'smg' }, name });
    const foe = spawnAt(w, 1250, 1000);
    const r = seeded(seed);
    let mem: BotMemory = newBotMemory(r, { name, seed });
    let killTick: number | null = null, still = 0, reload = false;
    for (let i = 0; i < 200; i++) {
      if (foe.life.k === 'alive' && i < 40) foe.life.hp = 100;
      if (foe.life.k === 'alive' && i >= 40) foe.life.hp = Math.min(foe.life.hp, 5);
      const d = botThink(snapshotFor(w, bot.id), arenaFor(w), mem, r);
      mem = d.mem;
      setInput(w, bot.id, i + 1, d.input);
      step(w, TICK_MS);
      if (killTick === null && w.events.some((e) => e.e === 'kill' && e.killerId === bot.id)) { killTick = i; continue; }
      if (killTick === null) continue;
      const since = (i - killTick) * TICK_MS;
      const moving = d.input.up || d.input.down || d.input.left || d.input.right;
      if (since <= 1500 && (d.input.reload || (bot.life.k === 'alive' && bot.life.reloadUntil !== null))) reload = true;
      if (still === i - killTick - 1 && !moving) still++;
      if (since > 1500) break;
    }
    if (killTick === null) continue;
    kills++;
    if (still * TICK_MS >= 200) paused++;
    if (reload) reloaded++;
  }
  assert.ok(kills >= 10, `${kills} kills`);
  assert.ok(paused >= kills - 1, `${paused} of ${kills} stood a beat after the kill`);
  assert.ok(reloaded >= kills * 0.5, `${reloaded} of ${kills} reloaded within 1.5s of the kill`);
});

test('a bot with nobody about stops and looks round, wanders a few steps, or now and then goes idle, rather than chaining goals', () => {
  const idles = new Map<string, number>();
  let stillBouts = 0, seconds = 0;
  for (let seed = 1; seed <= 3; seed++) {
    const w = emptyWorld();
    w.rng = seed;
    const name = `idler${seed}`;
    const bot = spawnAt(w, 2000, 2000, { loadout: { weapon: 'assault' }, name });
    const mems = new Map<number, BotMemory>([[bot.id, newBotMemory(seeded(seed), { name, seed })]]);
    const r = () => worldRand(w);
    let still = 0;
    const ticks = 90_000 / TICK_MS;
    for (let i = 0; i < ticks; i++) {
      thinkBots(w, mems, r, { picks: false, respawn: false });
      const intent = mems.get(bot.id)!.intent;
      if (intent?.k === 'patrol' && intent.idle) idles.set(`${seed}:${intent.since}`, (idles.get(`${seed}:${intent.since}`) ?? 0) + 1);
      const moving = bot.input.up || bot.input.down || bot.input.left || bot.input.right;
      still = moving ? 0 : still + 1;
      if (still === Math.round(1000 / TICK_MS)) stillBouts++;
      step(w, TICK_MS);
    }
    seconds += 90;
  }
  assert.ok(idles.size >= 6, `${idles.size} idle moments in ${seconds}s of patrol`);
  assert.ok(stillBouts >= 6, `${stillBouts} times it stood a second or more`);
});

test('moods only ever make a bot worse: warming up and tilted it aims and reacts no better than settled, and fades back', () => {
  const style = styleFor('moody', skillOf(0.1), 'aggressive');
  const born: Habits = { style, born: 0, deaths: [], alive: null, life: 0, hurt: null, nemesis: null };
  const fresh = moodOf(born, 1), settled = moodOf(born, Math.round(70_000 / TICK_MS));
  assert.ok(fresh.aimMul > 1.1 && fresh.reactMul > 1.1, 'warming up, it aims and reacts worse');
  assert.equal(settled.aimMul, 1);
  const deaths = [Math.round(100_000 / TICK_MS), Math.round(130_000 / TICK_MS), Math.round(150_000 / TICK_MS)];
  const tilted = moodOf({ ...born, deaths }, deaths[2]! + 30);
  assert.ok(tilted.tilt > 0.5 && tilted.aimMul > 1, `tilted ${tilted.tilt.toFixed(2)}`);
  assert.ok(moodOf({ ...born, deaths }, deaths[2]! + Math.round(200_000 / TICK_MS)).tilt < 0.05, 'tilt fades');
  for (const t of [1, 1000, 5000, 20_000, 40_000]) {
    const m = moodOf({ ...born, deaths }, t);
    assert.ok(m.aimMul >= 1 && m.reactMul >= 1, 'never sharper than settled');
  }
});

test('an idling bot that is shot gets out of its idle within half a second', () => {
  let reacted = 0, runs = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const w = emptyWorld();
    w.rng = seed;
    const name = `afk${seed}`;
    const bot = spawnAt(w, 2000, 2000, { loadout: { weapon: 'assault' }, name });
    // He stands behind it, off its screen, and opens up once it is idle.
    const shooter = spawnAt(w, 2000, 2380, { loadout: { weapon: 'assault' }, kind: 'human' });
    const mem = newBotMemory(seeded(seed), { name, seed });
    for (const idle of ['afk', 'scan'] as const) {
      const mems = new Map<number, BotMemory>([[bot.id, { ...mem, intent: { k: 'patrol', goal: { x: 2000, y: 2000 }, idle, until: 1e9, since: 0, holdUntil: 0 } }]]);
      const r = () => worldRand(w);
      if (bot.life.k === 'alive') bot.life.hp = 100;
      bot.angle = -Math.PI / 2;
      let hitAt: number | null = null, out: number | null = null;
      for (let i = 0; i < 60 && out === null; i++) {
        if (bot.life.k === 'alive') bot.life.hp = Math.max(bot.life.hp, 50);
        thinkBots(w, mems, r, { picks: false, respawn: false, watched: true });
        setInput(w, shooter.id, i + 1 + (idle === 'scan' ? 1000 : 0), { up: false, down: false, left: false, right: false, angle: -Math.PI / 2, fire: true, shots: i + 1, reload: false, ability: false, aimDist: 380, use: false });
        step(w, TICK_MS);
        if (hitAt === null && w.events.some((e) => e.e === 'dmg' && e.kind === 'player' && e.victim === bot.id)) hitAt = i;
        const it = mems.get(bot.id)!.intent;
        if (hitAt !== null && !(it?.k === 'patrol' && it.idle)) out = i - hitAt;
      }
      runs++;
      if (hitAt !== null && out !== null && out * TICK_MS <= 500) reacted++;
    }
  }
  assert.ok(reacted === runs, `${reacted} of ${runs} idling bots broke off within 0.5 s of being shot`);
});
