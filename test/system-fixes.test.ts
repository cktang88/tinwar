import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ROYALE, ZOM, ZOMBIES } from '../src/shared/defs.ts';
import { addPlayer, canRespawn, setInput, step } from '../src/shared/sim.ts';
import { ABILITIES } from '../src/shared/sim/abilities.ts';
import { wallTier } from '../src/shared/sim/build.ts';
import { enterRoyale } from '../src/shared/sim/royale.ts';
import { snapshotFor } from '../src/shared/sim/snapshot.ts';
import { setRangeLoadout } from '../src/shared/sim/targets.ts';
import { createWorld, newId, type World } from '../src/shared/sim/world.ts';
import { botThink, newBotMemory } from '../src/server/bots.ts';
import { arenaFor } from '../src/server/bot/arena.ts';
import { emptyWorld, press, run, spawnAt, TICK_MS } from './helpers.ts';

/** Bugs found across systems, each pinned where it was fixed. */

function royaleWorld(): World {
  const w = emptyWorld('BR');
  const r = w.royale!;
  r.caches = []; r.towers = []; r.drops = [];
  const big = { x: 1000, y: 1000, r: 5000 };
  r.ring = { k: 'waiting', phase: 0, circle: big, next: big, shrinkAt: Infinity };
  return w;
}

test('Last Standing: holding E takes one gun, and does not swap back and forth', () => {
  const w = royaleWorld();
  const p = spawnAt(w, 1000, 1000, { team: null });
  enterRoyale(w, p);
  const start = p.gun;
  w.royale!.guns.push({ id: 999_999, x: 1010, y: 1000, gun: 'shotgun' });
  p.input = { ...p.input, use: true };
  let took = 0;
  for (let t = 0; t < 2000; t += TICK_MS) { step(w, TICK_MS); took += w.events.filter((e) => e.e === 'took').length; }
  assert.equal(took, 1);
  assert.equal(p.gun, 'shotgun');
  p.input = { ...p.input, use: false };
  step(w, TICK_MS);
  p.input = { ...p.input, use: true };
  step(w, TICK_MS);
  assert.equal(p.gun, start, 'a fresh press takes again');
});

test('Last Standing: a gun taken mid-burst fires none of the old burst', () => {
  const w = royaleWorld();
  const p = spawnAt(w, 1000, 1000, { team: null });
  enterRoyale(w, p);
  p.gun = 'machinePistol';
  if (p.life.k === 'alive') { p.life.ammo = 24; p.life.shieldUntil = -Infinity; }
  w.royale!.guns.push({ id: 999_999, x: 1010, y: 1000, gun: 'sniper' });
  press(w, p, { angle: 0, fire: true, shots: 1, use: true });
  const shots: string[] = [];
  for (let t = 0; t < 3000; t += TICK_MS) {
    step(w, TICK_MS);
    if (t < TICK_MS) press(w, p, { angle: 0 });
    for (const e of w.events) if (e.e === 'shot' && e.owner === p.id) shots.push(e.gun ?? '');
  }
  assert.equal(p.gun, 'sniper');
  assert.ok(!shots.includes('sniper'), `the sniper never fired by itself: ${shots.join()}`);
});

test('Last Standing: taking a final-stage gun off the floor announces the holder as hunted', () => {
  const w = royaleWorld();
  const p = spawnAt(w, 1000, 1000, { team: null });
  enterRoyale(w, p);
  w.royale!.guns.push({ id: 999_999, x: 1010, y: 1000, gun: 'executioner' });
  p.input = { ...p.input, use: true };
  const seen: string[] = [];
  for (let t = 0; t < 300; t += TICK_MS) { step(w, TICK_MS); for (const e of w.events) seen.push(e.e); }
  assert.equal(p.gun, 'executioner');
  assert.ok(seen.includes('hunted'), seen.join());
});

test('a supply drop skips exactly one level, and a dead player\'s round does not crack it', () => {
  const w = royaleWorld();
  const p = spawnAt(w, 1000, 1000, { team: null });
  enterRoyale(w, p);
  p.score = 440; p.level = 1;
  w.crates = [...w.crates, { id: 777_777, x: 1060, y: 1000 - 32, size: ROYALE.dropSize, hp: 1, respawnAt: null, drop: true }];
  p.input = { ...p.input, angle: 0, fire: true, shots: 1 };
  run(w, 600);
  assert.equal(p.level, 2, 'the next pick, not the one after');

  const v = royaleWorld();
  const q = spawnAt(v, 1000, 1000, { team: null });
  enterRoyale(v, q);
  if (q.life.k === 'alive') q.life.shieldUntil = -Infinity;
  const crate = { id: 777_778, x: 1300, y: 1000 - 32, size: ROYALE.dropSize, hp: 1, respawnAt: null, drop: true as const };
  v.crates = [...v.crates, crate];
  q.input = { ...q.input, angle: 0, fire: true, shots: 1 };
  step(v, TICK_MS);
  q.input = { ...q.input, fire: false };
  q.life = { k: 'dead', respawnAt: Infinity };
  run(v, 1000);
  assert.equal(crate.respawnAt, null, 'still standing for the living');
});

test('Last Standing: a cache\'s opening progress reaches the wire in fiftieths', () => {
  const w = royaleWorld();
  const p = spawnAt(w, 1000, 1000, { team: null });
  enterRoyale(w, p);
  w.royale!.caches = [{ id: 1, x: 1000, y: 1000, tier: 0, open: false, by: p.id, since: w.now - 100 }];
  const view = snapshotFor(w, p.id).royale!.caches[0]!;
  assert.equal(view[5], 1, '100 ms of 5 s is one fiftieth, a whole number');
});

test('a bot fires out through its own one-way Shield', () => {
  const seeded = (seed: number) => { let x = seed; return () => ((x = (x * 16807) % 2147483647) / 2147483647); };
  const w = emptyWorld('FFA');
  const bot = spawnAt(w, 1000, 1000, { loadout: { weapon: 'assault' } });
  const foe = spawnAt(w, 1350, 1000);
  bot.angle = 0;
  ABILITIES.engineer(w, bot);
  const r = seeded(11);
  let mem = newBotMemory(r);
  for (let i = 0; i < 90; i++) {
    const d = botThink(snapshotFor(w, bot.id), arenaFor(w), mem, r);
    mem = d.mem;
    setInput(w, bot.id, i + 1, { ...d.input, up: false, down: false, left: false, right: false });
    step(w, TICK_MS);
    if (foe.life.k === 'alive') foe.life.hp = 100;
  }
  assert.ok(bot.fired > 5, `fired ${bot.fired}`);
});

test('the Range: picking armor fills its pool', () => {
  const w = createWorld('RNG', 1, 'range');
  const p = addPlayer(w, 'me', { weapon: 'assault', armor: 'none', color: 'red' }, { kind: 'human' });
  assert.ok(setRangeLoadout(w, p, { armor: 'heavy' }));
  assert.ok(p.life.k === 'alive' && p.life.armor > 0);
});

test('Zombies: the dead come back only through the run, never by respawning', () => {
  const w = createWorld('ZOM', 1, 'outpost');
  const p = spawnAt(w, 1000, 1000);
  p.life = { k: 'dead', respawnAt: 0 };
  assert.equal(canRespawn(w, p.id), false);
});

test('Zombies: a steel wall\'s armor turns aside part of a bite that would otherwise fell it', () => {
  const w = createWorld('ZOM', 1, 'outpost');
  w.run!.phase = { k: 'night', toSpawn: [], nextSpawnAt: Infinity, dawnAt: Infinity };
  w.run!.core.hp = 1e9;
  for (let cy = 0; cy < 60; cy++) w.buildings.push({ id: newId(w), kind: 'wall', cx: 10, cy, hp: wallTier(3).hp, lv: 3 });
  w.buildingsVersion++;
  const wall = w.buildings.find((b) => b.cy === 30)!;
  wall.hp = 35;
  w.zombies.push({ id: newId(w), kind: 'brute', x: 10 * ZOM.cell - ZOMBIES.brute.radius - 2, y: 30.5 * ZOM.cell, hp: 1e9, attackAt: 0, vx: 0, vy: 0 });
  run(w, TICK_MS);
  assert.ok(w.buildings.includes(wall), 'it stands');
  assert.ok(Math.abs(wall.hp - (35 - ZOMBIES.brute.damage * (1 - wallTier(3).armor))) < 1e-6, `hp ${wall.hp}`);
});

test('client prediction stops at a barrel where the server does', async () => {
  const { solidsOf, predictInput, reconcile, selfMotion, NO_PREDICTION } = await import('../src/client/predict.ts');
  const { wallViews } = await import('../src/shared/sim/snapshot.ts');
  const { IDLE_INPUT } = await import('../src/shared/sim/world.ts');
  const { BARREL } = await import('../src/shared/defs.ts');
  const w = emptyWorld('FFA');
  w.barrels = [{ id: 9999, x: 800, y: 950, hp: BARREL.hp, fuseAt: null, respawnAt: null, by: null }];
  const p = spawnAt(w, 700, 950);
  const first = snapshotFor(w, p.id);
  const walls = wallViews(w);
  let pred = reconcile(NO_PREDICTION, selfMotion(first).at, first.ackSeq, solidsOf(walls, first), selfMotion(first).speed, 6000);
  for (let i = 1; i <= 30; i++) {
    const input = { ...IDLE_INPUT, right: true, angle: 0 };
    setInput(w, p.id, i, input);
    step(w, TICK_MS);
    pred = predictInput(pred, { seq: i, input, dtMs: TICK_MS, ability: null }, solidsOf(walls, first), selfMotion(first).speed, i * TICK_MS, 6000);
  }
  assert.ok(Math.abs(pred.afterNewest!.x - p.x) < 0.5, `predicted ${pred.afterNewest!.x}, server ${p.x}`);
});

test('a held trigger fires a semi-auto at its own top rate', () => {
  const w = emptyWorld();
  const p = spawnAt(w, 1000, 1000, { loadout: { weapon: 'pistol' } });
  if (p.life.k === 'alive') p.life.shieldUntil = -Infinity;
  press(w, p, { angle: 0, fire: true, shots: 1 });
  const at: number[] = [];
  for (let t = 0; t < 1000; t += TICK_MS) { step(w, TICK_MS); for (const e of w.events) if (e.e === 'shot' && e.owner === p.id) at.push(w.now); }
  assert.ok(at.length >= 4, `held for a second: ${at.length} rounds`);
  const gaps = at.slice(1).map((t, i) => t - at[i]!);
  assert.ok(gaps.every((g) => Math.abs(g - 200) < TICK_MS + 1), `about the pistol's 200 ms apart: ${gaps.map(Math.round).join()}`);
});

test('server: a range cannot make profiles by changing a look, and joining and leaving in a loop counts one game a round', async () => {
  const { mkdtemp } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { LIMITS, makeWindowGate } = await import('../src/server/limits.ts');
  const { openProfiles } = await import('../src/server/profiles.ts');
  const { createRoom } = await import('../src/server/room.ts');
  const { fakeSocket, PISTOL } = await import('./helpers.ts');
  const credited: number[] = [];
  const accounts = { stats: () => null, credit: (_n: string, d: { games: number }) => credited.push(d.games), nameForToken: (t: string) => (t === 'tok' ? 'Acct' : null) } as unknown as Parameters<typeof createRoom>[3];
  const profiles = await openProfiles(await mkdtemp(join(tmpdir(), 'sysfix-')));
  const range = createRoom('r-x', 'RNG', 1, accounts, 1, LIMITS, undefined, profiles, makeWindowGate(30_000, 5, 86_400_000));
  for (let i = 0; i < 5; i++) {
    const ws = fakeSocket();
    range.connect(ws.socket, '198.51.100.7');
    ws.send({ t: 'join', name: `Spam${i}`, loadout: PISTOL, aspect: 1.5 });
    ws.send({ t: 'equip', slot: 'helmet', id: 'h_standard' });
    assert.equal(profiles.get(`Spam${i}`), null, 'no profile made in the range');
    ws.close();
  }
  range.close();
  const room = createRoom('f-x', 'FFA', 1, accounts, 1, LIMITS, undefined, profiles);
  for (let i = 0; i < 10; i++) {
    const ws = fakeSocket();
    room.connect(ws.socket, '198.51.100.8');
    ws.send({ t: 'join', name: 'Acct', token: 'tok', loadout: PISTOL, aspect: 1.5 });
    ws.close();
  }
  room.close();
  await profiles.flush();
  assert.equal(credited.reduce((a, b) => a + b, 0), 1, 'ten joins and leaves in one round count one game');
  assert.equal(profiles.get('Acct')?.games ?? 0, 1);
});

test('sim: a kill landed after its maker died is paid on its own record; barrel credit goes only to whoever lit it', async () => {
  const { kill } = await import('../src/shared/sim/combat.ts');
  const { BARREL } = await import('../src/shared/defs.ts');
  const w = emptyWorld('FFA');
  const a = spawnAt(w, 500, 500), b = spawnAt(w, 700, 500);
  (a.perks as Record<number, string>)[3] = 'fragGrenade';
  if (b.life.k === 'alive') { b.life.hp = 5; b.life.shieldUntil = -Infinity; }
  press(w, a, { angle: 0, ability: true, aimDist: 200 });
  step(w, TICK_MS);
  press(w, a, { angle: 0 });
  kill(w, a, null, 'Ring');
  w.lifeRecords.length = 0;
  run(w, 1500);
  assert.equal(b.life.k, 'dead', 'the grenade killed b');
  assert.deepEqual(w.lifeRecords.filter((r) => r.id === a.id).map((r) => r.kills), [1], 'the posthumous kill is recorded');

  const v = emptyWorld('FFA');
  const p = spawnAt(v, 500, 500), q = spawnAt(v, 500, 900);
  for (const x of [p, q]) if (x.life.k === 'alive') x.life.shieldUntil = -Infinity;
  v.barrels.push({ id: v.nextId++, x: 560, y: 500, hp: BARREL.hp, fuseAt: null, respawnAt: null, by: null });
  v.wallsVersion++;
  press(v, q, { angle: -Math.PI / 2, fire: true, shots: 1 });
  run(v, 600);
  press(v, q, {});
  if (p.life.k === 'alive') p.life.hp = 30;
  press(v, p, { angle: 0, fire: true, shots: 1 });
  const medals: string[] = [];
  for (let i = 0; i < 60; i++) { step(v, TICK_MS); press(v, p, {}); for (const e of v.events) if (e.e === 'medal') medals.push(`${e.medal}:${e.id === q.id ? 'q' : 'p'}`); }
  assert.equal(p.life.k, 'dead', 'p blew himself up');
  assert.ok(!medals.includes('kaboom:q'), `q never lit the barrel: ${medals.join()}`);
});

test('sim: a radar tag and a near-death do not carry into the next round; Ninja keeps a tagged player off enemy minimaps', async () => {
  const { WORLD } = await import('../src/shared/defs.ts');
  const w = emptyWorld('TDM');
  const r = spawnAt(w, 1000, 1000, { team: 'red' }), b = spawnAt(w, 1400, 1000, { team: 'blue' });
  b.taggedUntil = w.now + 30_000;
  b.lowAt = w.now;
  assert.ok(snapshotFor(w, r.id).minimap.some((m) => m.tagged), 'tagged');
  (b.perks as Record<number, string>)[2] = 'ninja';
  assert.ok(!snapshotFor(w, r.id).minimap.some((m) => m.tagged), 'Ninja hides even an earlier tag');
  delete (b.perks as Record<number, string>)[2];
  w.teamScore.red = WORLD.tdmWinScore;
  run(w, WORLD.roundRestartMs + 200);
  assert.equal(w.match.k, 'playing', 'the next round');
  assert.equal(b.taggedUntil, 0);
  assert.equal(b.lowAt, null);
});

test('client: a shot the server fired unpredicted is taken by the rebuilt trigger, so the page does not fire it again', async () => {
  const { NO_FIRING, settle } = await import('../src/client/fire.ts');
  const sv = { gun: 'grenadier' as const, mag: 18, reloadMs: 2000, ammo: 17, reloading: false, reloadFrac: 0, alive: true, armed: true };
  const out = settle(NO_FIRING, sv, 10, 1, []);
  assert.equal(out.unmatched, 1, 'drawn late');
  assert.equal(out.firing.trigger.burstLeft, 2, 'the burst has two rounds left, as on the server');
  assert.ok(out.firing.trigger.nextFireAt > 10 * TICK_MS, 'and the gun is cycling');
});

test('client: movement prediction drops sprint on a quick click, as the server does', async () => {
  const { NO_PREDICTION, predictInput, reconcile } = await import('../src/client/predict.ts');
  const { IDLE_INPUT } = await import('../src/shared/sim/world.ts');
  const pace = { walk: 200, sprint: 330 };
  let pred = reconcile(NO_PREDICTION, { x: 0, y: 0, dash: null }, 0, [], pace, 6000);
  pred = predictInput(pred, { seq: 1, input: { ...IDLE_INPUT, right: true, sprint: true }, dtMs: TICK_MS, ability: null }, [], pace, 0, 6000);
  const x1 = pred.afterNewest!.x;
  pred = predictInput(pred, { seq: 2, input: { ...IDLE_INPUT, right: true, sprint: true, shots: 1 }, dtMs: TICK_MS, ability: null }, [], pace, 0, 6000);
  assert.ok(Math.abs(pred.afterNewest!.x - x1 - (200 * TICK_MS) / 1000) < 0.01, `walk pace on the click's tick (${pred.afterNewest!.x - x1})`);
});

test('chat cheats: a code works for its typist only, never shows in chat, and lives only on the server', async () => {
  const { readFileSync, readdirSync } = await import('node:fs');
  const { createRoom } = await import('../src/server/room.ts');
  const { fakeSocket, PISTOL } = await import('./helpers.ts');
  const { LEVELS, WORLD } = await import('../src/shared/defs.ts');
  const { damagePlayer } = await import('../src/shared/sim/combat.ts');
  const accounts = { stats: () => null, nameForToken: () => null, credit: () => {} } as unknown as Parameters<typeof createRoom>[3];
  const room = createRoom('c-x', 'FFA', 1, accounts);
  const a = fakeSocket(), b = fakeSocket();
  try {
    for (const s of [a, b]) room.connect(s.socket);
    a.send({ t: 'join', name: 'Ann', loadout: PISTOL, aspect: 1.5 });
    b.send({ t: 'join', name: 'Ben', loadout: PISTOL, aspect: 1.5 });
    const ann = room.world.players.get((a.sent.find((m) => m.t === 'welcome') as { id: number }).id)!;
    a.send({ t: 'chat', text: '!levelup' });
    assert.equal(ann.level, 1, 'one level up');
    assert.ok(ann.score >= LEVELS[1]!.score);
    assert.ok(!b.sent.some((m) => m.t === 'chat' && m.text.includes('levelup')), 'nobody else sees the code');
    await new Promise((r) => setTimeout(r, 1100));
    a.send({ t: 'chat', text: '!EasyMode ' });
    assert.equal(ann.easy, true);
    const bot = [...room.world.players.values()].find((p) => p.kind === 'bot')!;
    if (ann.life.k === 'alive') { ann.life.shieldUntil = -Infinity; ann.life.hp = 100; }
    damagePlayer(room.world, ann, 40, { attacker: bot, team: bot.team, label: 'test', piercing: true, via: 'bullet', fromX: bot.x, fromY: bot.y });
    assert.ok(ann.life.k === 'alive' && Math.abs(ann.life.hp - 80) < 1e-9, `half of a bot's 40 (hp ${ann.life.k === 'alive' ? ann.life.hp : 0})`);
    assert.ok(WORLD.baseHp === 100);
  } finally {
    room.close(); a.close(); b.close();
  }
  const client = readdirSync('src/client').filter((f) => f.endsWith('.ts')).map((f) => readFileSync(`src/client/${f}`, 'utf8')).join('\n');
  assert.ok(!client.includes('!levelup') && !client.includes('!easymode') && !client.includes('cheats.ts'), 'no code or cheat module in the page');
});
