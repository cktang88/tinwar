import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Accounts } from '../src/server/accounts.ts';
import { createRoom } from '../src/server/room.ts';
import { fakeSocket, PISTOL } from './helpers.ts';

const accounts = { stats: () => null, nameForToken: () => null, credit: () => {} } as unknown as Accounts;

const botNames = (room: ReturnType<typeof createRoom>) => [...room.world.players.values()].filter((p) => p.kind === 'bot').map((p) => p.name).sort();

/** A room lives as long as the server, so each match must bring a new lobby of bots: the same names round after round read as a dead server. */
test('every new match seats a fresh set of bots, none of them from the match before', () => {
  const room = createRoom('ffa', 'FFA', 7, accounts);
  const ws = fakeSocket();
  room.connect(ws.socket);
  ws.send({ t: 'join', name: 'Regular', loadout: PISTOL, aspect: 1.6 });
  const lobbies: string[][] = [];
  for (let m = 0; m < 3; m++) {
    for (let t = 0; t < 120; t++) { room.tick(); ws.sent.length = 0; }
    lobbies.push(botNames(room));
    // The map changes and a new match starts (as in round-reset.test.ts).
    room.world.mapChangeAt = room.world.now;
    for (let t = 0; t < 400 && room.world.match.k === 'playing'; t++) { room.tick(); ws.sent.length = 0; }
    for (let t = 0; t < 2000 && room.world.match.k !== 'playing'; t++) { room.tick(); ws.sent.length = 0; }
  }
  room.close();
  ws.close();
  for (const lobby of lobbies) assert.ok(lobby.length >= 4, `a lobby of ${lobby.length} bots`);
  for (let i = 1; i < lobbies.length; i++) {
    const again = lobbies[i]!.filter((n) => lobbies[i - 1]!.includes(n));
    assert.deepEqual(again, [], `match ${i + 1} kept ${again.join(', ')} from the match before`);
  }
});
