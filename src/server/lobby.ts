import { whim } from './bots.ts';

/**
 * How a room's bots come and go, so a lobby reads as people who drift in and out rather than a cast swapped wholesale each round:
 * - between matches, `keep` of them (a share drawn per match) stay for another round, those whose session has run out going first; the
 *   rest leave and newcomers (never a leaver's name) take their seats;
 * - mid-match, a bot whose session (`sessionMs`) has run out leaves at its next death, or `graceMs` later if it never dies, but never
 *   within `gapMs` of the match's start or the room's last leave, nor in a match's last `tailMs`; its seat fills `refillMs` later.
 * With a 17-bot room, sessions of a quarter to three quarters of an hour and the gap, that is about one leave every few minutes.
 */
export const LOBBY = {
  keep: [0.4, 0.7] as const,
  session: { medianMs: 22 * 60_000, logSd: 0.45, minMs: 6 * 60_000, maxMs: 60 * 60_000 },
  graceMs: 60_000,
  gapMs: 150_000,
  tailMs: 30_000,
  refillMs: [3000, 8000] as const,
};

/** How long a bot named `name`, joining at server time `at`, means to play: the same each time for the same room and moment. */
export function sessionMs(name: string, seed: number, at: number): number {
  const r = whim(`session:${seed}:${name}:${at}`);
  const z = Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  const { medianMs, logSd, minMs, maxMs } = LOBBY.session;
  return Math.max(minMs, Math.min(maxMs, medianMs * Math.exp(logSd * z)));
}

/** How long after a mid-match leave the newcomer takes the seat. */
export const refillMs = (seed: number, at: number): number => LOBBY.refillMs[0] + whim(`refill:${seed}:${at}`)() * (LOBBY.refillMs[1] - LOBBY.refillMs[0]);

/**
 * Which bots stay for the next match: a share in `LOBBY.keep` drawn from `rand`, the ones whose session is over leaving first and the rest
 * drawn at random. `ids` with their session end (`leaveAt`, server time).
 */
export function stayers(ids: readonly number[], leaveAt: (id: number) => number, now: number, rand: () => number): Set<number> {
  const share = LOBBY.keep[0] + rand() * (LOBBY.keep[1] - LOBBY.keep[0]);
  const want = Math.round(ids.length * share);
  const fresh = ids.filter((id) => leaveAt(id) > now);
  // A shuffle by the room's stream, so who stays is the room's draw.
  for (let i = fresh.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [fresh[i], fresh[j]] = [fresh[j]!, fresh[i]!]; }
  return new Set(fresh.slice(0, want));
}
