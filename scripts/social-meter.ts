/// <reference types="node" />
// Usage: node scripts/social-meter.ts [minutes=10] [seed=1]
// A seeded FFA room of 16 bots and 2 scripted people, played with the social layer (bot/social.ts) for `minutes`: bots' lines and emotes a
// minute, the share of bots that never typed, goofs, and every line said.
import { WORLD } from '../src/shared/defs.ts';
import { ROTATION } from '../src/shared/maps.ts';
import type { InputState } from '../src/shared/protocol.ts';
import { addPlayer, canRespawn, respawn, setInput, step } from '../src/shared/sim.ts';
import { createWorld, rand, type Player, type World } from '../src/shared/sim/world.ts';
import { botName, newBotMemory, randomLoadout, type BotMemory } from '../src/server/bots.ts';
import { thinkBots } from '../src/server/bot/tick.ts';
import { makeSocial, noteHumanChat, socialTick } from '../src/server/bot/social.ts';

const minutes = Number(process.argv[2] ?? 10);
const seed = Number(process.argv[3] ?? 1);
const TICK_MS = 1000 / WORLD.tickHz;

const w: World = createWorld('FFA', seed, ROTATION.FFA[0]);
const r = () => rand(w);
const bots = new Map<number, BotMemory>();
const taken = new Set<string>();
for (let i = 0; i < 16; i++) {
  const name = botName(taken, r);
  taken.add(name);
  bots.set(addPlayer(w, name, randomLoadout(r)).id, newBotMemory(r, { name, seed }));
}
const humans = [addPlayer(w, 'local', { weapon: 'assault', armor: 'light', color: 'red' }, { kind: 'human' }), addPlayer(w, 'other', { weapon: 'smg', armor: 'light', color: 'blue' }, { kind: 'human' })];

function nearest(me: Player): Player | null {
  let best: Player | null = null, d0 = Infinity;
  for (const p of w.players.values()) if (p.id !== me.id && p.life.k === 'alive') { const d = Math.hypot(p.x - me.x, p.y - me.y); if (d < d0) { d0 = d; best = p; } }
  return best;
}
function humanInput(h: Player, phase: number): InputState {
  const t = nearest(h);
  const angle = t ? Math.atan2(t.y - h.y, t.x - h.x) : 0;
  const dist = t ? Math.hypot(t.x - h.x, t.y - h.y) : 0;
  const s = Math.floor((w.tick + phase) / 45) % 4;
  return { up: s === 0, down: s === 2, left: s === 3, right: s === 1, angle, fire: dist < 600, shots: h.input.shots, reload: false, ability: false, aimDist: Math.min(dist, 500), use: false };
}

const social = makeSocial();
const lines: { t: number; who: string; text: string }[] = [];
const emotes: { t: number; who: string; id: string }[] = [];
const goofs = new Map<string, number>();
let goofing = new Set<number>(), wasGoofing = new Set<number>();
const out = {
  chat(id: number, text: string) { lines.push({ t: w.now, who: w.players.get(id)!.name, text }); return true; },
  emote(id: number, e: string) { emotes.push({ t: w.now, who: w.players.get(id)!.name, id: e }); return true; },
  onGoof(id: number, k: string) { if (!wasGoofing.has(id)) goofs.set(k, (goofs.get(k) ?? 0) + 1); goofing.add(id); },
};
let lastOver = false;
const ticks = Math.round((minutes * 60_000) / TICK_MS);
for (let tick = 0; tick < ticks; tick++) {
  thinkBots(w, bots, r);
  socialTick(social, w, bots, out);
  wasGoofing = goofing;
  goofing = new Set();
  for (const [i, h] of humans.entries()) {
    setInput(w, h.id, w.tick, humanInput(h, i * 17));
    if (canRespawn(w, h.id)) respawn(w, h.id, { weapon: 'assault', armor: 'light', color: 'red' });
  }
  // The people say "gg" at a round's end, and "?" now and then after a death.
  const over = w.match.k === 'over';
  if (over && !lastOver) noteHumanChat(social, humans[0]!.id, 'gg');
  lastOver = over;
  for (const e of w.events) if (e.e === 'kill' && e.victimId === humans[1]!.id && r() < 0.3) noteHumanChat(social, humans[1]!.id, '?');
  step(w, TICK_MS);
}
const silent = [...bots.keys()].filter((id) => !lines.some((l) => l.who === w.players.get(id)?.name)).length;
const mute = [...bots.keys()].filter((id) => { const n = w.players.get(id)?.name; return !lines.some((l) => l.who === n) && !emotes.some((e) => e.who === n); }).length;
console.log(`${minutes} min, seed ${seed}: ${lines.length} lines (${(lines.length / minutes).toFixed(2)}/min), ${emotes.length} emotes (${(emotes.length / minutes).toFixed(2)}/min)`);
console.log(`bots that never typed: ${silent}/${bots.size} (${Math.round((100 * silent) / bots.size)}%); never typed nor emoted: ${mute}/${bots.size}`);
console.log(`goofs: ${[...goofs].map(([k, n]) => `${k} ${n}`).join(', ') || 'none'}; kills ${[...w.players.values()].reduce((s, p) => s + p.kills, 0)}`);
for (const l of lines) console.log(`  ${(l.t / 1000).toFixed(1).padStart(6)}s ${l.who}: ${l.text}`);
