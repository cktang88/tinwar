import { UTILITY, ZOMBIE_KINDS, ZOMBIES, type VentDir } from '../shared/defs.ts';
import { ZOMBIE_FX, type BuildingView, type ZombieView } from '../shared/protocol.ts';
import { cellRect, jetOf, levelOf, reachAt, turretDef, type Jet } from '../shared/sim/build.ts';
import { glowSprite } from './coreart.ts';
import { INK, tint } from './palette.ts';
import { LIGHT } from './tilt.ts';
import { seeded, wearStage, type Wear } from './turretart.ts';

/**
 * The two buildables that are neither gun nor wall: the flame vent, a flamer on a base that throws a jet of fire one way, and the decoy beacon,
 * a mast with a loudspeaker and a blinking lamp that draws the horde off the walls. Their bodies are drawn with the buildings (the vent's scorch with the floor),
 * their light (the vent's jet and embers, the beacon's lamp and its pull) over the night's shade. Also the marks the horde carries: a coil's charge, a vent's fire.
 */

const TAU = Math.PI * 2;
const FLAME_HOT = '#fff1b8', FLAME = '#ffb347', FLAME_DEEP = '#ff6a2a', SOOT = '#2a2522';
const SPARK = '#bfe3ff';

/** How long a vent's flame burns on after its last puff, as the sim has it (`TurretDef.burn.patchMs`). */
export const ventFlameMs = (lv: number) => turretDef('vent', lv).burn!.patchMs;

/** A vent's facing from its view (east when a view carries none). */
const dirOfView = (b: BuildingView): VentDir => ('dir' in b && b.dir !== undefined ? b.dir : 0);
/** Points along a jet: `along` px out from its start, `across` px off its line (positive to the facing's right). */
const jetPoint = (j: Jet, along: number, across: number) => ({ x: j.x0 + j.ux * along - j.uy * across, y: j.y0 + j.uy * along + j.ux * across });
/** The jet's outline, nozzle to tip, as the sim judges it (`inJet`). */
function jetPath(ctx: CanvasRenderingContext2D, j: Jet, grow = 0) {
  const a = jetPoint(j, 0, -(j.w0 + grow)), b2 = jetPoint(j, j.len + grow, -(j.w1 + grow)), c = jetPoint(j, j.len + grow, j.w1 + grow), d = jetPoint(j, 0, j.w0 + grow);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y); ctx.lineTo(b2.x, b2.y);
  ctx.quadraticCurveTo(...(Object.values(jetPoint(j, j.len + grow + j.w1 * 0.6, 0)) as [number, number]), c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
}

/**
 * The scorch a flame vent leaves on the floor down its jet: a soot tongue widening from the nozzle, darkest in the middle, with a few
 * charred streaks along it. Drawn with the floor, under bodies.
 */
export function drawVentScorch(ctx: CanvasRenderingContext2D, b: BuildingView) {
  const j = jetOf(b.cx, b.cy, dirOfView(b), levelOf(b));
  ctx.save();
  ctx.fillStyle = 'rgba(24, 20, 17, 0.2)';
  jetPath(ctx, j, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(18, 15, 13, 0.24)';
  jetPath(ctx, { ...j, w0: j.w0 * 0.55, w1: j.w1 * 0.6, len: j.len * 0.85 });
  ctx.fill();
  const rnd = seeded(b.cx * 41 + b.cy * 7);
  ctx.strokeStyle = 'rgba(14, 12, 10, 0.35)';
  ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const off = (rnd() - 0.5) * j.w0 * 1.4, from = rnd() * j.len * 0.3, to = from + j.len * (0.35 + rnd() * 0.45);
    const p0 = jetPoint(j, from, off), p1 = jetPoint(j, to, off * 1.5);
    ctx.lineWidth = 1.5 + rnd() * 2;
    ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
  }
  ctx.lineCap = 'butt';
  ctx.restore();
}

/**
 * A flame vent: a squat steel base sandbagged on its cell, a fuel tank strapped to its back with a hazard band, and a stubby flamer nozzle on a
 * bracket pointing down its facing, a pilot flame at the tip. A longer nozzle with a heat shroud at level 2, a second tank at level 3. Badly damaged,
 * the tank is dented black and the nozzle droops. The fuel gauge's cells show the fuel.
 */
export function drawVentHead(ctx: CanvasRenderingContext2D, b: { cx: number; cy: number; hp: number; lv?: number; dir?: VentDir; ammo?: number }, cx: number, cy: number, now: number) {
  const lv = levelOf(b), wear = wearStage(b.hp), dir = b.dir ?? 0;
  const ang = [0, Math.PI / 2, Math.PI, -Math.PI / 2][dir]!;
  // The base: a rounded steel block on the floor.
  ctx.fillStyle = 'rgba(24, 20, 17, 0.3)';
  ctx.beginPath();
  ctx.ellipse(cx + 2, cy + 4, 21, 18, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = wear === 2 ? '#3d3a37' : '#5a5f68';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.roundRect(cx - 17, cy - 17, 34, 34, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.fillRect(cx - 15, cy - 15.5, 30, 1.8);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ang);
  // The tank (two at level 3) across the back, with a hazard band.
  const tanks = lv >= 3 ? [-6.5, 6.5] : [0];
  for (const ty of tanks) {
    ctx.fillStyle = wear === 2 ? '#2f2b28' : '#b3412b';
    ctx.beginPath();
    ctx.roundRect(-16, ty - 6, 15, 12, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#e0a43a';
    ctx.fillRect(-11, ty - 6, 3, 12);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillRect(-14, ty - 4.5, 10, 1.5);
  }
  // The fuel line and the nozzle on its bracket, pointing out along the facing; a droop when badly damaged.
  if (wear === 2) ctx.rotate(0.22);
  const len = 16 + lv * 3;
  ctx.fillStyle = '#3a3f48';
  ctx.beginPath();
  ctx.roundRect(-3, -6, 10, 12, 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#8d939c';
  ctx.beginPath();
  ctx.moveTo(4, -4); ctx.lineTo(len, -2.6); ctx.lineTo(len, 2.6); ctx.lineTo(4, 4); ctx.closePath();
  ctx.fill();
  ctx.stroke();
  if (lv >= 2) {
    // A slotted heat shroud over the barrel.
    ctx.fillStyle = '#4b5059';
    ctx.fillRect(7, -4, len - 12, 8);
    ctx.strokeRect(7, -4, len - 12, 8);
    ctx.fillStyle = INK;
    for (let x = 9; x < len - 6; x += 3) ctx.fillRect(x, -2.6, 1.2, 5.2);
  }
  // The muzzle ring and its pilot.
  ctx.fillStyle = SOOT;
  ctx.beginPath();
  ctx.roundRect(len - 1, -3.8, 4, 7.6, 1.5);
  ctx.fill();
  ctx.stroke();
  const breathe = 0.5 + 0.5 * Math.sin(now / 300 + b.cx);
  ctx.fillStyle = FLAME;
  ctx.globalAlpha = 0.55 + 0.35 * breathe;
  ctx.beginPath();
  ctx.ellipse(len + 4.5, 0, 2.6 + breathe, 1.6, 0, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
  // The fuel gauge along the base's bottom edge: five cells, orange while there is fuel, red when dry.
  const ammo = b.ammo ?? 10, cells = 5, lit = ammo === 0 ? 0 : Math.max(1, Math.ceil((ammo / 10) * cells));
  for (let i = 0; i < cells; i++) {
    ctx.fillStyle = i < lit ? FLAME : ammo === 0 && Math.floor(now / 250) % 2 === 0 ? '#e5484d' : '#2a2e36';
    ctx.fillRect(cx - 12 + i * 4.8 + 0.5, cy + 12, 3.8, 3);
  }
}

/** The ghost of a vent's jet in build mode: the area it would torch, washed and dash-edged in the ghost's colour, so it can be aimed down a gap. */
export function drawVentJetPreview(ctx: CanvasRenderingContext2D, cx: number, cy: number, dir: VentDir, lv: number, color: string, now: number) {
  const j = jetOf(cx, cy, dir, lv);
  ctx.save();
  ctx.globalAlpha = 0.18 + 0.06 * Math.sin(now / 200);
  ctx.fillStyle = color;
  jetPath(ctx, j);
  ctx.fill();
  ctx.globalAlpha = 0.9;
  ctx.setLineDash([8, 6]);
  ctx.lineDashOffset = -now / 50;
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.setLineDash([]);
  // Chevrons down its line, pointing the way it faces.
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = 2.4;
  for (let at = 30; at < j.len; at += 40) {
    const tip = jetPoint(j, at + 6, 0), l = jetPoint(j, at - 4, -7), r = jetPoint(j, at - 4, 7);
    ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(tip.x, tip.y); ctx.lineTo(r.x, r.y); ctx.stroke();
  }
  ctx.restore();
}

/**
 * A vent's jet, over the night: while it burns (for `ventFlameMs` after a puff), a roaring tongue of fire shooting out of the nozzle down its facing,
 * flickering tongues in three heats that lick out to its tip and widen with it, a hot glow along it, embers thrown off its edges and a heat shimmer
 * at its end. `since` is how long ago it last puffed. At rest only the pilot glows. Reduced motion holds the tongues still and drops the embers.
 */
export function drawVentFlame(ctx: CanvasRenderingContext2D, b: BuildingView, since: number, now: number, pxPerUnit: number, reduced: boolean, dark: number) {
  const lv = levelOf(b), burn = ventFlameMs(lv), dir = dirOfView(b);
  const j = jetOf(b.cx, b.cy, dir, lv);
  const pilot = 0.25 + 0.15 * (reduced ? 0.5 : Math.sin(now / 200 + b.cx));
  if (!(since >= 0 && since < burn)) {
    const tip = jetPoint(j, 4, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = pilot * (0.4 + 0.6 * dark);
    ctx.drawImage(glowSprite(FLAME_DEEP, pxPerUnit), tip.x - 12, tip.y - 12, 24, 24);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    return;
  }
  // Full for most of its burn, then guttering back to the nozzle.
  const k = Math.min(1, (burn - since) / 300) * Math.min(1, (since + 60) / 120);
  const t = reduced ? 0 : now;
  const reach = j.len * (0.55 + 0.45 * k);
  // The glow along the jet.
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i <= 4; i++) {
    const p = jetPoint(j, (reach * i) / 4, 0), r = 30 + (j.w1 + 20) * (i / 4);
    ctx.globalAlpha = 0.32 * k;
    ctx.drawImage(glowSprite(i < 2 ? FLAME : FLAME_DEEP, pxPerUnit), p.x - r, p.y - r, r * 2, r * 2);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  // Tongues: licks of flame shot out along the jet, each its own flicker and length, in three heats, the hottest nearest the line.
  const n = 9 + lv * 3;
  const rnd = seeded(b.cx * 53 + b.cy * 29);
  for (const [col, s] of [[FLAME_DEEP, 1], [FLAME, 0.7], [FLAME_HOT, 0.4]] as const) {
    ctx.fillStyle = col;
    ctx.globalAlpha = k * (col === FLAME_DEEP ? 0.85 : 1);
    for (let i = 0; i < n; i++) {
      const phase = rnd() * 1000, speed = 90 + rnd() * 60;
      const f = reduced ? (i + 0.5) / n : ((t + phase * speed) % (speed * 6)) / (speed * 6);
      const along = f * reach;
      const half = (j.w0 + (j.w1 - j.w0) * (along / j.len)) * s;
      const across = (rnd() - 0.5) * 2 * half * 0.7 + Math.sin(t / 90 + i) * 2;
      const c = jetPoint(j, along, across);
      const size = (9 + 11 * f) * s * (0.7 + 0.3 * Math.sin(t / 60 + i * 1.7));
      // Each tongue is a lick of flame stretched down the jet, wobbling as it goes.
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(Math.atan2(j.uy, j.ux) + Math.sin(t / 80 + i * 2.3) * 0.25);
      ctx.beginPath();
      ctx.moveTo(-size * 0.9, 0);
      ctx.quadraticCurveTo(-size * 0.4, -size * 0.75, size * 0.6, -size * 0.35);
      ctx.quadraticCurveTo(size * 1.9, 0, size * 0.6, size * 0.35);
      ctx.quadraticCurveTo(-size * 0.4, size * 0.75, -size * 0.9, 0);
      ctx.fill();
      ctx.restore();
    }
  }
  // The white-hot core at the nozzle.
  const mouth = jetPoint(j, 6, 0);
  ctx.fillStyle = FLAME_HOT;
  ctx.globalAlpha = k;
  ctx.beginPath();
  ctx.ellipse(mouth.x + j.ux * 8, mouth.y + j.uy * 8, j.ux ? 14 : 6, j.uy ? 14 : 6, 0, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
  if (reduced) return;
  // Embers thrown off the jet's edges, drifting up and fading; a shimmer of heat rings at its tip.
  for (let i = 0; i < 14; i++) {
    const period = 600 + rnd() * 600, f = ((now + rnd() * period) % period) / period;
    const along = (0.2 + 0.8 * rnd()) * reach, side = rnd() < 0.5 ? -1 : 1;
    const p = jetPoint(j, along + f * 20, side * (j.w0 + (j.w1 - j.w0) * (along / j.len) + f * 18));
    ctx.globalAlpha = k * (1 - f);
    ctx.fillStyle = i % 3 ? FLAME : FLAME_HOT;
    ctx.beginPath();
    ctx.arc(p.x, p.y - f * 14, 1.1 + rnd() * 1.1, 0, TAU);
    ctx.fill();
  }
  const end = jetPoint(j, reach, 0);
  ctx.strokeStyle = 'rgba(255, 220, 170, 0.5)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 3; i++) {
    const f = ((now / 500) + i / 3) % 1;
    ctx.globalAlpha = k * 0.5 * (1 - f);
    ctx.beginPath();
    ctx.ellipse(end.x + j.ux * f * 18, end.y + j.uy * f * 18 - f * 8, j.w1 * (0.5 + f * 0.6), j.w1 * (0.25 + f * 0.3), 0, 0, TAU);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/**
 * A decoy beacon: a squat steel box on its pad, a short mast with a loudspeaker horn turned out and a dome lamp on top. A second horn at level 2,
 * a third at level 3. Badly damaged, the mast leans and a horn hangs off.
 */
export function drawDecoy(ctx: CanvasRenderingContext2D, cx: number, cy: number, lv: number, wear: Wear) {
  // The box.
  const bw = 26, bh = 14;
  ctx.fillStyle = '#7a3f2a';
  ctx.fillRect(cx - bw / 2, cy - 2 + bh, bw, 8);
  ctx.fillStyle = '#a8552e';
  ctx.fillRect(cx - bw / 2, cy - 2, bw, bh);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.fillRect(cx - bw / 2, cy - 2, bw, 2);
  // Hazard band and a speaker grille on its front.
  for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? INK : '#e0a43a'; ctx.fillRect(cx - bw / 2 + i * (bw / 6), cy + bh - 2, bw / 6, 3); }
  ctx.fillStyle = INK;
  for (let i = 0; i < 3; i++) ctx.fillRect(cx - 8 + i * 6, cy + 2, 3, 6);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.strokeRect(cx - bw / 2, cy - 2, bw, bh);
  ctx.strokeRect(cx - bw / 2, cy - 2 + bh, bw, 8);
  // The mast, leaning when badly damaged.
  const lean = wear === 2 ? 0.35 : 0;
  const top = { x: cx + Math.sin(lean) * 22, y: cy - 2 - Math.cos(lean) * 22 };
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4.6;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 2);
  ctx.lineTo(top.x, top.y);
  ctx.stroke();
  ctx.strokeStyle = '#8d939c';
  ctx.lineWidth = 2.4;
  ctx.stroke();
  // Horns: flared cones off the mast, one more each level.
  const horns: [number, number][] = [[-1, 0.62], [1, 0.62], [-1, 0.25]].slice(0, lv) as [number, number][];
  for (const [side, at] of horns) {
    const hx = cx + (top.x - cx) * at, hy = cy - 2 + (top.y - cy + 2) * at;
    const drop = wear === 2 && side === 1 ? 6 : 0;
    ctx.fillStyle = '#c9ccd2';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(hx, hy - 2 + drop);
    ctx.lineTo(hx + side * 12, hy - 6 + drop);
    ctx.lineTo(hx + side * 12, hy + 4 + drop);
    ctx.lineTo(hx, hy + 2 + drop);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(hx + side * 12, hy - 1 + drop, 1.6, 5, 0, 0, TAU);
    ctx.fill();
  }
  // The dome lamp's housing; its light is drawn over the night (`drawDecoyLamp`).
  ctx.fillStyle = '#3d4450';
  ctx.fillRect(top.x - 5, top.y - 1, 10, 3);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.strokeRect(top.x - 5, top.y - 1, 10, 3);
  ctx.fillStyle = '#7a1f1a';
  ctx.beginPath();
  ctx.arc(top.x, top.y - 1, 4.6, Math.PI, 0);
  ctx.fill();
  ctx.stroke();
}

/** Where a decoy's lamp sits from its cell centre, as `drawDecoy` puts it. */
const lampOf = (wear: Wear) => ({ x: wear === 2 ? Math.sin(0.35) * 22 : 0, y: -2 - Math.cos(wear === 2 ? 0.35 : 0) * 22 - 2 });
const BEACON = '#ff4a3a';

/**
 * A decoy's light over the night: its dome lamp blinking red, a hot pool round it when lit, and a ripple of sound rings spreading out from its horns
 * every beat, to as far as it draws the horde. Badly damaged, the lamp stutters.
 */
export function drawDecoyLamp(ctx: CanvasRenderingContext2D, b: BuildingView, now: number, pxPerUnit: number, reduced: boolean, dark: number) {
  const { x, y, w } = cellRect(b.cx, b.cy);
  const wear = wearStage(b.hp), at = lampOf(wear), lx = x + w / 2 + at.x, ly = y + w / 2 + at.y;
  const beat = 700, on = (now + b.cx * 37) % beat < beat * 0.45 && !(wear === 2 && (now % 900) < 160);
  if (on) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.45 + 0.35 * dark;
    ctx.drawImage(glowSprite(BEACON, pxPerUnit), lx - 26, ly - 26, 52, 52);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = on ? '#ffd0c8' : '#7a1f1a';
  ctx.beginPath();
  ctx.arc(lx, ly, 3.2, Math.PI, 0);
  ctx.fill();
  if (reduced) return;
  // The call going out: thin rings off the horns, fading as they spread.
  const reach = reachAt(UTILITY.decoy.reach, levelOf(b));
  for (let i = 0; i < 2; i++) {
    const f = (((now + b.cy * 53) / 1600 + i / 2) % 1);
    ctx.globalAlpha = 0.28 * (1 - f) * (0.5 + 0.5 * dark);
    ctx.strokeStyle = BEACON;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(x + w / 2, y + w / 2, 14 + f * Math.min(reach, 90), 0, TAU);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/**
 * The reach a decoy draws the horde from, in build mode: a red dashed ring at its pull radius (`UTILITY.decoy.reach` at its level), its fill and a wave
 * pulsing out to it, so a squad sees which part of the field a beacon would empty. `ghost` draws a beacon about to go up a little brighter.
 */
export function drawDecoyPull(ctx: CanvasRenderingContext2D, cx: number, cy: number, lv: number, now: number, scale: number, reduced: boolean, ghost = false) {
  const r = reachAt(UTILITY.decoy.reach, lv), px = 1 / Math.max(0.2, scale);
  ctx.save();
  ctx.fillStyle = `rgba(255, 74, 58, ${ghost ? 0.08 : 0.05})`;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.fill();
  if (!reduced) {
    const f = (now / 1400) % 1;
    ctx.globalAlpha = 0.5 * (1 - f);
    ctx.strokeStyle = BEACON;
    ctx.lineWidth = 2.4 * px;
    ctx.beginPath();
    ctx.arc(cx, cy, r * f, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.lineWidth = 3.4 * px;
  ctx.strokeStyle = 'rgba(28, 31, 38, 0.3)';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([12 * px, 6 * px]);
  ctx.lineDashOffset = reduced ? 0 : now / 60;
  ctx.lineWidth = 1.8 * px;
  ctx.strokeStyle = `rgba(255, 110, 90, ${ghost ? 0.95 : 0.75})`;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

/**
 * What the horde carries, over the night: a zombie a coil has marked wears a cold blue ring at its feet and a small bolt glyph over its head that
 * flickers; one alight from a vent has tongues of fire licking up its body and a warm glow. Each is a bit on its view (`ZOMBIE_FX`).
 */
export function drawZombieFx(ctx: CanvasRenderingContext2D, zombies: readonly ZombieView[], now: number, pxPerUnit: number, reduced: boolean) {
  for (const z of zombies) {
    const fx = z[5];
    if (!fx) continue;
    const kind = ZOMBIE_KINDS[z[1]]!, r = ZOMBIES[kind].radius, x = z[2], y = z[3];
    if (fx & ZOMBIE_FX.burning) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5;
      ctx.drawImage(glowSprite(FLAME_DEEP, pxPerUnit), x - r * 1.8, y - r * 1.8, r * 3.6, r * 3.6);
      ctx.globalCompositeOperation = 'source-over';
      const t = reduced ? 0 : now;
      for (const [col, s] of [[FLAME_DEEP, 1], [FLAME, 0.65], [FLAME_HOT, 0.35]] as const) {
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.9;
        for (let i = 0; i < 4; i++) {
          const a = i * 1.7 + z[0];
          const bx = x + Math.cos(a) * r * 0.5, by = y + Math.sin(a) * r * 0.4;
          const h = r * (0.9 + 0.4 * Math.sin(t / (60 + i * 17) + z[0] + i)) * s, wd = r * 0.28 * s + 1;
          ctx.beginPath();
          ctx.moveTo(bx - wd, by);
          ctx.quadraticCurveTo(bx - wd * 0.6, by - h * 0.6, bx, by - h);
          ctx.quadraticCurveTo(bx + wd * 0.6, by - h * 0.6, bx + wd, by);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }
    if (fx & ZOMBIE_FX.marked) {
      const flick = reduced ? 1 : 0.7 + 0.3 * Math.sin(now / 55 + z[0]);
      ctx.globalAlpha = 0.85 * flick;
      ctx.strokeStyle = SPARK;
      ctx.lineWidth = 1.8;
      ctx.setLineDash([4, 3]);
      ctx.lineDashOffset = reduced ? 0 : -now / 40;
      ctx.beginPath();
      ctx.ellipse(x, y + r * 0.35, r + 4, (r + 4) * 0.55, 0, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      // The glyph: a small ink-edged bolt over its head.
      const gx = x, gy = y - r - 12;
      ctx.globalAlpha = flick;
      ctx.beginPath();
      ctx.moveTo(gx + 1.5, gy - 7);
      ctx.lineTo(gx - 3.5, gy + 1);
      ctx.lineTo(gx - 0.2, gy + 1);
      ctx.lineTo(gx - 1.5, gy + 7);
      ctx.lineTo(gx + 3.5, gy - 1);
      ctx.lineTo(gx + 0.2, gy - 1);
      ctx.closePath();
      ctx.fillStyle = '#e8f6ff';
      ctx.fill();
      ctx.strokeStyle = '#2a5d9a';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}
