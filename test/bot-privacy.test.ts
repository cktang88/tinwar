import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { Accounts } from '../src/server/accounts.ts';
import { botBadge, botProfile, isBotName } from '../src/server/botprofile.ts';
import { BOT_NAMES } from '../src/server/bots.ts';
import { startServer } from '../src/server/main.ts';
import { createRoom } from '../src/server/room.ts';
import { botLevel } from '../src/shared/cosmetics.ts';
import type { Snapshot, SnapshotWire } from '../src/shared/protocol.ts';
import { fillSnapshot } from '../src/shared/wire.ts';
import { fakeSocket, PISTOL } from './helpers.ts';

const accounts = { stats: () => null, nameForToken: () => null, credit: () => {} } as unknown as Accounts;

/** Nothing a client is sent tells a bot from a person: not the players, not the board, not the room list (see e2e.test.ts). */
test('no snapshot a person is sent says who is a bot: no kind on anyone but themself, no human on a board row', () => {
  for (const mode of ['TDM', 'FFA'] as const) {
    const room = createRoom(mode.toLowerCase(), mode, 4, accounts);
    const a = fakeSocket(), b = fakeSocket();
    room.connect(a.socket);
    room.connect(b.socket);
    a.send({ t: 'join', name: 'Ann', loadout: PISTOL, aspect: 1.6 });
    b.send({ t: 'join', name: 'Ben', loadout: PISTOL, aspect: 1.6 });
    const me = (a.sent.find((m) => m.t === 'welcome') as { id: number }).id;
    let last: Snapshot | null = null, snaps = 0, others = 0;
    const ben = (b.sent.find((m) => m.t === 'welcome') as { id: number }).id;
    const bot = [...room.world.players.values()].find((p) => p.kind === 'bot')!;
    for (let t = 0; t < 90; t++) {
      // Another person and a bot stand beside Ann, so her snapshots carry both.
      const ann = room.world.players.get(me)!;
      for (const [id, dx] of [[ben, 120], [bot.id, -120]] as const) { const q = room.world.players.get(id); if (q) { q.x = ann.x + dx; q.y = ann.y; } }
      room.tick();
      for (const m of a.sent.splice(0)) {
        if (m.t !== 'snap') continue;
        const raw = JSON.stringify(m);
        assert.doesNotMatch(raw, /"kind":"bot"/, 'a bot is never named as one');
        assert.doesNotMatch(raw, /"human":/, 'a board row never marks a person');
        last = fillSnapshot(m as unknown as SnapshotWire, last);
        snaps++;
        for (const p of last!.players) {
          if (p.id === me) assert.equal(p.kind, 'human', 'a person still knows what they are (their bloom rules)');
          else { assert.ok(!('kind' in p), `${p.name} carries a kind`); others++; }
        }
        for (const r of last!.leaderboard) assert.ok(!('human' in r));
      }
      b.sent.length = 0;
    }
    assert.ok(snaps > 50 && others > 100, `${snaps} snapshots, ${others} other players seen`);
    // The server still knows, for moderation and logs.
    assert.ok([...room.world.players.values()].some((p) => p.kind === 'bot'));
    assert.equal(room.info().humans, 2);
    room.close();
    a.close();
    b.close();
  }
});

test('a bot has a service record like anyone: the same every time from its name, a casual player\'s numbers, never level 1', () => {
  const now = Date.UTC(2026, 9, 12);
  const levels = new Set<number>();
  for (const name of BOT_NAMES) {
    const p = botProfile(name, now);
    assert.deepEqual(botProfile(name, now), p, 'deterministic');
    assert.equal(p.level, botLevel(name), 'the level on its name plate');
    assert.ok(p.level >= 3 && p.level <= 60, `${name} level ${p.level}`);
    levels.add(p.level);
    assert.ok(p.games >= 3 && p.kills > p.games && p.deaths > 0, `${name}: ${p.games} games, ${p.kills} kills, ${p.deaths} deaths`);
    const kd = p.kills / p.deaths;
    assert.ok(kd > 0.5 && kd < 1.5, `${name} K/D ${kd.toFixed(2)}`);
    assert.ok(Object.keys(p.medals).length >= 5 && Object.keys(p.badges).length >= 1, `${name} has medals and lifetime medals`);
    assert.ok(p.firstSeen < p.lastSeen && p.lastSeen <= now);
    assert.ok(p.unlocked.length > 0);
    assert.deepEqual(botBadge(name), botBadge(name));
  }
  assert.ok(levels.size >= 20, `levels vary: ${levels.size} distinct`);
  assert.ok(isBotName('TheoPlays') && isBotName('theoplays') && isBotName('TheoPlays2') && isBotName('TheoPlays 47'));
  assert.ok(!isBotName('Somebody') && !isBotName('Ann'));
});

test('a bot in a room wears its level and its record\'s medal, as a person with a profile does', () => {
  const room = createRoom('ffa', 'FFA', 9, accounts);
  const ws = fakeSocket();
  room.connect(ws.socket);
  ws.send({ t: 'join', name: 'Ann', loadout: PISTOL, aspect: 1.6 });
  const bots = [...room.world.players.values()].filter((p) => p.kind === 'bot');
  assert.ok(bots.length > 0);
  for (const b of bots) {
    assert.equal(b.cos?.l, botLevel(b.name));
    assert.deepEqual(b.badge, botBadge(b.name));
  }
  room.close();
  ws.close();
});

test('/api/profile answers for a bot\'s name as for a person\'s, and 404s a name nobody has played under', { timeout: 20_000 }, async () => {
  const server = await startServer({ port: 0, dataDir: await mkdtemp(join(tmpdir(), 'tinwar-botprofile-')) });
  try {
    const get = async (name: string) => { const r = await fetch(`http://localhost:${server.port}/api/profile/${encodeURIComponent(name)}`); return { status: r.status, body: (await r.json()) as Record<string, unknown> }; };
    const bot = await get('TheoPlays');
    assert.equal(bot.status, 200);
    assert.equal(bot.body.name, 'TheoPlays');
    assert.equal(bot.body.level, botLevel('TheoPlays'));
    for (const key of ['kills', 'deaths', 'games', 'medals', 'badges', 'featured', 'xpInLevel', 'unlocked', 'equipped', 'challenges']) assert.ok(key in bot.body, key);
    assert.ok(!('owner' in bot.body));
    assert.equal((await get('NoSuchPerson')).status, 404);
  } finally {
    await server.close();
  }
});
