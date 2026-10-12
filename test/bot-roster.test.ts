import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Accounts } from '../src/server/accounts.ts';
import { LIMITS } from '../src/server/limits.ts';
import { LOBBY } from '../src/server/lobby.ts';
import { createRoom } from '../src/server/room.ts';
import { fakeSocket, PISTOL } from './helpers.ts';

const accounts = { stats: () => null, nameForToken: () => null, credit: () => {} } as unknown as Accounts;

const botsOf = (room: ReturnType<typeof createRoom>) => [...room.world.players.values()].filter((p) => p.kind === 'bot');

/**
 * A room lives as long as the server, and its lobby should read as people: some stay on for another round, the rest leave and newcomers
 * take their seats. Never the whole lobby swapped at once (a dead giveaway), nor the same faces forever.
 */
test('between matches some bots stay for another round and the rest are new faces, none of them a name that just left', () => {
  const room = createRoom('ffa', 'FFA', 7, accounts);
  const ws = fakeSocket();
  room.connect(ws.socket);
  ws.send({ t: 'join', name: 'Regular', loadout: PISTOL, aspect: 1.6 });
  const lobbies: { id: number; name: string; color: string }[][] = [];
  for (let m = 0; m < 4; m++) {
    for (let t = 0; t < 120; t++) { room.tick(); ws.sent.length = 0; }
    lobbies.push(botsOf(room).map((p) => ({ id: p.id, name: p.name, color: p.loadout.color })));
    // The map changes and a new match starts (as in round-reset.test.ts).
    room.world.mapChangeAt = room.world.now;
    for (let t = 0; t < 400 && room.world.match.k === 'playing'; t++) { room.tick(); ws.sent.length = 0; }
    for (let t = 0; t < 2000 && room.world.match.k !== 'playing'; t++) { room.tick(); ws.sent.length = 0; }
  }
  room.close();
  ws.close();
  for (const lobby of lobbies) {
    assert.ok(lobby.length >= 4, `a lobby of ${lobby.length} bots`);
    assert.equal(new Set(lobby.map((b) => b.name.toLowerCase())).size, lobby.length, 'no name twice in a match');
  }
  for (let i = 1; i < lobbies.length; i++) {
    const before = lobbies[i - 1]!, now = lobbies[i]!;
    const stayed = now.filter((b) => before.some((o) => o.id === b.id));
    const share = stayed.length / before.length;
    assert.ok(share >= LOBBY.keep[0] - 0.1 && share <= LOBBY.keep[1] + 0.1, `match ${i + 1} kept ${stayed.length} of ${before.length}`);
    assert.ok(now.length - stayed.length > 0, `match ${i + 1} brought newcomers`);
    // One who stayed is the same player: same name, same colour.
    for (const b of stayed) assert.deepEqual(b, before.find((o) => o.id === b.id));
    const leavers = before.filter((o) => !now.some((b) => b.id === o.id)).map((o) => o.name);
    const newcomers = now.filter((b) => !before.some((o) => o.id === b.id)).map((b) => b.name);
    assert.deepEqual(newcomers.filter((n) => leavers.includes(n)), [], `match ${i + 1} reused a leaver's name`);
  }
});

test('mid-match a bot leaves now and then and a newcomer takes its seat a few seconds later, never under a name that left', () => {
  const saved = structuredClone(LOBBY);
  // Sessions of seconds, not minutes, so a minute of play shows the churn.
  Object.assign(LOBBY, { session: { medianMs: 9000, logSd: 0.3, minMs: 5000, maxMs: 15000 }, graceMs: 4000, gapMs: 6000, tailMs: 0, slackPerTick: 0 });
  try {
    const room = createRoom('ffa', 'FFA', 5, accounts, 1, { ...LIMITS, minPlayers: 7 });
    const ws = fakeSocket();
    room.connect(ws.socket);
    ws.send({ t: 'join', name: 'Regular', loadout: PISTOL, aspect: 1.6 });
    room.world.mapChangeAt = Infinity;
    // The bot Ann's seat made surplus leaves within 10 s; the churn is measured after.
    for (let t = 0; t < 30 * 11; t++) { room.tick(); ws.sent.length = 0; }
    const target = 6;
    const left: { at: number; name: string }[] = [];
    const seen = new Map<number, string>(botsOf(room).map((p) => [p.id, p.name]));
    const joinedNames: string[] = [];
    let shortSince: number | null = null, longestShort = 0;
    for (let t = 0; t < 30 * 75; t++) {
      room.tick();
      ws.sent.length = 0;
      const now = room.world.now, bots = botsOf(room);
      assert.equal(room.world.match.k, 'playing');
      for (const [id, name] of seen) if (!room.world.players.has(id)) { left.push({ at: now, name }); seen.delete(id); }
      for (const p of bots) {
        if (seen.has(p.id)) continue;
        assert.ok(!left.some((l) => l.name.toLowerCase() === p.name.toLowerCase()), `${p.name} joined under a name that left this match`);
        seen.set(p.id, p.name);
        joinedNames.push(p.name);
      }
      assert.equal(new Set(bots.map((p) => p.name.toLowerCase())).size, bots.length, 'no name twice at once');
      if (bots.length < target) { shortSince ??= now; longestShort = Math.max(longestShort, now - shortSince); } else shortSince = null;
    }
    room.close();
    ws.close();
    assert.ok(left.length >= 3, `${left.length} left in 75 s`);
    // The last leave may still be waiting for its newcomer.
    assert.ok(joinedNames.length >= left.length - 1, `${joinedNames.length} joined, ${left.length} left`);
    for (let i = 1; i < left.length; i++) assert.ok(left[i]!.at - left[i - 1]!.at >= LOBBY.gapMs - 1, 'leaves are spaced out');
    assert.ok(longestShort <= LOBBY.refillMs[1] + 100, `a seat stood empty ${longestShort} ms`);
  } finally {
    Object.assign(LOBBY, saved);
  }
});

test('at the real pace, a room loses about one bot every few minutes, not a stream of them', () => {
  // Sessions run 6 to 60 minutes, and leaves are held 2.5 minutes apart: a 17-bot room over an hour sees at most 24 leaves mid-match.
  assert.ok(LOBBY.gapMs >= 120_000);
  assert.ok(LOBBY.session.minMs >= 5 * 60_000 && LOBBY.session.medianMs >= 15 * 60_000);
});

test('a person joining or leaving never moves a bot the same tick: a surplus bot leaves seconds later, a missing one arrives seconds later', () => {
  for (const mode of ['FFA', 'TDM'] as const) {
    const room = createRoom(mode.toLowerCase(), mode, 11, accounts);
    const a = fakeSocket(), b = fakeSocket();
    room.connect(a.socket);
    a.send({ t: 'join', name: 'Ann', loadout: PISTOL, aspect: 1.6 });
    for (let t = 0; t < 30 * 12; t++) { room.tick(); a.sent.length = 0; }
    const ids = () => botsOf(room).map((p) => p.id).sort();
    const before = ids();
    room.connect(b.socket);
    b.send({ t: 'join', name: 'Ben', loadout: PISTOL, aspect: 1.6 });
    assert.deepEqual(ids(), before, `${mode}: no bot left the tick Ben joined`);
    room.tick();
    const firstChange: number[] = [];
    let last = ids(), at = room.world.now;
    for (let t = 0; t < 30 * 15; t++) {
      room.tick(); a.sent.length = 0; b.sent.length = 0;
      if (ids().join() !== last.join()) { firstChange.push(room.world.now - at); last = ids(); }
    }
    assert.ok(firstChange.length > 0 && firstChange[0]! >= 1500, `${mode}: the first bot change came ${firstChange[0]} ms after the join`);
    assert.ok(room.world.players.size <= LIMITS.minPlayers + 2, 'never past the room\'s seats');
    // Ben leaves: no bot arrives the same tick.
    const now = ids();
    b.close();
    assert.deepEqual(ids(), now, `${mode}: no bot arrived the tick Ben left`);
    room.close();
    a.close();
  }
});
