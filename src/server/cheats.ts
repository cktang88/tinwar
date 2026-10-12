import { LEVELS } from '../shared/defs.ts';
import { levelForScore } from '../shared/sim/stats.ts';
import type { Player } from '../shared/sim/world.ts';

/**
 * Chat cheat codes. They live only here on the server (never in the page's bundle), and each can be changed without a code change through
 * an environment variable, so a deployment can keep its own codes secret even though this repository's defaults are readable:
 * - `TINWAR_CHEAT_LEVELUP` (default `!levelup`): the score up to the next level pick, at once.
 * - `TINWAR_CHEAT_EASY` (default `!easymode`): toggles bots dealing half damage to you, for the rest of your stay in the room.
 * A code typed in chat is never shown to anyone; only its typist is told what it did.
 */
export type Cheat = 'levelup' | 'easy';

const codes = (): Map<string, Cheat> => new Map([
  [(process.env.TINWAR_CHEAT_LEVELUP ?? '!levelup').trim().toLowerCase(), 'levelup'],
  [(process.env.TINWAR_CHEAT_EASY ?? '!easymode').trim().toLowerCase(), 'easy'],
]);

/** The cheat a chat line is, if it is exactly one of the codes (case and surrounding spaces aside). */
export const cheatFor = (text: string): Cheat | null => codes().get(text.trim().toLowerCase()) ?? null;

/** Applies `cheat` to `p` and says what it did, for its typist only. */
export function applyCheat(p: Player, cheat: Cheat): string {
  if (cheat === 'easy') {
    p.easy = !p.easy;
    return p.easy ? 'Easy mode on: bots deal you half damage.' : 'Easy mode off.';
  }
  if (p.life.k !== 'alive') return 'Level up works while you are alive.';
  const next = LEVELS[p.level + 1];
  if (!next) return 'You are already at the top of the ladder.';
  p.score = Math.max(p.score, next.score);
  p.level = Math.max(p.level, levelForScore(p.score));
  return 'Levelled up: your next pick is ready.';
}
