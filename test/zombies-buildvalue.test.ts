/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TurretKind, ZombieKind } from '../src/shared/defs.ts';
import { buildMatrix, dominatedPairs, upgradeRoi, winsOf, type Metric } from '../scripts/lib/zombiebuilds.ts';

// What a scrap buys (scripts/bench-zombie-builds.ts has the whole table): each buildable in the scripted lane of scripts/lib/zombiebuilds.ts, the core
// walled in and the horde streaming in from the south. The runs are seeded, so the numbers are the same every time.
const rows = buildMatrix({ seeds: [1], nights: [5], ms: 60_000 });

test('no buildable is dominated: none is at least as good as another on every axis and better on one', () => {
  assert.deepEqual(dominatedPairs(rows), [], rows.map((r) => `${r.name}: ${JSON.stringify(r.at)}`).join('\n'));
});

test('every turret, wall tier and utility is the best of its kind somewhere, and each is the buy it is meant to be', () => {
  const wins = winsOf(rows);
  for (const [name, axes] of wins) assert.ok(axes.length > 0, `${name} wins nowhere`);
  const has = (name: string, axis: string) => assert.ok(wins.get(name)?.includes(axis as never), `${name} wins ${wins.get(name)?.join(', ')}, not ${axis}`);
  // Each turret's job, not its stat line: the cheap all-rounder, the crowd breaker that buys time, the heavy killer whose round goes through a line, the long reach
  // that thins packs far out, the coil whose marks make the squad's guns hit harder, and the vent that burns everything through a chokepoint.
  has('Sentry', 'cheap');
  has('Scatter', 'timeBought');
  has('Cannon', 'vsHeavy');
  has('Cannon', 'pierce');
  has('Mortar', 'range');
  has('Mortar', 'farHarm');
  has('Tesla coil', 'gunBoost');
  has('Flame vent', 'chokepoint');
  has('Barricade', 'cheap');
  has('Barricade', 'mendSpeed');
  has('Sandbag wall', 'hpPerScrap');
  has('Steel wall', 'hpPerCell');
  has('Steel wall', 'burstHpPerScrap');
  has('Salvage yard', 'scrapReturn');
  has('Medic post', 'squadSustain');
  has('Spike strip', 'slow');
  has('Decoy beacon', 'aggroPull');
});

test('a step up pays at least what a second level-I copy would where the turret is built for, and a maxed turret is not twice the buy of a fresh one', () => {
  // Each turret at what it is for: the cheap sentry against the night's own mix, the scatter's walk bought, the cannon against brutes, the mortar against bloaters,
  // the coil's marks, the vent through a chokepoint.
  const niche: Record<TurretKind, { kinds?: ZombieKind[]; metric?: Metric; gap?: boolean }> = {
    sentry: {}, scatter: { metric: 'timeBought' }, cannon: { kinds: ['brute'] }, mortar: { metric: 'farHarm', gap: true }, tesla: { metric: 'marked' }, vent: { gap: true },
  };
  for (const [kind, n] of Object.entries(niche) as [TurretKind, (typeof niche)[TurretKind]][]) {
    const roi = upgradeRoi(kind, { ...n, nights: n.kinds ? [5] : [3, 5, 7], ms: 60_000 });
    const say = `${kind}: copy ${roi.copy.toFixed(1)}, steps ${roi.steps.map((s) => s.toFixed(1)).join(' ')}, levels ${roi.levels.map((s) => s.toFixed(1)).join(' ')}`;
    assert.ok(roi.steps.every((s) => s >= roi.copy), say);
    assert.ok(roi.levels[2] < 2 * roi.levels[0], say);
  }
});
