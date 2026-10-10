import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GUNS, HORDE_GUN_MUL, PERK_INFO, PERK_TIERS, perkLine, WORLD, type PerkId, type ZombieKind } from '../src/shared/defs.ts';
import { damagePlayer } from '../src/shared/sim/combat.ts';
import { tickHorde } from '../src/shared/sim/horde.ts';
import { damageZombie, zombieMaxHp } from '../src/shared/sim/run.ts';
import { snapshotFor } from '../src/shared/sim/snapshot.ts';
import { effectiveStats, falloffMul, PERK_RULES } from '../src/shared/sim/stats.ts';
import { createWorld, newId, type Player, type World, type Zombie } from '../src/shared/sim/world.ts';
import { aiOf } from '../src/shared/sim/boids.ts';
import { equip, hpOf, press, run, shootOnce, spawnAt, TICK_MS } from './helpers.ts';

/** A quiet night on the Outpost, so only what a test places takes part (as in test/zombies-combat.test.ts). */
function nightWorld(): World {
  const w = createWorld('ZOM', 1, 'outpost');
  w.run!.phase = { k: 'night', toSpawn: [], nextSpawnAt: Infinity, dawnAt: Infinity };
  w.run!.core.hp = 1e9;
  return w;
}

const X = 1475, Y = 1700, DOWN = Math.PI / 2;

function addZombie(w: World, kind: ZombieKind, x: number, y: number, hp = zombieMaxHp(kind, 1, 1)): Zombie {
  const z: Zombie = { id: newId(w), kind, x, y, hp, attackAt: Infinity, vx: 0, vy: 0 };
  w.zombies.push(z);
  return z;
}

const holding = (p: Player, perk: PerkId) => {
  const tier = ([1, 2, 3] as const).find((t) => (PERK_TIERS[t] as readonly string[]).includes(perk))!;
  p.perks = { [tier]: perk };
};

/** What one pistol round down the lane takes off a brute (no shove, no hold, so nothing but the damage differs). */
function roundOnBrute(setup: (w: World, p: Player, z: Zombie) => void = () => {}): number {
  const w = nightWorld();
  const p = spawnAt(w, X, Y);
  const z = addZombie(w, 'brute', X, Y + 200, 1000);
  setup(w, p, z);
  shootOnce(w, p, DOWN);
  return 1000 - z.hp;
}

test('every pick says what it does in one short line, and those built for versus say what they do in Zombies instead', () => {
  const pvpOnly: PerkId[] = ['thermal', 'ghillie', 'silencer', 'shield', 'adrenaline', 'bloodlust', 'recon', 'ninja', 'tracker', 'brace', 'radar', 'knife', 'engineer'];
  for (const perk of [...PERK_TIERS[1], ...PERK_TIERS[2], ...PERK_TIERS[3]] as PerkId[]) {
    const { desc, zom } = PERK_INFO[perk];
    for (const line of [desc, zom ?? '']) assert.ok(!line.includes('\n') && line.length <= 160, `${perk}: one short line`);
    if (pvpOnly.includes(perk)) assert.ok(zom && zom !== desc, `${perk} says what it does against the horde`);
    assert.equal(perkLine(perk, true), zom ?? desc);
    assert.equal(perkLine(perk, false), desc);
  }
  const names = new Set(Object.values(PERK_INFO).map((i) => i.name));
  assert.equal(names.size, Object.keys(PERK_INFO).length, 'no two picks share a name (the Shield perk and the Shield wall ability)');
});

test('Silencer: rounds deal +20% to a zombie that is not chasing their shooter', () => {
  const plain = roundOnBrute();
  const quiet = roundOnBrute((_, p) => holding(p, 'silencer'));
  assert.ok(Math.abs(quiet / plain - PERK_RULES.silencer.unawareMul) < 1e-9, `${quiet} vs ${plain}`);
  const chased = roundOnBrute((w, p, z) => { holding(p, 'silencer'); const ai = aiOf(z, w.now); ai.tgt = 'player'; ai.pid = p.id; });
  assert.ok(Math.abs(chased - plain) < 1e-9, 'one already after you gets no surprise');
});

test('Tracker: a zombie you hit is marked 4 s, the squad\'s guns deal it +15%, and it shows on every squad minimap', () => {
  const w = nightWorld();
  const tracker = spawnAt(w, X, Y);
  holding(tracker, 'tracker');
  const mate = spawnAt(w, X + 60, Y);
  const z = addZombie(w, 'brute', X, Y + 200, 5000);
  shootOnce(w, tracker, DOWN, 100);
  assert.ok((z.tracked ?? 0) > w.now, 'marked');
  const before = z.hp;
  shootOnce(w, mate, Math.atan2(z.y - mate.y, z.x - mate.x), 100);
  const plainHit = GUNS.pistol.damage * HORDE_GUN_MUL;
  assert.ok(Math.abs((before - z.hp) / plainHit - PERK_RULES.tracker.zombieMul) < 1e-6, `${before - z.hp} vs ${plainHit}`);
  for (const p of [tracker, mate]) assert.ok(snapshotFor(w, p.id).minimap.some((m) => m.zombie && m.marked), 'on the squad\'s minimaps');
  run(w, PERK_RULES.tracker.ms + 200);
  assert.ok(!snapshotFor(w, mate.id).minimap.some((m) => m.zombie), 'gone when the mark runs out');
});

test('Bloodlust heals a share of the harm dealt to zombies; Adrenaline and Fast hands pay out on a zombie kill', () => {
  const w = nightWorld();
  const p = spawnAt(w, X, Y);
  equip(p, 'assault');
  holding(p, 'bloodlust');
  if (p.life.k === 'alive') p.life.hp = 50;
  const z = addZombie(w, 'brute', X, Y + 300, 5000);
  damageZombie(w, z, 400, p);
  assert.ok(Math.abs(hpOf(p) - (50 + 400 * PERK_RULES.bloodlust.zombieShare)) < 1e-9);
  holding(p, 'adrenaline');
  damageZombie(w, addZombie(w, 'walker', X, Y + 300), 1e4, p);
  assert.ok(p.life.k === 'alive' && p.life.rushUntil > w.now, 'a zombie kill brings the rush');
  holding(p, 'fastHands');
  if (p.life.k === 'alive') p.life.ammo = 0;
  damageZombie(w, addZombie(w, 'walker', X, Y + 300), 1e4, p);
  assert.equal(p.life.k === 'alive' && p.life.ammo, Math.round(PERK_RULES.fastHands.zombieShare * effectiveStats(p).mag));
});

test('Shield turns a third of a bite from the front, not from behind', () => {
  const bite = (perk: PerkId | null, fromFront: boolean) => {
    const w = nightWorld();
    const p = spawnAt(w, X, Y);
    if (perk) holding(p, perk);
    p.angle = 0;
    damagePlayer(w, p, 30, { attacker: null, team: null, label: 'Walker', piercing: false, via: 'bite', fromX: p.x + (fromFront ? 30 : -30), fromY: p.y });
    return effectiveStats(p).maxHp - hpOf(p);
  };
  assert.equal(bite(null, true), 30);
  assert.ok(Math.abs(bite('shield', true) - 30 * 0.67) < 1e-9);
  assert.equal(bite('shield', false), 30);
});

test('Ghillie suit: standing still, the horde loses you unless it all but bumps into you; Ninja is noticed nearer', () => {
  /** Whether a walker `d` px off turns on `p` after a few evaluations. */
  const chases = (perk: PerkId | null, d: number, still = true) => {
    const w = nightWorld();
    const p = spawnAt(w, X, Y);
    if (perk) holding(p, perk);
    if (p.life.k === 'alive') p.life.lastMoveAt = still ? w.now - 5000 : w.now;
    const z = addZombie(w, 'walker', X, Y + d);
    for (let t = 0; t < 400; t += TICK_MS) { if (!still && p.life.k === 'alive') p.life.lastMoveAt = w.now; tickHorde(w, w.run!, TICK_MS); w.now += TICK_MS; z.y = Y + d; }
    return z.ai?.tgt === 'player' && z.ai.pid === p.id;
  };
  assert.ok(chases(null, 250), 'a walker turns on a player 250 px off');
  assert.ok(!chases('ghillie', 250), 'but not on a still Ghillie suit');
  assert.ok(chases('ghillie', 250, false), 'one on the move is fair game');
  assert.ok(chases('ghillie', 80), 'and one it bumps into');
  assert.ok(!chases('ninja', 250), 'a Ninja 250 px off goes unnoticed (a walker\'s pull reaches 340 px, a Ninja\'s 204)');
  assert.ok(chases('ninja', 150));
});

test('Brace: your rounds shove a zombie 75% harder', () => {
  const shove = (perk: PerkId | null) => {
    const w = nightWorld();
    const p = spawnAt(w, X, Y);
    if (perk) holding(p, perk);
    const z = addZombie(w, 'walker', X, Y + 200, 1e4);
    press(w, p, { angle: DOWN, fire: true, shots: p.input.shots + 1 });
    for (let i = 0; i < 6 && !z.knock; i++) run(w, TICK_MS);
    return z.knock ? Math.hypot(z.knock.vx, z.knock.vy) : 0;
  };
  const plain = shove(null), braced = shove('brace');
  assert.ok(plain > 0 && Math.abs(braced / plain - PERK_RULES.brace.zombieShove) < 0.02, `${braced} vs ${plain}`);
});

test('Knife: against the horde it strikes for triple, grown with the night, killing a walker outright and stunning a plated', () => {
  for (const night of [1, 6]) {
    const w = nightWorld();
    w.run!.night = night;
    const p = spawnAt(w, X, Y);
    p.perks = { 3: 'knife' };
    const z = addZombie(w, 'walker', X, Y + 70, zombieMaxHp('walker', night, 1));
    press(w, p, { angle: DOWN, ability: true });
    run(w, TICK_MS * 3);
    assert.ok(!w.zombies.includes(z), `night ${night}: the walker is dead`);
  }
  const w = nightWorld();
  const p = spawnAt(w, X, Y);
  p.perks = { 3: 'knife' };
  const z = addZombie(w, 'plated', X, Y + 70, 1000);
  press(w, p, { angle: DOWN, ability: true });
  run(w, TICK_MS * 3);
  assert.ok(Math.abs(1000 - z.hp - 150) < 1e-6, `${1000 - z.hp}`);
  assert.ok(z.slow && z.slow.mul === 0 && z.slow.until > w.now, 'stunned');
});

test('Radar: a sensor marks every zombie in its ring for the squad', () => {
  const w = nightWorld();
  const p = spawnAt(w, X, Y);
  p.perks = { 3: 'radar' };
  const near = addZombie(w, 'brute', X, Y + 600, 1e4), far = addZombie(w, 'brute', X, Y - 1200, 1e4);
  press(w, p, { angle: DOWN, aimDist: 400, ability: true });
  run(w, 1000);
  assert.ok((near.tracked ?? 0) > w.now, `near ${near.tracked} at ${w.now}`);
  assert.ok((far.tracked ?? 0) <= w.now, `far ${far.tracked} ${Math.round(far.x)},${Math.round(far.y)}`);
});

test('Thermal shows zombies just past your screen on your minimap; Recon shows the next packs to walk in by night', () => {
  const w = nightWorld();
  const p = spawnAt(w, X, Y);
  const z = addZombie(w, 'walker', X, Y + WORLD.viewRadius * 1.25);
  addZombie(w, 'walker', X, Y + WORLD.viewRadius * 1.6);
  const zombieDots = () => snapshotFor(w, p.id).minimap.filter((m) => m.zombie);
  assert.equal(zombieDots().length, 0);
  holding(p, 'thermal');
  assert.deepEqual(zombieDots().map((m) => Math.round(m.y)), [Math.round(z.y)]);
  assert.equal(snapshotFor(w, p.id).self.scout, undefined);
  holding(p, 'recon');
  assert.equal(snapshotFor(w, p.id).self.scout, undefined, 'nothing to scout with no packs to come');
  w.run!.phase = { k: 'night', toSpawn: [{ kind: 'brute', side: 'east', n: 2 }, { kind: 'walker', side: 'north', n: 6 }], nextSpawnAt: Infinity, dawnAt: Infinity };
  assert.deepEqual(snapshotFor(w, p.id).self.scout, { sides: [1, 0], packs: [[1, 1, 2], [0, 0, 6]] });
});

test('Long range moves the damage falloff out with the reach', () => {
  const f = 'smg';
  assert.equal(falloffMul(f, 240, PERK_RULES.longRange.falloffMul), 1, 'full damage past the plain SMG\'s 180 px');
  assert.ok(falloffMul(f, 240) < 1);
  assert.ok(Math.abs(falloffMul(f, 380 * 1.4, 1.4) - falloffMul(f, 380)) < 1e-9, 'the floor comes 40% later');
});
