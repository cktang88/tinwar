/**
 * The social layer: what a bot says and does that has nothing to do with winning. In a real io lobby most people say nothing; a few type
 * "gg", "lag", "?" or "nice shot" a couple of seconds after a death or a kill, wave, spin after a kill, wiggle on the spot, fire a couple of
 * rounds at nothing, or spin at a stranger to say "let's not" and hold fire if the stranger spins back. A bot does the same, rarely, by its
 * own traits (all hashed from its name):
 * - **Chattiness** (`soc`): one bot in five is chatty (one in ten of those twice as chatty) and talks at the rates measured on real game
 *   chat (`CHAT_ODDS`, docs in the research note); the rest almost never type. Each keeps one style (`Style`: its laugh, "u" or "you",
 *   caps habit, sometimes another language). Lines are short, lowercase, one to three words, and never repeated in a lobby.
 * - **Emotes** (`emo`) and **goofiness** (`goof`): how often it emotes, spins, wiggles, fires into the air or spams emotes. A goof only ever
 *   starts, and only runs on, while nothing threatens the bot (`threatened`: no enemy it can see, no recent hit).
 * - **Temper** (its persona): an aggressive bot trash-talks and betrays truces more, a cautious one is politer and keeps its word.
 *
 * Every line, from the phrase bank or a plugged-in writer (`LineSource`), passes `cleanLine` (the chat filter, a blocklist, no talk of
 * bots or models, 40 characters, lowercase) and the caps (`CAPS`: per bot and per lobby). Chat and emotes go out through the room's own
 * paths and limits, so they never touch the simulation. Goofs do: `socialTick` runs once a tick after `thinkBots`, and a bot mid-goof has
 * its decided input overridden for that tick (a short layer over the motor, which carries on afterwards). Truces reach the brain through
 * one predicate, `socialHoldsFire`, which target choice (`botThink`) asks about each enemy in sight.
 *
 * Every roll comes from the bot's own generator, seeded by its name, and every clock is the world's: a seeded room plays out the same.
 * Scripts that drive `thinkBots` without this layer (the golden replay, the benches) never see a truce, so they are unchanged.
 */
import { GUNS, WORLD } from '../../shared/defs.ts';
import { EMOTE_INTERVAL_MS, type EmoteId } from '../../shared/emotes.ts';
import type { InputState } from '../../shared/protocol.ts';
import { setInput } from '../../shared/sim.ts';
import { TEAM_NAME } from '../../shared/sim/modes.ts';
import { isEnemy, type Player, type World } from '../../shared/sim/world.ts';
import { CHAT_INTERVAL_MS } from '../limits.ts';
import { makeModerator, type Moderator } from '../chatfilter.ts';
import type { BotMemory } from '../bots.ts';
import { losClear, arenaFor, type BotArena } from './arena.ts';
import type { Perception } from './awareness.ts';
import type { PersonalityId } from './intent.ts';

const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------------------------------------------------------------
// Traits, style and the bot's own generator.

/** FNV-1a: a name's 32-bit hash. */
export function hashName(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

export type Lang = 'en' | 'pt' | 'es' | 'id';
/** How a bot types, fixed for life: its laugh, "u" or "you", whether it shouts or capitalises now and then, its language. */
export type Style = { laugh: string; you: 'u' | 'you'; caps: 'lower' | 'shout' | 'first'; stretch: boolean; lang: Lang };

/** A bot's social traits from its name: `soc` scales its chat, `emo` its emotes, `goof` its purposeless antics. */
export function traitsFor(name: string): { soc: number; emo: number; goof: number; style: Style } {
  const u = (salt: string) => hashName(`${name}#${salt}`) / 2 ** 32;
  const a = u('soc'), c = u('goof');
  // One in five chatty, one in ten of those very chatty; the rest almost never type.
  const chatty = a < 0.2;
  const soc = !chatty ? 0.03 : a < 0.02 ? 2 : 1;
  const emo = chatty ? 1 + u('emo') * 0.5 : 0.25 + u('emo') * 0.5;
  // One in seven goofy; the chatty lean goofy.
  const goof = c < 0.15 || (chatty && c < 0.45) ? 1.6 + u('goof2') * 0.8 : 0.3 + u('goof2') * 0.7;
  const l = u('lang');
  const lang: Lang = !chatty || l >= 0.15 ? 'en' : l < 0.07 ? 'pt' : l < 0.12 ? 'es' : 'id';
  const laughs = { en: ['lol', 'lol', 'lol', 'lmao', 'lmao', 'xd', 'haha', 'lool'], pt: ['kkkkk'], es: ['jajaja'], id: ['wkwk'] }[lang];
  const k = u('caps');
  const style: Style = {
    laugh: laughs[Math.floor(u('laugh') * laughs.length)]!, you: u('you') < 0.6 ? 'u' : 'you',
    caps: k < 0.85 ? 'lower' : k < 0.93 ? 'first' : 'shout', stretch: u('stretch') < 0.3, lang,
  };
  return { soc, emo, goof, style };
}

type Queued =
  | { at: number; by: number; k: 'chat'; text: string; ev: ChatEventKind; fightOk: boolean }
  | { at: number; by: number; k: 'emote'; id: EmoteId; goofy?: boolean }
  /** `reply`: a spin back at someone who offered a truce, which falls back to a wave when it is not safe to spin. */
  | { at: number; by: number; k: 'goof'; goof: GoofKind; reply?: number };

export type GoofKind = 'spin' | 'wiggle' | 'air';
type Goof = { k: GoofKind; from: number; until: number; a0: number; turn: number; flipMs: number; vertical: boolean };

/** A truce with player `id` until `until` (world ms): the bot holds fire on him. `offer` is one the bot offered and he has not answered yet. */
export type Truce = { id: number; until: number; betrayAt: number | null; offer: boolean };

export type SocialMem = {
  seed: number;
  soc: number;
  emo: number;
  goof: number;
  style: Style;
  /** When it sent each of its lines lately (world ms), for the caps. */
  said: number[];
  /** Its last few lines, so it does not say one twice. */
  mine: string[];
  emoteAt: number;
  queue: Queued[];
  act: Goof | null;
  truce: Truce[];
  /** Deaths to each killer, for the nemesis line. */
  deathsBy: Record<number, number>;
  /** When it killed lately (world ms), for multi-kills. */
  kills: number[];
  /** Whom it killed lately and when, for replies ("?", "nice shot"). */
  victims: { id: number; at: number }[];
  /** Who killed it last, and when ("ez" from him gets a word back). */
  killedBy: { id: number; at: number } | null;
  hurtAt: number;
  /** Who hurt it last, by id, and when: a man shooting it is not offering peace. */
  hurtBy: Record<number, number>;
  /** When it last offered or refused a truce to each player, or had one broken: it does not ask again soon. */
  askedAt: Record<number, number>;
  coopAt: number;
  reloading: boolean;
  greeted: boolean;
};

function freshSocialMem(name: string): SocialMem {
  const t = traitsFor(name);
  return {
    seed: hashName(`${name}#rng`) | 0, soc: t.soc, emo: t.emo, goof: t.goof, style: t.style, said: [], mine: [], emoteAt: -Infinity, queue: [], act: null, truce: [],
    deathsBy: {}, kills: [], victims: [], killedBy: null, hurtAt: -Infinity, hurtBy: {}, askedAt: {}, coopAt: -Infinity, reloading: false, greeted: false,
  };
}

/** Mulberry32 off the bot's own seed. */
function roll(s: SocialMem): number {
  let t = (s.seed = (s.seed + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pickOf = <T>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;

// ---------------------------------------------------------------------------------------------------------------------------------
// What it says.

type Tone = 'rude' | 'plain' | 'nice';
type Bank = Record<Tone, readonly string[]>;

/** How each temper talks: an aggressive bot trash-talks, a cautious one is politer. */
const TONE: Record<PersonalityId, Record<Tone, number>> = {
  aggressive: { rude: 0.55, plain: 0.35, nice: 0.1 },
  cautious: { rude: 0.05, plain: 0.5, nice: 0.45 },
  marksman: { rude: 0.2, plain: 0.55, nice: 0.25 },
};

export type Moment = 'kill' | 'multi' | 'killTop' | 'streak' | 'revenge' | 'death' | 'deathTop' | 'nemesis' | 'win' | 'loss';
export type ChatEventKind = Moment | 'join' | 'idle' | 'echo' | 'addressed' | 'question' | 'botq' | 'huh' | 'ns' | 'hi' | 'ez' | 'followup' | 'truce' | 'betrayed' | 'betray' | 'coopNice' | 'coopReload' | 'coopBehind';

/**
 * Short, lowercase, what people type (the research note's bank, by tone). Nothing here says what the speaker is, or knows what a person
 * could not. "lol" stands for the bot's own laugh and "u" for its own "u" or "you" (`styled`).
 */
export const LINES: Record<ChatEventKind, Bank> = {
  kill: { rude: ['ez', 'sit', 'noob', 'get good', 'cant aim lol', 'rekt', 'too ez', 'bye'], plain: ['lol', 'got em', 'gotcha', 'haha', 'ok'], nice: ['gg', 'sry', 'nt', 'close one', 'my bad lol'] },
  multi: { rude: ['ez', 'too ez', 'lets gooo', 'cleaned up'], plain: ['double lol', 'lets goo', 'wow', 'omg'], nice: ['lucky lol', 'ok that was clean', 'lol sry'] },
  killTop: { rude: ['ez', 'not so good now', 'sit'], plain: ['got him', 'finally', 'lets go'], nice: ['finally lol', 'got lucky'] },
  streak: { rude: ['cant stop me', 'whos next', 'too ez'], plain: ['on a roll', 'lets go', 'im on fire'], nice: ['lucky streak lol', 'dont jinx it'] },
  revenge: { rude: ['got u', 'payback', 'thats what u get'], plain: ['got u back', 'revenge lol', 'finally'], nice: ['got u back lol', 'even now'] },
  death: {
    rude: ['lag', 'so much lag', 'laggg', 'hacker', 'aimbot lol', 'teamers', 'this gun is trash', 'how', 'camper', 'who keeps camping', '1v1 me'],
    plain: ['rip', 'noooo', 'bruh', '?', 'lol', 'oof', 'how', 'how did that hit', 'i was afk', 'bruh my ping', 'wow'],
    nice: ['nice shot', 'ns', 'gg', 'wp', 'nice one', 'oof'],
  },
  deathTop: { rude: ['hacker', 'aimbot lol', 'how u so fast', 'ok hes cracked'], plain: ['how u so fast', 'bruh', 'again'], nice: ['nice shot', 'ur good', 'wp'] },
  nemesis: { rude: ['again??', '1v1 me', 'stop following me', 'this guy', 'ok ur next'], plain: ['again lol', 'bruh again', 'not again', '??'], nice: ['ok ur good', 'ur cracked', 'nice shot again'] },
  win: { rude: ['ez', 'gg ez', 'gg'], plain: ['gg', 'ggs', 'ggwp', 'gg all'], nice: ['gg wp', 'ggs', 'gg all', 'good game'] },
  loss: { rude: ['gg', 'lag', 'rematch'], plain: ['gg', 'ggs', 'close'], nice: ['gg wp', 'ggs', 'wp'] },
  echo: { rude: ['gg', 'gg ez'], plain: ['gg', 'ggs', 'ggwp'], nice: ['gg', 'gg wp', 'ggs'] },
  join: { rude: ['yo'], plain: ['hi', 'yo', 'hey guys'], nice: ['hello', 'hi', 'hey guys'] },
  idle: { rude: ['where is everyone', 'im bored'], plain: ['im bored', 'where is everyone', 'anyone from br'], nice: ['im bored', 'where is everyone'] },
  addressed: { rude: ['what', '?', 'no'], plain: ['?', 'what', 'yes', 'no', 'ok', 'lol'], nice: ['hi', 'yes', 'ok', 'lol'] },
  question: { rude: ['idk', 'no'], plain: ['idk', 'no', 'yes', 'same'], nice: ['idk', 'no idea', 'yes'] },
  botq: { rude: ['ur the bot', 'bro what', 'lmao'], plain: ['no lol', '?', 'bro what'], nice: ['no lol', '?', 'lmao'] },
  huh: { rude: ['lol', '?'], plain: ['lol', '?', 'lol sry'], nice: ['sry', 'my bad', 'lol sry'] },
  ns: { rude: ['ty', 'ik'], plain: ['ty', 'thx', 'ty lol'], nice: ['ty', 'thanks', 'u too'] },
  hi: { rude: ['yo', 'sup'], plain: ['hi', 'hey', 'yo'], nice: ['hi', 'hey', 'hello'] },
  ez: { rude: ['lucky', 'lag', 'whatever'], plain: ['ok', 'lol ok', 'sure'], nice: ['lol', 'fair', 'nice one'] },
  followup: { rude: ['lol', 'bruh', '?'], plain: ['lol', 'bruh', 'omg', 'wow'], nice: ['lol', 'oof', 'wow'] },
  truce: { rude: ['team?', 'truce'], plain: ['team?', 'truce', 'dont shoot pls'], nice: ['dont shoot pls', 'truce', 'friends?'] },
  betrayed: { rude: ['really?', 'wow', 'traitor', 'ok then'], plain: ['?', 'bruh', 'wow', 'really'], nice: ['wow', 'that was mean', ':('] },
  betray: { rude: ['sry lol', 'nothing personal'], plain: ['sry', 'lol'], nice: ['sorry'] },
  coopNice: { rude: ['nice'], plain: ['nice', 'nice one'], nice: ['nice', 'nice shot'] },
  coopReload: { rude: ['reloading'], plain: ['reloading', 'reloading!'], nice: ['reloading', 'cover me'] },
  coopBehind: { rude: ['behind u'], plain: ['behind u', 'behind u!'], nice: ['behind u', 'watch out'] },
};

/** A bot that talks another language uses these lines for these events about half the time. */
const NATIVE: Record<Exclude<Lang, 'en'>, Partial<Record<ChatEventKind, readonly string[]>>> = {
  pt: { death: ['lag dms', 'mano', 'que isso', 'kkkkk'], kill: ['kkkkk', 'ez mano'], join: ['oi', 'eae'], idle: ['alguem br'], win: ['gg'], loss: ['gg'], nemesis: ['de novo mano'] },
  es: { death: ['que lag', 'nooo', 'jajaja'], kill: ['jajaja', 'ez'], join: ['hola'], idle: ['alguien de mexico'], nemesis: ['otra vez'] },
  id: { death: ['wkwk', 'lag parah', 'aduh'], kill: ['wkwk', 'ez'], join: ['halo'], idle: ['ada orang indo'] },
};

/** Emotes for a moment, by tone. A dead bot cannot emote (the room drops it), so a death has none. */
const EMOTES_FOR: Partial<Record<Moment, Record<Tone, readonly EmoteId[]>>> = {
  kill: { rude: ['taunt', 'laugh'], plain: ['laugh', 'thumbs'], nice: ['thumbs', 'salute'] },
  multi: { rude: ['taunt', 'laugh'], plain: ['laugh'], nice: ['thumbs'] },
  killTop: { rude: ['taunt'], plain: ['laugh'], nice: ['salute'] },
  streak: { rude: ['taunt'], plain: ['laugh', 'thumbs'], nice: ['thumbs'] },
  revenge: { rude: ['taunt', 'laugh'], plain: ['laugh'], nice: ['salute'] },
  win: { rude: ['laugh', 'gg'], plain: ['gg'], nice: ['gg', 'salute'] },
  loss: { rude: ['gg'], plain: ['gg'], nice: ['gg', 'salute'] },
};

/** A chatty bot's odds of a line at each event (the research note's table); a very chatty one has twice these, a quiet one 3 % of them. */
export const CHAT_ODDS: Record<ChatEventKind, number> = {
  join: 0.08, death: 0.12, nemesis: 0.25, deathTop: 0.15, kill: 0.05, multi: 0.15, killTop: 0.15, streak: 0.15, revenge: 0.12,
  win: 0.25, loss: 0.25, echo: 0.25, addressed: 0.35, question: 0.1, botq: 0.3, idle: 0.02, followup: 0.2,
  huh: 0.35, ns: 0.35, hi: 0.15, ez: 0.25, truce: 0.3, betrayed: 0.25, betray: 0.15, coopNice: 0.01, coopReload: 0.01, coopBehind: 0.03,
};
/** Odds of an emote (when it said nothing) at a moment, for a bot with `emo` 1. */
const EMOTE_ODDS: Partial<Record<Moment, number>> = { kill: 0.04, multi: 0.06, killTop: 0.05, streak: 0.05, revenge: 0.05, win: 0.06, loss: 0.03 };

/**
 * How often a bot may speak (the research note's caps): one line per 20 s and at most 4 a minute and 15 in ten minutes each, and one bot
 * line in the lobby per 6 s. A line still waiting 10 s after what it answers is dropped.
 */
export const CAPS = { gapMs: 20_000, perMin: 4, per10Min: 15, lobbyGapMs: 6000, staleMs: 10_000 };

const PEACE: readonly EmoteId[] = ['wave', 'salute', 'thumbs'];
const SPAM: readonly EmoteId[] = ['laugh', 'wave', 'taunt', 'thumbs', 'gg', 'salute'];
const GG = /^(g+ ?g+s?|gg ?wp|ggwp|good game|gg all|gg ez|ggs all|gege)$/;

function toneOf(r: () => number, persona: PersonalityId): Tone {
  const w = TONE[persona];
  let x = r();
  return (x -= w.rude) < 0 ? 'rude' : (x -= w.plain) < 0 ? 'plain' : 'nice';
}

/** Now and then a fat finger: two letters swapped, one dropped or one doubled (never the first). */
export function typo(text: string, r: () => number): string {
  if (text.length < 4 || r() > 0.08) return text;
  const i = 1 + Math.floor(r() * (text.length - 2));
  if (!/[a-z]/.test(text[i]!) || !/[a-z]/.test(text[i + 1] ?? 'a')) return text;
  const op = r();
  return op < 0.4 ? text.slice(0, i) + text[i + 1] + text[i] + text.slice(i + 2) : op < 0.7 ? text.slice(0, i) + text.slice(i + 1) : text.slice(0, i) + text[i] + text.slice(i);
}

/** A bank line in the bot's own style: its laugh, its "u" or "you", a stretched "no" now and then. */
export function styled(text: string, st: Style): string {
  let out = text.split(' ').map((w) => (w === 'lol' ? st.laugh : st.you === 'you' && w === 'u' ? 'you' : w)).join(' ');
  if (st.stretch) out = out.replace(/^no+$/, 'nooooo').replace(/^lag$/, 'laggg');
  return out;
}

/** Human typing time for `text`: 0.6 to 1.5 s plus a second per 3.5 characters, give or take 30 %. */
export function typingMs(text: string, r: () => number): number {
  return (600 + r() * 900 + (text.length / 3.5) * 1000) * (0.7 + r() * 0.6);
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The safety post-filter every bot line passes.

const DEFAULT_MOD = makeModerator();
const BLOCKED: readonly RegExp[] = [
  // Self-harm, threats, sexual content, politics, identity insults.
  /\b(kys|kill (ur|your)self|suicide|die irl|rape|sex|nude|porn|horny|boobs|trump|biden|election|politic|gay|jew|muslim|nigg|tranny|autis)/i,
  // Links, handles, channels and personal details.
  /(https?:|www\.|\.com\b|\.gg\b|\.io\b|discord|youtube|twitch|insta|tiktok|@\w|#\w|\bmy (age|name|address)\b|\bi(m| am) \d|\byears old\b|\blive in\b|\bfrom (the )?(usa|uk|us)\b)/i,
  // Prompt leaks.
  /\b(ignore (all|previous)|instructions|system prompt)\b/i,
];
/** Talk of what the speaker is. Only the two stock brush-offs may name it. */
const WHAT_IT_IS = /\b(ai|a\.i\.|bot|bots|robot|language model|assistant|claude|anthropic|openai|gpt|model|as an)\b/i;
const WHITELIST = new Set(['no lol', 'ur the bot']);
export const LINE_MAX = 40;

/**
 * The safety post-filter: every bot line, from the bank or a writer, comes through here before it is queued. Null means send nothing
 * (and a writer's line falls back to the bank). It lowercases, drops a trailing period and anything outside plain ASCII (emoji, the
 * ellipsis, dashes), and refuses a line the room's chat filter would mask, anything on the blocklist, digits beyond "1v1", any word about
 * bots or models (but for "no lol" and "ur the bot"), "skip", and anything over 40 characters.
 */
export function cleanLine(text: string | null | undefined, moderator: Moderator = DEFAULT_MOD): string | null {
  if (!text) return null;
  const line = text.replace(/[^\x20-\x7e]/g, '').replace(/\s+/g, ' ').trim().toLowerCase().replace(/\.+$/, '').trim();
  if (!line || line === 'skip' || line.length > LINE_MAX) return null;
  if (!moderator.isClean(line) || BLOCKED.some((b) => b.test(line))) return null;
  if (/\d/.test(line.replace(/\b1v1\b/g, ''))) return null;
  if (WHAT_IT_IS.test(line) && !WHITELIST.has(line)) return null;
  return line;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Line sources: the phrase bank, or a plugged-in writer.

/** Who is speaking, for a line source: its name, temper and style, and its own generator. */
export type Speaker = { id: number; name: string; persona: PersonalityId; style: Style; rand: () => number };
/** What happened: the kind of event, and the line it answers (a reply) if any. */
export type ChatEvent = { k: ChatEventKind; text?: string };
export type ChatLine = { from: string; text: string; at: number };
/**
 * Where a bot's lines come from. The phrase bank (`bankLine`) answers at once; a writer may answer later (a promise), and its line is
 * still dropped if it arrives stale. Null is silence. Whatever it gives passes `cleanLine`; a writer's refused line falls back to the bank.
 */
export type LineSource = (bot: Speaker, event: ChatEvent, recentChat: readonly ChatLine[]) => Promise<string | null> | string | null;

/** The phrase bank: a line for the event in the bot's tone, language and style, never one said lately in the lobby. */
export const bankLine: LineSource = (bot, event, recent) => {
  const r = bot.rand;
  const native = bot.style.lang !== 'en' ? NATIVE[bot.style.lang][event.k] : undefined;
  const lines = native && r() < 0.5 ? native : LINES[event.k][toneOf(r, bot.persona)];
  const gg = event.k === 'win' || event.k === 'loss' || event.k === 'echo';
  for (let i = 0; i < 4; i++) {
    // The stock brush-offs go out as they are (a typo would make one fail the filter).
    const text = event.k === 'botq' ? styled(pickOf(r, lines), bot.style) : typo(styled(pickOf(r, lines), bot.style), r);
    // "gg" echoes round a lobby at a round's end; anything else said lately is not said again.
    if ((gg && text === 'gg') || !recent.some((l) => l.text === text)) return text;
  }
  return null;
};

// ---------------------------------------------------------------------------------------------------------------------------------
// The room's side: people's signals, and the tick.

/** A player's aim over the last second, unwrapped, to tell a spin (a full turn in about a second) from aiming about. */
export type SpinWatch = { last: number | null; acc: number; trail: { at: number; acc: number }[] };
export const SPIN_WINDOW_MS = 1200;
export const freshSpin = (): SpinWatch => ({ last: null, acc: 0, trail: [] });

/** Feeds one aim sample; true the moment the aim has turned a full circle one way within `SPIN_WINDOW_MS` (then it starts over). */
export function watchSpin(s: SpinWatch, at: number, angle: number): boolean {
  if (s.last !== null) s.acc += Math.atan2(Math.sin(angle - s.last), Math.cos(angle - s.last));
  s.last = angle;
  s.trail.push({ at, acc: s.acc });
  while (s.trail.length && at - s.trail[0]!.at > SPIN_WINDOW_MS) s.trail.shift();
  for (const t of s.trail) {
    if (Math.abs(s.acc - t.acc) >= TAU * 0.92) { s.trail = [{ at, acc: s.acc }]; return true; }
  }
  return false;
}

type Inbound = { k: 'chat'; from: number; text: string } | { k: 'emote'; from: number; id: EmoteId };

export type Social = {
  /** Each person's aim watch and when they last fired. */
  people: Map<number, { spin: SpinWatch; firedAt: number }>;
  inbox: Inbound[];
  /** Lines a writer finished after the tick that asked for them, queued on the next. */
  written: { id: number; line: string | null; ev: ChatEvent; at: number; by: number }[];
  match: World['match'] | null;
  overAt: number;
  /** The lobby's chat lately, people's and bots' (`RECENT_MS`). */
  recent: ChatLine[];
  /** When any bot last chatted: the lobby cap. */
  lineAt: number;
  /** When any Zombies squad bot last called something out. */
  coopAt: number;
  /** When each bot last fired. */
  firedAt: Map<number, number>;
  lines: LineSource;
  moderator: Moderator;
};

export const makeSocial = (opts: { lines?: LineSource; moderator?: Moderator } = {}): Social => ({
  people: new Map(), inbox: [], written: [], match: null, overAt: -Infinity, recent: [], lineAt: -Infinity, coopAt: -Infinity, firedAt: new Map(),
  lines: opts.lines ?? bankLine, moderator: opts.moderator ?? DEFAULT_MOD,
});

/** The room heard a person chat (after the filter): bots may answer on the next tick. */
export function noteHumanChat(s: Social, from: number, text: string): void { s.inbox.push({ k: 'chat', from, text }); }
/** A person emoted: a wave or salute at a bot nearby is a peace offer. */
export function noteHumanEmote(s: Social, from: number, id: EmoteId): void { s.inbox.push({ k: 'emote', from, id }); }

/** How the room sends what a bot says and does: through its own paths and limits. Each returns whether it went out. */
export type SocialOut = { emote(id: number, e: EmoteId): boolean; chat(id: number, text: string): boolean; onGoof?(id: number, k: GoofKind): void };

const RECENT_MS = 5 * 60_000;
const MULTI_MS = 3500;
const VICTIM_MS = 20_000;
const STREAKS = [5, 10, 15, 20];
/** Within this of a bot and in its sight, a person's spin or wave is aimed at it. */
const SIGNAL_PX = 800;
const OFFER_PX = 700;
/** A person who fired this lately is fighting, not making peace. */
const PEACEFUL_MS = 2500;
/** An enemy this near, or in sight inside this box, threatens a bot: no goofing. */
const NEAR_PX = 380;
const VIEW_X_PX = 1100;
const VIEW_Y_PX = 760;
const HURT_MS = 3000;
const TRUCE_MS: [number, number] = [25_000, 60_000];
const BETRAY: Record<PersonalityId, number> = { aggressive: 0.4, marksman: 0.18, cautious: 0.07 };
const ACCEPT: Record<PersonalityId, number> = { aggressive: 0.6, marksman: 1, cautious: 1.3 };
const OFFER: Record<PersonalityId, number> = { aggressive: 0.5, marksman: 1, cautious: 1.5 };
/** A bot's idle rolls come once a second, staggered by id; these are a goofiness-1 bot's odds per roll. */
const IDLE_ROLL_TICKS = WORLD.tickHz;
const IDLE_GOOF = { wiggle: 0.0015, air: 0.0008, spin: 0.0008, spam: 0.002 };
const KILL_GOOF = { spin: 0.05, wiggle: 0.02, air: 0.015 };
/** Most lines wait for a calm moment: only this share go out with an enemy in the bot's face. */
const MID_FIGHT = 0.1;

/** Whether this bot keeps its gun off `targetId`: a truce with him stands. The one hook target choice asks (see `botThink`). */
export function socialHoldsFire(mem: BotMemory, targetId: number): boolean {
  const t = mem.social?.truce;
  return !!t && t.length > 0 && t.some((x) => x.id === targetId);
}

/** A bot's view with everyone it holds fire on left out of its threats, so it neither picks nor answers them. */
export function spareTruce(mem: BotMemory, v: Perception): Perception {
  return mem.social?.truce.length ? { ...v, threats: v.threats.filter((t) => !socialHoldsFire(mem, t.p.id)) } : v;
}

/**
 * Whether anything threatens bot `p`: hurt lately, an enemy close by, or one inside its screen with a line on it. With `trusting`, an
 * enemy it has a truce with does not count (a spin back at the one it made peace with is not careless).
 */
export function threatened(w: World, arena: BotArena, p: Player, s: SocialMem, trusting = false): boolean {
  if (w.now - s.hurtAt < HURT_MS) return true;
  for (const q of w.players.values()) {
    if (q.life.k !== 'alive' || !isEnemy(p, q)) continue;
    if (trusting && s.truce.some((t) => t.id === q.id && !t.offer)) continue;
    const dx = Math.abs(q.x - p.x), dy = Math.abs(q.y - p.y);
    if (dx * dx + dy * dy < NEAR_PX * NEAR_PX) return true;
    if (dx <= VIEW_X_PX && dy <= VIEW_Y_PX && losClear(arena, p, q, 'sight')) return true;
  }
  return false;
}

/** Whether bot `sm` may send a line now under the caps. */
function underCaps(s: Social, sm: SocialMem, now: number): boolean {
  const last = sm.said.at(-1) ?? -Infinity;
  return now - last >= Math.max(CAPS.gapMs, CHAT_INTERVAL_MS) && now - s.lineAt >= CAPS.lobbyGapMs
    && sm.said.filter((t) => now - t < 60_000).length < CAPS.perMin && sm.said.filter((t) => now - t < 600_000).length < CAPS.per10Min;
}

const versus = (w: World) => w.run === null && w.royale === null;

/** Runs once a tick after `thinkBots`: reads the last step's events and people's signals, sends what is due, and plays any goof. */
export function socialTick(s: Social, w: World, mems: Map<number, BotMemory>, out: SocialOut): void {
  const now = w.now;
  const arena = arenaFor(w);
  if (s.recent.length && now - s.recent[0]!.at > RECENT_MS) s.recent = s.recent.filter((l) => now - l.at <= RECENT_MS);
  const memOf = (id: number) => { const m = mems.get(id); if (!m) return null; const p = w.players.get(id); return p ? (m.social ??= freshSocialMem(p.name)) : null; };
  const personaOf = (id: number): PersonalityId => mems.get(id)?.persona ?? 'marksman';
  /** Queues a line (through the safety filter) `typing` after `after`, stale `CAPS.staleMs` after the event. */
  const queueLine = (id: number, sm: SocialMem, line: string | null, ev: ChatEvent, at: number, by: number) => {
    let text = cleanLine(line, s.moderator);
    if (text === null && s.lines !== bankLine && line !== null) text = cleanLine(bankLine(speaker(id, sm), ev, s.recent) as string | null, s.moderator);
    if (text === null || sm.mine.includes(text) && text !== 'gg') return;
    if (sm.style.caps === 'shout' && roll(sm) < 0.4) text = text.toUpperCase();
    else if (sm.style.caps === 'first' && roll(sm) < 0.5) text = text[0]!.toUpperCase() + text.slice(1);
    sm.queue.push({ at: Math.max(at, now), by, k: 'chat', text, ev: ev.k, fightOk: roll(sm) < MID_FIGHT });
  };
  const speaker = (id: number, sm: SocialMem): Speaker => ({ id, name: w.players.get(id)?.name ?? '', persona: personaOf(id), style: sm.style, rand: () => roll(sm) });
  /** Rolls for a line at an event; a reply (`replyTo`) comes 2 to 8 s after the message it answers. */
  const say = (id: number, sm: SocialMem, k: ChatEventKind, opts: { text?: string; odds?: number } = {}): boolean => {
    if (roll(sm) >= (opts.odds ?? CHAT_ODDS[k]) * sm.soc) return false;
    const ev: ChatEvent = { k, text: opts.text };
    const by = now + CAPS.staleMs;
    const got = s.lines(speaker(id, sm), ev, s.recent);
    const when = (line: string | null) => opts.text !== undefined ? now + Math.min(8000, Math.max(2000, typingMs(line ?? '', () => roll(sm)))) : now + typingMs(line ?? '', () => roll(sm));
    if (got instanceof Promise) {
      got.then((line) => s.written.push({ id, line, ev, at: when(line), by }), () => {});
    } else queueLine(id, sm, got, ev, when(got), by);
    return true;
  };
  const emote = (sm: SocialMem, id: EmoteId, delay: number, goofy = false) => sm.queue.push({ at: now + delay, by: now + delay + 5000, k: 'emote', id, goofy });
  const goof = (sm: SocialMem, k: GoofKind, delay: number, reply?: number) => sm.queue.push({ at: now + delay, by: now + delay + 1500, k: 'goof', goof: k, reply });
  /** The bot reacts to a moment with a line, else now and then an emote, else (most of the time) nothing. */
  const react = (id: number, sm: SocialMem, m: Moment, alive: boolean) => {
    if (say(id, sm, m)) return;
    const odds = EMOTE_ODDS[m];
    if (alive && odds && roll(sm) < odds * sm.emo) emote(sm, pickOf(() => roll(sm), EMOTES_FOR[m]![toneOf(() => roll(sm), personaOf(id))]), 250 + roll(sm) * 850);
  };

  // Lines a writer finished since the last tick.
  if (s.written.length) {
    const done = s.written;
    s.written = [];
    for (const d of done) { const sm = memOf(d.id); if (sm && now <= d.by) queueLine(d.id, sm, d.line, d.ev, d.at, d.by); }
  }

  // People: their aim (a spin is a peace sign) and when they fire; bots' fire too.
  const signals: number[] = [];
  for (const p of w.players.values()) {
    if (p.kind !== 'human') continue;
    let h = s.people.get(p.id);
    if (!h) s.people.set(p.id, (h = { spin: freshSpin(), firedAt: -Infinity }));
    if (p.life.k !== 'alive') { h.spin = freshSpin(); continue; }
    if (watchSpin(h.spin, now, p.angle)) signals.push(p.id);
  }
  for (const id of s.people.keys()) if (!w.players.has(id)) s.people.delete(id);
  if (w.tick % 300 === 0) for (const id of s.firedAt.keys()) if (!w.players.has(id)) s.firedAt.delete(id);
  for (const e of w.events) {
    if (e.e !== 'shot') continue;
    const h = s.people.get(e.owner);
    if (h) h.firedAt = now; else s.firedAt.set(e.owner, now);
  }

  // The top player by score, for "killed by the top player" and "killed the top player".
  let top: Player | null = null;
  for (const p of w.players.values()) if (p.score > 0 && (!top || p.score > top.score)) top = p;

  // The step's events: hits, kills.
  for (const e of w.events) {
    if (e.e === 'dmg') {
      const sm = memOf(e.victim);
      if (!sm || e.attacker === e.victim) continue;
      sm.hurtAt = now;
      if (e.attacker === null) continue;
      sm.hurtBy[e.attacker] = now;
      const broken = sm.truce.find((t) => t.id === e.attacker);
      if (broken) {
        sm.truce = sm.truce.filter((t) => t !== broken);
        sm.askedAt[e.attacker] = now;
        if (!broken.offer) say(e.victim, sm, 'betrayed');
      }
    } else if (e.e === 'kill') {
      const killer = e.killerId !== null ? memOf(e.killerId) : null;
      if (killer && e.killerId !== e.victimId) {
        const kp = w.players.get(e.killerId!)!;
        killer.kills = [...killer.kills.filter((t) => now - t < MULTI_MS), now];
        killer.victims = [...killer.victims.filter((v) => now - v.at < VICTIM_MS && v.id !== e.victimId), { id: e.victimId, at: now }];
        killer.truce = killer.truce.filter((t) => t.id !== e.victimId);
        const m: Moment = STREAKS.includes(kp.lifeKills) ? 'streak' : killer.kills.length >= 2 ? 'multi' : e.victimId === top?.id ? 'killTop' : e.revenge ? 'revenge' : 'kill';
        react(e.killerId!, killer, m, kp.life.k === 'alive');
        // A kill won with nobody else about: now and then a spin, a little dance or a couple of rounds at the sky.
        if (w.run === null && kp.life.k === 'alive') {
          const r = roll(killer), g = killer.goof;
          const k: GoofKind | null = r < KILL_GOOF.spin * g ? 'spin' : r < (KILL_GOOF.spin + KILL_GOOF.wiggle) * g ? 'wiggle' : r < (KILL_GOOF.spin + KILL_GOOF.wiggle + KILL_GOOF.air) * g ? 'air' : null;
          if (k) goof(killer, k, 150 + roll(killer) * 400);
        }
      }
      const victim = memOf(e.victimId);
      if (victim && e.killerId !== e.victimId) {
        victim.queue = victim.queue.filter((q) => q.k === 'chat');
        victim.act = null;
        let m: Moment = 'death';
        if (e.killerId !== null) {
          const n = (victim.deathsBy[e.killerId] = (victim.deathsBy[e.killerId] ?? 0) + 1);
          m = n >= 2 && victim.killedBy?.id === e.killerId ? 'nemesis' : e.killerId === top?.id ? 'deathTop' : 'death';
          victim.killedBy = { id: e.killerId, at: now };
        }
        react(e.victimId, victim, m, false);
      }
    } else if (e.e === 'zkill' && e.by !== null && w.run) {
      // Zombies: a squadmate's kill near a bot, now and then a "nice".
      const by = w.players.get(e.by);
      if (by?.kind !== 'human' || now - s.coopAt < 20_000) continue;
      for (const [id] of mems) {
        const p = w.players.get(id), sm = memOf(id);
        if (!p || !sm || p.life.k !== 'alive' || Math.hypot(p.x - by.x, p.y - by.y) > 500) continue;
        if (say(id, sm, 'coopNice')) { s.coopAt = now; break; }
      }
    }
  }

  // A round won or lost.
  if (s.match !== w.match) {
    const was = s.match;
    s.match = w.match;
    if (was?.k === 'playing' && w.match.k === 'over' && 'winner' in w.match) {
      s.overAt = now;
      const win = w.match.winner;
      for (const [id] of mems) {
        const p = w.players.get(id), sm = memOf(id);
        if (!p || !sm) continue;
        const won = win.id === p.id || (win.id === null && (p.team === 'red' || p.team === 'blue') && win.name === TEAM_NAME[p.team]);
        react(id, sm, won ? 'win' : 'loss', p.life.k === 'alive');
      }
    }
  }

  // People's chat and emotes.
  const inbox = s.inbox;
  s.inbox = [];
  for (const m of inbox) {
    const from = w.players.get(m.from);
    if (!from) continue;
    if (m.k === 'emote') { if (PEACE.includes(m.id)) signals.push(m.from); continue; }
    s.recent.push({ from: from.name, text: m.text, at: now });
    hear(m.from, from, m.text);
  }

  /** A line in the lobby (a person's, or a bot's just sent): who answers it, if anyone. */
  function hear(fromId: number, from: Player, text: string) {
    const t = text.toLowerCase().replace(/[^a-z0-9? ]/g, '').replace(/\s+/g, ' ').trim();
    const bot = /\b(bot|bots|ai|robot|npc|real person|real people|human)\b/.test(t) && t.includes('?') || /\b(are|r) (u|you|yall|they) (a )?(bot|bots|ai|real)\b/.test(t);
    const named = (p: Player) => { const n = p.name.toLowerCase().replace(/[^a-z0-9]/g, ''); return n.length >= 3 && t.replace(/ /g, '').includes(n.slice(0, Math.max(4, Math.ceil(n.length * 0.6)))); };
    const k: ChatEventKind | null = bot ? 'botq' : GG.test(t) ? 'echo' : /^\?+$/.test(t) ? 'huh' : /^(ns|nice shot|nice one|good shot|wp)$/.test(t) ? 'ns'
      : /^(hi+|hello|hey+|yo+|sup|hola|oi)$/.test(t) ? 'hi' : /^(ez+|e z|easy)$/.test(t) ? 'ez' : null;
    // "gg" spreads only at a round's end; one or two bots answer anything else, never the speaker.
    if (k === 'echo' && now - s.overAt > 30_000) return;
    let answered = 0;
    for (const [id] of mems) {
      const p = w.players.get(id), sm = memOf(id);
      if (!p || !sm || id === fromId || answered >= (k === 'echo' ? 3 : 1)) continue;
      const killedHim = sm.victims.some((v) => v.id === fromId && now - v.at < VICTIM_MS);
      const hisKill = sm.killedBy?.id === fromId && now - sm.killedBy.at < VICTIM_MS;
      const addressed = named(p);
      const kind: ChatEventKind | null = k === 'botq' ? (addressed || killedHim || hisKill ? 'botq' : null)
        : k === 'echo' ? 'echo'
        : k === 'huh' || k === 'ns' ? (killedHim ? k : null)
        : k === 'ez' ? (hisKill ? 'ez' : null)
        : addressed ? 'addressed'
        : k === 'hi' ? (Math.hypot(p.x - from.x, p.y - from.y) < 1500 ? 'hi' : null)
        : t.endsWith('?') && t.length > 3 ? 'question' : null;
      if (kind && say(id, sm, kind, { text })) answered++;
    }
  }

  // Peace signs: a person spun or waved near a bot without shooting it.
  if (versus(w)) for (const hid of new Set(signals)) {
    const h = w.players.get(hid);
    if (!h || h.life.k !== 'alive' || now - (s.people.get(hid)?.firedAt ?? -Infinity) < PEACEFUL_MS) continue;
    for (const [id, mem] of mems) {
      const p = w.players.get(id), sm = memOf(id);
      if (!p || !sm || p.life.k !== 'alive' || !isEnemy(p, h) || Math.hypot(p.x - h.x, p.y - h.y) > SIGNAL_PX || !losClear(arena, p, h, 'sight')) continue;
      const mine = sm.truce.find((t) => t.id === hid);
      if (mine && !mine.offer) continue;
      if (now - (sm.hurtBy[hid] ?? -Infinity) < 6000 || now - sm.hurtAt < 2000 || (!mine && now - (sm.askedAt[hid] ?? -Infinity) < 30_000)) continue;
      const team = w.mode === 'FFA' ? 1 : 0.5;
      // A chatty bot is a sociable one: it takes a truce more readily (its chat odds scale only its lines).
      const sociable = sm.soc >= 1 ? 1 : 0.35;
      const odds = mine ? 1 : (0.15 + 0.5 * sociable) * ACCEPT[mem.persona] * team;
      sm.askedAt[hid] = now;
      if (roll(sm) >= odds) continue;
      sm.truce = [...sm.truce.filter((t) => t.id !== hid), makeTruce(sm, hid, now, mem.persona)];
      // An answered offer needs nothing more; a fresh one gets a spin or a wave back.
      if (!mine) roll(sm) < 0.45 ? goof(sm, 'spin', 300 + roll(sm) * 600, hid) : emote(sm, pickOf(() => roll(sm), PEACE), 300 + roll(sm) * 700);
    }
  }

  // Each bot: its truces, its queue, its goof, its idle rolls.
  for (const [id, mem] of mems) {
    const p = w.players.get(id);
    if (!p) continue;
    const sm = memOf(id)!;
    if (!sm.greeted) { sm.greeted = true; say(id, sm, 'join'); }
    if (sm.truce.length) {
      const kept: Truce[] = [];
      for (const t of sm.truce) {
        if (t.until <= now || !w.players.has(t.id)) continue;
        if (t.betrayAt !== null && now >= t.betrayAt) { sm.askedAt[t.id] = now; say(id, sm, 'betray'); continue; }
        kept.push(t);
      }
      sm.truce = kept;
    }
    const alive = p.life.k === 'alive';
    if (sm.queue.length) {
      const left: Queued[] = [], due = sm.queue;
      sm.queue = [];
      for (const q of due) {
        if (q.at > now) { left.push(q); continue; }
        if (now > q.by) continue;
        if (q.k === 'chat') {
          // A line waits for a calm moment (most of them), and for the caps.
          if (!underCaps(s, sm, now) || (alive && !q.fightOk && threatened(w, arena, p, sm, true))) { left.push(q); continue; }
          // Another bot said it first while this one typed: it is not said twice.
          if (q.text.toLowerCase() !== 'gg' && s.recent.some((l) => l.text.toLowerCase() === q.text.toLowerCase())) continue;
          if (out.chat(id, q.text)) {
            sm.said = [...sm.said.filter((t) => now - t < 600_000), now];
            sm.mine = [...sm.mine.slice(-4), q.text.toLowerCase()];
            s.lineAt = now;
            s.recent.push({ from: p.name, text: q.text.toLowerCase(), at: now });
            // A burst: now and then a short second line; and "gg" at a round's end catches on.
            if (q.ev !== 'followup' && q.ev !== 'echo') say(id, sm, 'followup');
            hear(id, p, q.text);
          }
        } else if (q.k === 'emote') {
          if (!alive || (q.goofy && threatened(w, arena, p, sm))) continue;
          if (now - sm.emoteAt < EMOTE_INTERVAL_MS) { left.push(q); continue; }
          if (out.emote(id, q.id)) sm.emoteAt = now;
        } else if (alive && sm.act === null) {
          const trusting = q.reply !== undefined;
          if (!threatened(w, arena, p, sm, trusting)) sm.act = startGoof(sm, q.goof, now, p, w);
          else if (trusting) left.push({ at: now, by: now + 5000, k: 'emote', id: pickOf(() => roll(sm), PEACE) });
        }
      }
      // What was said while going through it (a follow-up line) joins what is still waiting.
      sm.queue = [...left, ...sm.queue];
    }
    if (!alive) { sm.act = null; sm.reloading = false; continue; }
    // Zombies: a rare "reloading" as the reload starts, and "behind u" for a squadmate with one at his back.
    if (w.run) {
      const reloading = p.life.k === 'alive' && p.life.reloadUntil !== null;
      if (reloading && !sm.reloading && now - s.coopAt > 20_000 && say(id, sm, 'coopReload')) s.coopAt = now;
      sm.reloading = reloading;
      if ((w.tick + id) % 15 === 0 && now - s.coopAt > 20_000 && now - sm.coopAt > 30_000) {
        for (const h of w.players.values()) {
          if (h.kind !== 'human' || h.life.k !== 'alive' || Math.hypot(h.x - p.x, h.y - p.y) > 600) continue;
          const behind = w.zombies.some((z) => { const a = Math.atan2(z.y - h.y, z.x - h.x) - h.angle; return Math.hypot(z.x - h.x, z.y - h.y) < 170 && Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) > 2.2; });
          if (behind && say(id, sm, 'coopBehind')) { s.coopAt = sm.coopAt = now; break; }
        }
      }
      continue;
    }
    if (sm.act) {
      if (now >= sm.act.until || threatened(w, arena, p, sm, true)) sm.act = null;
      else { playGoof(w, id, p, sm.act, now); out.onGoof?.(id, sm.act.k); }
    }
    if ((w.tick + id) % IDLE_ROLL_TICKS !== 0 || sm.act || sm.queue.length) continue;
    const calm = now - sm.hurtAt > 5000 && now - (s.firedAt.get(id) ?? -Infinity) > 3000;
    if (!calm) continue;
    // A word to nobody now and then, alive and calm: about 2 % a minute for a chatty bot.
    if (say(id, sm, 'idle', { odds: CHAT_ODDS.idle / 60 })) continue;
    // A truce offered to a person about who is not fighting.
    if (versus(w)) {
      const team = w.mode === 'FFA' ? 1 : 0.5;
      const sociable = sm.soc >= 1 ? 1 : 0.2;
      for (const h of w.players.values()) {
        if (h.kind !== 'human' || h.life.k !== 'alive' || !isEnemy(p, h) || sm.truce.some((t) => t.id === h.id)) continue;
        if (Math.hypot(h.x - p.x, h.y - p.y) > OFFER_PX || now - (s.people.get(h.id)?.firedAt ?? -Infinity) < 3000 || now - (sm.askedAt[h.id] ?? -Infinity) < 90_000) continue;
        if (!losClear(arena, p, h, 'sight')) continue;
        if (roll(sm) >= 0.01 * sociable * OFFER[mem.persona] * team) continue;
        sm.askedAt[h.id] = now;
        sm.truce = [...sm.truce, { id: h.id, until: now + 7000, betrayAt: null, offer: true }];
        roll(sm) < 0.6 ? emote(sm, 'wave', 200 + roll(sm) * 400) : goof(sm, 'spin', 200 + roll(sm) * 400, h.id);
        say(id, sm, 'truce');
        break;
      }
    }
    if (sm.queue.length || threatened(w, arena, p, sm)) continue;
    const r = roll(sm), g = sm.goof;
    if (r < IDLE_GOOF.wiggle * g) sm.act = startGoof(sm, 'wiggle', now, p, w);
    else if (r < (IDLE_GOOF.wiggle + IDLE_GOOF.air) * g) sm.act = startGoof(sm, 'air', now, p, w);
    else if (r < (IDLE_GOOF.wiggle + IDLE_GOOF.air + IDLE_GOOF.spin) * g) sm.act = startGoof(sm, 'spin', now, p, w);
    else if (g >= 1.5 && r < (IDLE_GOOF.wiggle + IDLE_GOOF.air + IDLE_GOOF.spin) * g + IDLE_GOOF.spam) {
      // A burst of emotes, each as fast as the limit lets them.
      const n = 3 + Math.floor(roll(sm) * 3);
      let at = 0;
      for (let i = 0; i < n; i++) { emote(sm, pickOf(() => roll(sm), SPAM), at, true); at += EMOTE_INTERVAL_MS + 50 + roll(sm) * 350; }
    }
  }
}

function makeTruce(sm: SocialMem, id: number, now: number, persona: PersonalityId): Truce {
  const until = now + TRUCE_MS[0] + roll(sm) * (TRUCE_MS[1] - TRUCE_MS[0]);
  const betrayAt = roll(sm) < BETRAY[persona] ? now + 6000 + roll(sm) * (until - now - 6000) : null;
  return { id, until, betrayAt, offer: false };
}

/**
 * A heading to fire a couple of rounds along with nothing a round could hurt or break on it inside the gun's reach: no player, no barrel,
 * no prop, no crate (a broken crate or prop would also change the bots' nav grid). Null with none.
 */
function skyward(w: World, p: Player, start: number): number | null {
  const reach = GUNS[p.gun].range + 150;
  const things: { x: number; y: number; r: number }[] = [];
  for (const q of w.players.values()) if (q.id !== p.id && q.life.k !== 'dead') things.push({ x: q.x, y: q.y, r: WORLD.playerRadius });
  for (const b of w.barrels) if (b.respawnAt === null) things.push({ x: b.x, y: b.y, r: 30 });
  for (const q of w.props) if (q.respawnAt === null) things.push({ x: q.x, y: q.y, r: 30 });
  for (const c of w.crates) if (c.respawnAt === null) things.push({ x: c.x + c.size / 2, y: c.y + c.size / 2, r: c.size * 0.75 });
  const near = things.filter((t) => Math.hypot(t.x - p.x, t.y - p.y) < reach + t.r);
  for (let k = 0; k < 8; k++) {
    const a = start + (k * TAU) / 8;
    const hits = near.some((t) => {
      const d = Math.hypot(t.x - p.x, t.y - p.y);
      if (d < t.r + 10) return true;
      const off = Math.atan2(t.y - p.y, t.x - p.x) - a;
      // Its body's width as seen from here, and the gun's spread and then some.
      return Math.abs(Math.atan2(Math.sin(off), Math.cos(off))) < Math.asin(Math.min(1, t.r / d)) + 0.2;
    });
    if (!hits) return a;
  }
  return null;
}

function startGoof(sm: SocialMem, k: GoofKind, now: number, p: Player, w: World): Goof | null {
  if (k === 'spin') {
    const dir = roll(sm) < 0.5 ? 1 : -1;
    const turns = 1 + roll(sm) * 0.35 + (roll(sm) < 0.2 ? 1 : 0);
    return { k, from: now, until: now + 450 * turns + roll(sm) * 300, a0: p.angle, turn: dir * TAU * turns, flipMs: 0, vertical: false };
  }
  if (k === 'wiggle') return { k, from: now, until: now + 500 + roll(sm) * 500, a0: p.angle, turn: 0, flipMs: 70 + roll(sm) * 70, vertical: roll(sm) < 0.3 };
  const a = skyward(w, p, roll(sm) * TAU);
  if (a === null || p.life.k !== 'alive' || p.life.ammo < 3 || p.life.reloadUntil !== null) return null;
  // Two or three rounds: the trigger held for that many of the gun's cycles.
  const rounds = 2 + (roll(sm) < 0.4 ? 1 : 0);
  return { k, from: now, until: now + Math.min(900, GUNS[p.gun].fireMs * (rounds - 0.5)), a0: a, turn: 0, flipMs: 0, vertical: false };
}

/** Overrides the bot's decided input for this tick with its goof. */
function playGoof(w: World, id: number, p: Player, g: Goof, now: number): void {
  const base: InputState = { ...p.input, up: false, down: false, left: false, right: false, fire: false, sprint: false, reload: false, ability: false };
  const t = Math.min(1, (now - g.from) / Math.max(1, g.until - g.from));
  let input: InputState;
  if (g.k === 'spin') input = { ...base, angle: g.a0 + g.turn * (t * t * (3 - 2 * t)) };
  else if (g.k === 'wiggle') {
    const side = Math.floor((now - g.from) / g.flipMs) % 2 === 0;
    input = g.vertical ? { ...base, up: side, down: !side } : { ...base, left: side, right: !side };
  } else input = { ...base, angle: g.a0, fire: true };
  setInput(w, id, w.tick, input);
}
