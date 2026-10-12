import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WEAPON_IDS } from '../src/shared/defs.ts';
import type { Loadout } from '../src/shared/protocol.ts';
import { damagePlayer } from '../src/shared/sim/combat.ts';
import { step } from '../src/shared/sim.ts';
import { pendingPick } from '../src/shared/sim/stats.ts';
import { rand, type Player, type World } from '../src/shared/sim/world.ts';
import { GUN_SWITCH, newBotMemory, nextLoadout, PICK_DELAY, respawnDelayMs, RESPAWN_DELAY, SPAWN_SETTLE, type BotMemory } from '../src/server/bots.ts';
import { thinkBots } from '../src/server/bot/tick.ts';
import { emptyWorld, press, spawnAt, TICK_MS } from './helpers.ts';

const LOADOUT: Loadout = { weapon: 'assault', armor: 'medium', color: 'blue' };
const kill = (w: World, p: Player) => {
  if (p.life.k === 'alive') p.life.shieldUntil = -Infinity;
  damagePlayer(w, p, 1e6, { attacker: null, team: null, label: 'Test', piercing: true, via: 'blast', fromX: p.x, fromY: p.y });
};
const moving = (p: Player) => p.input.up || p.input.down || p.input.left || p.input.right;
const quantile = (xs: readonly number[], q: number) => [...xs].sort((a, b) => a - b)[Math.floor(q * (xs.length - 1))]!;

test('respawn delays vary from bot to bot and death to death, a lognormal around 1.8 s with a long tail and a rare AFK', () => {
  const ds: number[] = [];
  for (let i = 0; i < 4000; i++) ds.push(respawnDelayMs(`bot${i % 40}`, 1000 + i * 3133));
  assert.deepEqual(ds.slice(0, 50), Array.from({ length: 50 }, (_, i) => respawnDelayMs(`bot${i % 40}`, 1000 + i * 3133)), 'the same bot and death, the same delay');
  const med = quantile(ds, 0.5), p90 = quantile(ds, 0.9), afk = ds.filter((d) => d >= RESPAWN_DELAY.afk[0]).length / ds.length;
  assert.ok(med > 1500 && med < 2100, `median ${med.toFixed(0)} ms`);
  assert.ok(p90 > 3200, `the tail: 90th percentile ${p90.toFixed(0)} ms`);
  assert.ok(ds.some((d) => d > 6000 && d <= RESPAWN_DELAY.capMs), 'some take a good while');
  assert.ok(afk > 0.01 && afk < 0.045, `AFK share ${afk}`);
  assert.ok(Math.min(...ds) > 0 && Math.max(...ds) <= RESPAWN_DELAY.afk[1]);
});

test('a bot keeps its colour and armor for its stay, and its gun mostly; a run of lives without a kill makes another gun likelier', () => {
  let kept = 0, keptDry = 0;
  const n = 4000;
  for (let i = 0; i < n; i++) {
    const a = nextLoadout(LOADOUT, 1, `b${i % 25}`, i * 77);
    assert.equal(a.color, LOADOUT.color);
    assert.equal(a.armor, LOADOUT.armor);
    assert.ok(WEAPON_IDS.includes(a.weapon));
    if (a.weapon === LOADOUT.weapon) kept++;
    if (nextLoadout(LOADOUT, 6, `b${i % 25}`, i * 77).weapon === LOADOUT.weapon) keptDry++;
  }
  assert.ok(Math.abs(1 - kept / n - GUN_SWITCH.base) < 0.025, `switched ${(1 - kept / n).toFixed(3)} of lives`);
  assert.ok(keptDry / n < kept / n - 0.25, `a dry streak switches more: kept ${(keptDry / n).toFixed(2)} against ${(kept / n).toFixed(2)}`);
});

test('in play: the loadout persists across lives, respawns come late by varying amounts, and every spawn settles before it moves', () => {
  const w = emptyWorld();
  const p = spawnAt(w, 1500, 1500, { loadout: LOADOUT, name: 'TheoPlays' });
  const bots = new Map<number, BotMemory>([[p.id, newBotMemory(() => rand(w), null, LOADOUT)]]);
  const lives: Loadout[] = [], lates: number[] = [], firstMove: number[] = [];
  let readyAt = 0, lifeStart = w.now, settling = false;
  for (let t = 0; t < 30 * 60 * 6 && lives.length < 24; t++) {
    if (p.life.k === 'alive' && w.now - lifeStart > 2500) {
      // A kill to its name each life, so it keeps its gun at the base rate.
      p.lifeKills = 1;
      kill(w, p);
      const life = p.life as Player['life'];
      readyAt = life.k === 'dead' ? life.respawnAt : 0;
    }
    const { respawned } = thinkBots(w, bots, () => rand(w), { watched: true });
    if (respawned.includes(p.id)) { lives.push({ ...p.loadout }); lates.push(w.now - readyAt); lifeStart = w.now; settling = true; }
    if (settling && moving(p)) { firstMove.push(w.now - lifeStart); settling = false; }
    step(w, TICK_MS);
  }
  assert.ok(lives.length >= 15, `${lives.length} lives`);
  assert.ok(lives.every((l) => l.color === LOADOUT.color && l.armor === LOADOUT.armor), 'colour and armor never change');
  const sameGun = lives.filter((l, i) => l.weapon === (i === 0 ? LOADOUT.weapon : lives[i - 1]!.weapon)).length;
  assert.ok(sameGun >= lives.length * 0.6, `kept its gun ${sameGun} of ${lives.length} lives`);
  assert.ok(Math.min(...lates) > 200, `never back the moment it can: ${Math.min(...lates).toFixed(0)} ms`);
  assert.ok(Math.max(...lates) - Math.min(...lates) > 1000, `delays vary: ${lates.map((d) => d.toFixed(0)).join(', ')}`);
  assert.ok(firstMove.length >= lives.length * 0.7, `${firstMove.length} spawns moved`);
  assert.ok(firstMove.every((ms) => ms >= SPAWN_SETTLE.minMs - TICK_MS), `no key before the settle ends: ${firstMove.map((d) => d.toFixed(0)).join(', ')}`);
  assert.ok(quantile(firstMove, 0.5) <= SPAWN_SETTLE.maxMs + 800, `median first move ${quantile(firstMove, 0.5).toFixed(0)} ms`);
});

test('a bot shot at while it settles answers at once', () => {
  const w = emptyWorld();
  const p = spawnAt(w, 1500, 1500, { name: 'mariah_27' });
  const shooter = spawnAt(w, 1500, 1200, { kind: 'human', loadout: { weapon: 'assault' } });
  const bots = new Map<number, BotMemory>([[p.id, { ...newBotMemory(() => rand(w)), settleUntil: w.now + 5000 }]]);
  for (let i = 0; i < 5; i++) { thinkBots(w, bots, () => rand(w), { watched: true }); step(w, TICK_MS); }
  assert.ok(bots.get(p.id)!.settleUntil !== undefined && !moving(p), 'settling, it presses nothing');
  press(w, shooter, { angle: Math.PI / 2, fire: true, shots: shooter.input.shots + 1 });
  step(w, TICK_MS);
  thinkBots(w, bots, () => rand(w), { watched: true });
  assert.equal(bots.get(p.id)!.settleUntil, undefined, 'the round at it ends the settle');
  assert.ok(bots.get(p.id)!.intent !== null, 'and it thinks on it the same tick');
});

test('a bot takes an open pick a few seconds after it opens, not the moment it does', () => {
  const at: number[] = [];
  for (let seed = 0; seed < 12; seed++) {
    const w = emptyWorld();
    for (let i = 0; i < seed; i++) rand(w);
    const p = spawnAt(w, 1000 + seed * 10, 1000, { loadout: { weapon: 'smg' }, name: `b${seed}` });
    p.level = 2;
    const bots = new Map<number, BotMemory>([[p.id, newBotMemory(() => rand(w))]]);
    const opened = w.now;
    for (let t = 0; t < 30 * 15; t++) {
      if (thinkBots(w, bots, () => rand(w), { watched: true, respawn: false }).picked) { at.push(w.now - opened); break; }
      step(w, TICK_MS);
    }
    assert.ok(pendingPick(p) === null || at.length === seed + 1, 'it took the pick in the end');
  }
  assert.equal(at.length, 12);
  assert.ok(Math.min(...at) >= PICK_DELAY.minMs - TICK_MS, `the soonest after ${Math.min(...at).toFixed(0)} ms`);
  assert.ok(Math.max(...at) <= PICK_DELAY.maxMs + 1000, `the latest after ${Math.max(...at).toFixed(0)} ms`);
  assert.ok(Math.max(...at) - Math.min(...at) > 1000, `they vary: ${at.map((d) => d.toFixed(0)).join(', ')}`);
});
