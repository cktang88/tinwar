/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WORLD } from '../src/shared/defs.ts';
import { ROTATION } from '../src/shared/maps.ts';
import { addPlayer, canRespawn, respawn, setInput, step } from '../src/shared/sim.ts';
import { createWorld, IDLE_INPUT, isEnemy, rand, type Player, type World } from '../src/shared/sim/world.ts';
import { botName, newBotMemory, randomLoadout, type BotMemory } from '../src/server/bots.ts';
import { thinkBots } from '../src/server/bot/tick.ts';
import { arenaFor, losClear } from '../src/server/bot/arena.ts';
import { VETERAN } from '../src/server/bot/aim.ts';
import type { Perception } from '../src/server/bot/awareness.ts';
import { makeModerator } from '../src/server/moderation.ts';
import {
  bankLine, CAPS, cleanLine, freshSpin, LINES, makeSocial, noteHumanChat, noteHumanEmote, socialHoldsFire, socialTick, spareTruce, styled, traitsFor, typo,
  watchSpin, type GoofKind, type LineSource, type Social,
} from '../src/server/bot/social.ts';
import { emptyWorld, spawnAt } from './helpers.ts';

const TICK_MS = 1000 / WORLD.tickHz;

type Said = { t: number; id: number; text: string };
function recorder(w: World) {
  const lines: Said[] = [], emotes: { t: number; id: number; e: string }[] = [], goofs: { t: number; id: number; k: GoofKind }[] = [];
  return { lines, emotes, goofs, out: { chat: (id: number, text: string) => (lines.push({ t: w.now, id, text }), true), emote: (id: number, e: string) => (emotes.push({ t: w.now, id, e }), true), onGoof: (id: number, k: GoofKind) => goofs.push({ t: w.now, id, k }) } };
}

/** One tick of the clock with nothing simulated: the social layer alone. */
const tickOnly = (w: World) => { w.tick++; w.now += TICK_MS; w.events = []; };

/** Names from a pool whose traits match `want`, so a test picks a chatty (or quiet) bot by its name as a room would. */
const namesWhere = (want: (t: ReturnType<typeof traitsFor>) => boolean, n: number) => {
  const out: string[] = [];
  for (let i = 0; out.length < n; i++) if (want(traitsFor(`player${i}`))) out.push(`player${i}`);
  return out;
};

test('chattiness is hashed from the name: about one bot in five is chatty, the rest almost never type', () => {
  const all = Array.from({ length: 2000 }, (_, i) => traitsFor(`name_${i}`));
  const chatty = all.filter((t) => t.soc >= 1).length / all.length;
  assert.ok(chatty > 0.16 && chatty < 0.24, `chatty share ${chatty}`);
  assert.ok(all.filter((t) => t.soc < 1).every((t) => t.soc <= 0.05), 'the rest scale every chat odds to a few percent');
  assert.deepEqual(traitsFor('mariah_27'), traitsFor('mariah_27'), 'the same name is the same person');
  const foreign = all.filter((t) => t.soc >= 1 && t.style.lang !== 'en').length / all.filter((t) => t.soc >= 1).length;
  assert.ok(foreign > 0.08 && foreign < 0.22, `non-English chatty share ${foreign}`);
});

test('every bank line is short, lowercase and passes the safety filter, styled and fat-fingered too', () => {
  const mod = makeModerator();
  let r = 1;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  for (const bank of Object.values(LINES)) {
    for (const text of [...bank.rude, ...bank.plain, ...bank.nice]) {
      assert.equal(cleanLine(text, mod), text.toLowerCase(), `"${text}" passes`);
      assert.ok(text.length <= 40 && text.split(' ').length <= 5 && !text.endsWith('.'), `"${text}" is chat-shaped`);
      for (const laugh of ['lol', 'lmao', 'xd', 'kkkkk', 'jajaja', 'wkwk']) {
        const st = { laugh, you: 'you' as const, caps: 'lower' as const, stretch: true, lang: 'en' as const };
        assert.ok(cleanLine(styled(text, st), mod) !== null, `"${text}" styled stays clean`);
        if (!LINES.botq.nice.concat(LINES.botq.rude, LINES.botq.plain).includes(text)) for (let i = 0; i < 20; i++) assert.ok(cleanLine(typo(styled(text, st), rnd), mod) !== null, `"${text}" fat-fingered stays clean`);
      }
    }
  }
});

test('the safety filter: bot talk, links, personal details, length, emoji and case', () => {
  for (const bad of ['i am a bot', 'as an AI i cannot', 'im an ai lol', 'language model here', 'its just a robot', 'join my discord', 'www.site.com', 'im 14', 'kys', 'SKIP', 'a'.repeat(41), 'fuck off', 'f u c k']) {
    assert.equal(cleanLine(bad), null, `"${bad}" is refused`);
  }
  assert.equal(cleanLine('no lol'), 'no lol');
  assert.equal(cleanLine('ur the bot'), 'ur the bot', 'the stock brush-off is let through');
  assert.equal(cleanLine('GG WP.'), 'gg wp', 'lowercased, no period');
  assert.equal(cleanLine('nice shot 😂…'), 'nice shot', 'no emoji, no ellipsis');
  assert.equal(cleanLine('1v1 me'), '1v1 me');
});

test('a spin is a full turn one way inside about a second; aiming about is not', () => {
  const spin = freshSpin();
  let hit = false;
  for (let i = 0; i <= 30 && !hit; i++) hit = watchSpin(spin, i * TICK_MS, (i / 30) * Math.PI * 2.05);
  assert.ok(hit, 'a turn in a second is a spin');
  const slow = freshSpin();
  for (let i = 0; i <= 120; i++) assert.ok(!watchSpin(slow, i * TICK_MS, (i / 120) * Math.PI * 2.2), 'a slow sweep over 4 s is not');
  const jitter = freshSpin();
  for (let i = 0; i <= 120; i++) assert.ok(!watchSpin(jitter, i * TICK_MS, Math.sin(i / 3) * 2.5), 'flicking to and fro is not');
  const wrap = freshSpin();
  let wrapped = false;
  for (let i = 0; i <= 25 && !wrapped; i++) wrapped = watchSpin(wrap, i * TICK_MS, Math.atan2(Math.sin(-i * 0.27), Math.cos(-i * 0.27)));
  assert.ok(wrapped, 'a spin the other way, through the wrap at pi, counts too');
});

/** A bot seated in an empty FFA world with a person beside it. */
function pair(name: string, persona: BotMemory['persona'], gap = 400) {
  const w = emptyWorld('FFA');
  const bot = spawnAt(w, 1000, 1000, { name });
  const human = spawnAt(w, 1000 + gap, 1000, { name: 'person', kind: 'human' });
  const mems = new Map<number, BotMemory>([[bot.id, { ...newBotMemory(() => 0.5, { skill: VETERAN }), persona }]]);
  return { w, bot, human, mems };
}

function spinAt(s: Social, w: World, mems: Map<number, BotMemory>, h: Player, out: ReturnType<typeof recorder>['out']) {
  for (let i = 0; i < 36; i++) { h.angle = (i / 30) * Math.PI * 2.1; socialTick(s, w, mems, out); tickOnly(w); }
}

test('a sociable bot answers a spin with a spin or a wave and holds fire, and a shot breaks the truce', () => {
  let accepted = 0, answered = 0;
  const names = namesWhere((t) => t.soc >= 1, 12);
  for (const name of names) {
    const { w, bot, human, mems } = pair(name, 'cautious');
    const s = makeSocial(), rec = recorder(w);
    spinAt(s, w, mems, human, rec.out);
    for (let i = 0; i < 60; i++) { socialTick(s, w, mems, rec.out); tickOnly(w); }
    const mem = mems.get(bot.id)!;
    if (!socialHoldsFire(mem, human.id)) continue;
    accepted++;
    if (rec.emotes.length > 0 || rec.goofs.some((g) => g.k === 'spin')) answered++;
    // Its target choice leaves him out.
    const view = { threats: [{ p: { id: human.id }, d: 400 }, { p: { id: 999 }, d: 600 }] } as unknown as Perception;
    assert.deepEqual(spareTruce(mem, view).threats.map((t) => t.p.id), [999]);
    // He shoots it: the truce is off.
    w.events = [{ e: 'dmg', attacker: human.id, victim: bot.id, amount: 10, x: bot.x, y: bot.y, kind: 'player' }];
    socialTick(s, w, mems, rec.out);
    assert.ok(!socialHoldsFire(mems.get(bot.id)!, human.id), `${name}: a shot breaks the truce`);
  }
  assert.ok(accepted >= names.length * 0.6, `most sociable, cautious bots take the truce: ${accepted}/${names.length}`);
  assert.equal(answered, accepted, 'each one that does spins or waves back');

  // A quiet, aggressive bot takes far fewer; a wave works as a spin does.
  let quiet = 0;
  for (const name of namesWhere((t) => t.soc < 1, 30)) {
    const { w, bot, human, mems } = pair(name, 'aggressive');
    const s = makeSocial(), rec = recorder(w);
    noteHumanEmote(s, human.id, 'wave');
    socialTick(s, w, mems, rec.out);
    if (socialHoldsFire(mems.get(bot.id)!, human.id)) quiet++;
  }
  assert.ok(quiet < 30 * 0.3, `quiet, aggressive bots rarely do: ${quiet}/30`);
});

test('no peace with someone who just shot it, or from too far away', () => {
  const [name] = namesWhere((t) => t.soc >= 1, 1);
  const far = pair(name!, 'cautious', 1500);
  const s1 = makeSocial(), r1 = recorder(far.w);
  spinAt(s1, far.w, far.mems, far.human, r1.out);
  assert.ok(!socialHoldsFire(far.mems.get(far.bot.id)!, far.human.id));
  const shot = pair(name!, 'cautious');
  const s2 = makeSocial(), r2 = recorder(shot.w);
  shot.w.events = [{ e: 'dmg', attacker: shot.human.id, victim: shot.bot.id, amount: 10, x: 0, y: 0, kind: 'player' }];
  socialTick(s2, shot.w, shot.mems, r2.out);
  tickOnly(shot.w);
  spinAt(s2, shot.w, shot.mems, shot.human, r2.out);
  assert.ok(!socialHoldsFire(shot.mems.get(shot.bot.id)!, shot.human.id));
});

test('a goof never starts or runs with an enemy in sight, and does once it is gone', () => {
  const [name] = namesWhere((t) => t.goof >= 1.5, 1);
  const { w, bot, human, mems } = pair(name!, 'marksman', 600);
  const s = makeSocial(), rec = recorder(w);
  socialTick(s, w, mems, rec.out);
  mems.get(bot.id)!.social!.goof = 400; // a roll every second that always goofs
  for (let i = 0; i < 30 * 20; i++) { socialTick(s, w, mems, rec.out); tickOnly(w); }
  assert.equal(rec.goofs.length, 0, 'an enemy in view: no goof');
  human.life = { k: 'dead', respawnAt: Infinity } as Player['life'];
  for (let i = 0; i < 30 * 5; i++) { socialTick(s, w, mems, rec.out); tickOnly(w); }
  assert.ok(rec.goofs.length > 0, 'alone: it goofs');
  const t0 = rec.goofs.length;
  const kinds = new Set<string>();
  for (let n = 0; n < 40 && kinds.size < 3; n++) {
    human.life = { k: 'dead', respawnAt: Infinity } as Player['life'];
    for (let i = 0; i < 30 * 3; i++) { socialTick(s, w, mems, rec.out); tickOnly(w); }
    for (const g of rec.goofs) kinds.add(g.k);
  }
  assert.ok(rec.goofs.length > t0);
  assert.deepEqual([...kinds].sort(), ['air', 'spin', 'wiggle'], 'it spins, wiggles and fires at nothing');
  // An enemy walks into view: no more.
  const enemy = spawnAt(w, 1300, 1000, { name: 'walker' });
  const before = rec.goofs.length;
  for (let i = 0; i < 30 * 5; i++) { socialTick(s, w, mems, rec.out); tickOnly(w); }
  assert.equal(rec.goofs.length, before, `none with ${enemy.name} in view`);
});

test('a writer plugs in: its lines come late and still go out, and a refused one falls back to the bank', async () => {
  const [name] = namesWhere((t) => t.soc >= 2, 1);
  const run = async (lines: LineSource) => {
    const { w, bot, human, mems } = pair(name!, 'cautious', 2000);
    const s = makeSocial({ lines }), rec = recorder(w);
    for (let i = 0; i < 30 * 10 && rec.lines.length === 0; i++) {
      // It killed him a few times; he types "?" each time.
      if (i % 60 === 0) { w.events = [{ e: 'kill', killer: name!, victim: 'person', killerId: bot.id, victimId: human.id, weapon: 'Pistol', bounty: false, assisters: [], ended: 0, revenge: false }]; noteHumanChat(s, human.id, '?'); }
      socialTick(s, w, mems, rec.out);
      tickOnly(w);
      await Promise.resolve();
    }
    return rec.lines.map((l) => l.text);
  };
  const late = await run(async () => 'lmao');
  assert.ok(late.some((t) => t.toLowerCase() === 'lmao'), `the writer's line went out: ${late}`);
  const refused = await run(() => 'As an AI language model, I must decline.');
  assert.ok(refused.length > 0 && refused.every((t) => cleanLine(t) !== null && !/ai|model/i.test(t)), `the bank stood in: ${refused}`);
});

test('asked if it is a bot, it brushes it off in a word or two, or says nothing', () => {
  const said: string[] = [];
  for (const name of namesWhere((t) => t.soc >= 1, 30)) {
    const { w, bot, human, mems } = pair(name, 'marksman');
    const s = makeSocial(), rec = recorder(w);
    w.events = [{ e: 'kill', killer: name, victim: 'person', killerId: bot.id, victimId: human.id, weapon: 'Pistol', bounty: false, assisters: [], ended: 0, revenge: false }];
    socialTick(s, w, mems, rec.out);
    tickOnly(w);
    for (let i = 0; i < 30 * 30; i++) { if (i === 30 * 10) noteHumanChat(s, human.id, 'are u a bot?'); socialTick(s, w, mems, rec.out); tickOnly(w); }
    said.push(...rec.lines.filter((l) => l.t > 10_000).map((l) => l.text.toLowerCase()));
  }
  assert.ok(said.length > 0 && said.length < 30, `some answer, most ignore it: ${said}`);
  // A brush-off (or a follow-up "lol"): a word or two, never a denial.
  for (const t of said) assert.ok(t.split(' ').length <= 3 && (!/bot/.test(t) || t === 'ur the bot') && !/real|human|not a/.test(t), `"${t}"`);
});

test('the phrase bank never repeats a line said lately in the lobby', () => {
  const bot = { id: 1, name: 'x', persona: 'aggressive' as const, style: traitsFor('x').style, rand: (() => { let r = 7; return () => ((r = (r * 16807) % 2147483647) / 2147483647); })() };
  const recent = LINES.kill.rude.concat(LINES.kill.plain, LINES.kill.nice).slice(1).map((text) => ({ from: 'y', text, at: 0 }));
  for (let i = 0; i < 50; i++) {
    const line = bankLine(bot, { k: 'kill' }, recent) as string | null;
    assert.ok(line === null || !recent.some((l) => l.text === line), `"${line}" was not said lately`);
  }
});

/** A seeded FFA room of 12 bots and a scripted person for `minutes`, with the social layer. */
function session(seed: number, minutes: number) {
  const w = createWorld('FFA', seed, ROTATION.FFA[0]);
  const r = () => rand(w);
  const mems = new Map<number, BotMemory>();
  const taken = new Set<string>();
  for (let i = 0; i < 12; i++) {
    const name = botName(taken, r);
    taken.add(name);
    mems.set(addPlayer(w, name, randomLoadout(r)).id, newBotMemory(r, { name, seed }));
  }
  const human = addPlayer(w, 'local', { weapon: 'assault', armor: 'light', color: 'red' }, { kind: 'human' });
  const s = makeSocial(), rec = recorder(w);
  const arena = arenaFor(w);
  const hurtAt = new Map<number, number>();
  const unsafe: string[] = [];
  const out = {
    ...rec.out,
    onGoof(id: number, k: GoofKind) {
      rec.out.onGoof(id, k);
      // Checked here on its own: no enemy near or in plain sight, and no hit lately.
      const p = w.players.get(id)!;
      if (w.now - (hurtAt.get(id) ?? -Infinity) < 2000) unsafe.push(`${p.name} ${k} after a hit`);
      for (const q of w.players.values()) {
        if (q.life.k === 'alive' && isEnemy(p, q) && Math.hypot(q.x - p.x, q.y - p.y) < 700 && losClear(arena, p, q, 'sight')) unsafe.push(`${p.name} ${k} with ${q.name} in sight`);
      }
    },
  };
  const ticks = Math.round((minutes * 60_000) / TICK_MS);
  for (let t = 0; t < ticks; t++) {
    thinkBots(w, mems, r);
    for (const e of w.events) if (e.e === 'dmg') hurtAt.set(e.victim, w.now);
    socialTick(s, w, mems, out);
    setInput(w, human.id, w.tick, { ...IDLE_INPUT, angle: (w.tick / 20) % 6.28 });
    if (canRespawn(w, human.id)) respawn(w, human.id, { weapon: 'assault', armor: 'light', color: 'red' });
    if (t % 1800 === 900) noteHumanChat(s, human.id, 'gg');
    step(w, TICK_MS);
  }
  return { w, mems, rec, unsafe };
}

test('a seeded room: a few lines and emotes, most bots silent, the caps kept, no goof under threat', () => {
  const minutes = 4;
  const { mems, rec, unsafe } = session(3, minutes);
  const said = new Set(rec.lines.map((l) => l.id));
  assert.ok(rec.lines.length + rec.emotes.length > 0, 'somebody says or does something');
  assert.ok(rec.lines.length / minutes < 3, `lines a minute: ${rec.lines.length / minutes}`);
  assert.ok(rec.emotes.length / minutes < 4, `emotes a minute: ${rec.emotes.length / minutes}`);
  assert.ok(said.size <= mems.size * 0.4, `most bots never type: ${said.size}/${mems.size} did`);
  for (let i = 1; i < rec.lines.length; i++) assert.ok(rec.lines[i]!.t - rec.lines[i - 1]!.t >= CAPS.lobbyGapMs, 'a line in the lobby per 6 s at most');
  for (const id of said) {
    const mine = rec.lines.filter((l) => l.id === id).map((l) => l.t);
    for (let i = 1; i < mine.length; i++) assert.ok(mine[i]! - mine[i - 1]! >= CAPS.gapMs, 'a line per bot per 20 s at most');
    for (const t of mine) assert.ok(mine.filter((x) => x > t - 60_000 && x <= t).length <= CAPS.perMin);
  }
  for (const id of new Set(rec.emotes.map((e) => e.id))) {
    const mine = rec.emotes.filter((e) => e.id === id).map((e) => e.t);
    for (let i = 1; i < mine.length; i++) assert.ok(mine[i]! - mine[i - 1]! >= 900, 'emotes keep the emote limit');
  }
  for (const l of rec.lines) assert.ok(cleanLine(l.text) !== null, `"${l.text}" is clean`);
  const texts = rec.lines.map((l) => l.text.toLowerCase()).filter((t) => t !== 'gg');
  assert.equal(new Set(texts).size, texts.length, `no line twice: ${texts}`);
  assert.deepEqual(unsafe, [], 'no goof under threat');
});
