import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TURRET_KINDS, ZOM, type ZombieKind } from '../src/shared/defs.ts';
import type { GameEvent, ReceiptRow } from '../src/shared/protocol.ts';
import { step } from '../src/shared/sim.ts';
import { damageZombie } from '../src/shared/sim/run.ts';
import { snapshotFor } from '../src/shared/sim/snapshot.ts';
import { createWorld, newId, type Turret, type World, type Zombie } from '../src/shared/sim/world.ts';
import { run, spawnAt, TICK_MS } from './helpers.ts';

/** A night with nothing left to spawn, so only the zombies a test places walk it. */
function nightWorld(): World {
  const w = createWorld('ZOM', 1, 'outpost');
  w.run!.core.hp = 1e9;
  w.run!.phase = { k: 'night', toSpawn: [], nextSpawnAt: Infinity, dawnAt: Infinity };
  return w;
}

function addZombie(w: World, hp: number, kind: ZombieKind = 'walker'): Zombie {
  const z = { id: newId(w), kind, x: 200, y: 200 + w.zombies.length * 60, hp, attackAt: Infinity, vx: 0, vy: 0 };
  w.zombies.push(z);
  return z;
}

/** Clears the horde and steps until dawn's receipt, handing back its event. */
function dawnReceipt(w: World): Extract<GameEvent, { e: 'receipt' }> {
  w.zombies = [];
  for (let t = 0; t < 2000; t += TICK_MS) {
    step(w, TICK_MS);
    const e = w.events.find((ev) => ev.e === 'receipt');
    if (e?.e === 'receipt') return e;
  }
  throw new Error('no receipt at dawn');
}

/** The phase read afresh, so a test that just set it is not held to the type it set. */
const phaseNow = (w: World) => w.run!.phase;
const rowOf = (rows: readonly ReceiptRow[], key: number | string) => rows.find(([k]) => k === key);

test('the receipt books each player under their id and each turret under its kind, overkill capped at the hp left', () => {
  const w = nightWorld();
  const a = spawnAt(w, 1380, 1450), b = spawnAt(w, 1420, 1450);
  const z1 = addZombie(w, 100), z2 = addZombie(w, 100), z3 = addZombie(w, 100), z4 = addZombie(w, 80), z5 = addZombie(w, 60);
  damageZombie(w, z1, 30, a);
  damageZombie(w, z1, 5000, a); // only the 70 it had left counts
  damageZombie(w, z2, 40, b, 'blast');
  damageZombie(w, z2, 50, a, 'sentry'); // a's sentry: booked to the sentry, not to a
  damageZombie(w, z3, 60, b, 'sentry');
  damageZombie(w, z3, 999, null, 'bastion');
  damageZombie(w, z4, 25, null, 'blast', 'spikes');
  damageZombie(w, z5, 10, null, 'blast');
  damageZombie(w, z1, 50, a); // already dead: nothing
  const r = dawnReceipt(w);
  assert.equal(r.night, 1);
  assert.deepEqual(rowOf(r.rows, a.id), [a.id, 100, 1]);
  assert.deepEqual(rowOf(r.rows, b.id), [b.id, 40, 0]);
  assert.deepEqual(rowOf(r.rows, 'sentry'), ['sentry', 110, 0], 'two players\' sentries grouped by kind');
  assert.deepEqual(rowOf(r.rows, 'bastion'), ['bastion', 40, 1]);
  assert.deepEqual(rowOf(r.rows, 'spikes'), ['spikes', 25, 0]);
  assert.deepEqual(rowOf(r.rows, 'blast'), ['blast', 10, 0]);
  assert.equal(r.rows.length, 6);
  const total = r.rows.reduce((n, [, d]) => n + d, 0);
  assert.equal(total, 100 + 90 + 100 + 25 + 10, 'the receipt adds up to the hp the horde lost');
  assert.deepEqual(r.rows.map(([, d]) => d), [...r.rows.map(([, d]) => d)].sort((x, y) => y - x), 'most damage first');
});

test('the receipt starts over each night: a day\'s and last night\'s damage are left off', () => {
  const w = createWorld('ZOM', 1, 'outpost');
  w.run!.core.hp = 1e9;
  const p = spawnAt(w, 1380, 1450);
  damageZombie(w, addZombie(w, 100), 40, p); // by day, before the night opens
  w.zombies = [];
  w.run!.phase = { k: 'day', endsAt: w.now };
  step(w, TICK_MS);
  assert.equal(w.run!.phase.k, 'night');
  const phase = phaseNow(w);
  if (phase.k === 'night') { phase.toSpawn = []; phase.dawnAt = Infinity; }
  w.zombies = [];
  damageZombie(w, addZombie(w, 100), 15, p);
  const first = dawnReceipt(w);
  assert.deepEqual(first.rows, [[p.id, 15, 0]]);
  w.run!.phase = { k: 'night', toSpawn: [], nextSpawnAt: Infinity, dawnAt: Infinity };
  damageZombie(w, addZombie(w, 100), 7, null, 'mortar');
  const second = dawnReceipt(w);
  assert.equal(second.night, 2);
  assert.deepEqual(second.rows, [['mortar', 7, 0]]);
});

test('dawn\'s receipt reaches every squad player however far from the action, once', () => {
  const w = nightWorld();
  const near = spawnAt(w, 1380, 1450), far = spawnAt(w, 300, 2700);
  damageZombie(w, addZombie(w, 100), 100, near);
  const r = dawnReceipt(w);
  for (const p of [near, far]) assert.deepEqual(snapshotFor(w, p.id).events.filter((e) => e.e === 'receipt'), [r]);
  run(w, 1000);
  assert.ok(!w.events.some((e) => e.e === 'receipt'), 'sent once per dawn');
});

test('a real night with a turret: the turret\'s kind is on the receipt and the books never exceed the horde\'s health', () => {
  const w = nightWorld();
  w.walls = [];
  w.crates = [];
  const owner = spawnAt(w, 1380, 1450);
  const cx = 20, cy = 30, tx = (cx + 0.5) * ZOM.cell, ty = (cy + 0.5) * ZOM.cell;
  const t: Turret = { id: newId(w), kind: 'sentry', cx, cy, hp: 1e9, owner: owner.id, ammo: 1e9, nextFireAt: 0 };
  w.buildings.push(t);
  w.buildingsVersion++;
  const hp = 60;
  for (let i = 0; i < 5; i++) w.zombies.push({ id: newId(w), kind: 'walker', x: tx - 200, y: ty - 100 + i * 50, hp, attackAt: Infinity, vx: 0, vy: 0 });
  let r: Extract<GameEvent, { e: 'receipt' }> | null = null;
  for (let ms = 0; ms < 20_000 && !r; ms += TICK_MS) {
    step(w, TICK_MS);
    const e = w.events.find((ev) => ev.e === 'receipt');
    if (e?.e === 'receipt') r = e;
  }
  assert.ok(r, 'the sentry cleared the night and dawn came');
  const sentry = rowOf(r.rows, 'sentry');
  assert.ok(sentry && sentry[2] > 0, `the sentry is booked its kills: ${JSON.stringify(r.rows)}`);
  assert.ok(!rowOf(r.rows, owner.id), 'its builder fired nothing');
  assert.equal(r.rows.reduce((n, [, , k]) => n + k, 0), 5, 'every kill booked once');
  assert.ok(Math.abs(r.rows.reduce((n, [, d]) => n + d, 0) - 5 * hp) <= r.rows.length, 'damage adds up to the horde\'s health, no overkill');
});

test('every turret kind gets its own line with no list to keep: a new kind is booked under its own name', () => {
  const w = nightWorld();
  const p = spawnAt(w, 1380, 1450);
  TURRET_KINDS.forEach((kind, i) => damageZombie(w, addZombie(w, 1000), 10 + i, p, kind));
  const r = dawnReceipt(w);
  assert.deepEqual(new Set(r.rows.map(([k]) => k)), new Set(TURRET_KINDS));
  assert.ok(!rowOf(r.rows, p.id), 'a turret\'s hit is never its builder\'s');
});
