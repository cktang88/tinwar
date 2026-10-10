import { UTILITY, ZOMBIE_KINDS, ZOMBIES } from '../shared/defs.ts';
import { ZOMBIE_FX, type BuildingView, type ZombieView } from '../shared/protocol.ts';
import { cellRect, levelOf, reachAt, turretDef } from '../shared/sim/build.ts';
import { glowSprite } from './coreart.ts';
import { INK, tint } from './palette.ts';
import { LIGHT } from './tilt.ts';
import { seeded, wearStage, type Wear } from './turretart.ts';

/**
 * The two buildables that are neither gun nor wall: the flame vent, a grate in the floor that sets alight what walks over it, and the decoy beacon,
 * a mast with a loudspeaker and a blinking lamp that draws the horde off the walls. Their bodies are drawn with the floor and the buildings, their light
 * (the vent's flame and embers, the beacon's lamp and its pull) over the night's shade. Also the marks the horde carries: a coil's charge, a vent's fire.
 */

const TAU = Math.PI * 2;
const FLAME_HOT = '#fff1b8', FLAME = '#ffb347', FLAME_DEEP = '#ff6a2a', SOOT = '#2a2522';
const SPARK = '#bfe3ff';

/** How long a vent's flame burns on after its last puff, as the sim has it (`TurretDef.burn.patchMs`). */
export const ventFlameMs = (lv: number) => turretDef('vent', lv).burn!.patchMs;

/**
 * A flame vent lying in the floor: a scorched steel plate with a round grate over the burner, a fuel line out to one side and a pilot nub,
 * hazard-striped at its corners. A bigger burner ring at each level; badly damaged, its plate is buckled and black. The gauge's cells show the fuel.
 */
export function drawVent(ctx: CanvasRenderingContext2D, b: BuildingView, now: number) {
  const { x, y, w } = cellRect(b.cx, b.cy);
  const cx = x + w / 2, cy = y + w / 2, lv = levelOf(b), wear = wearStage(b.hp);
  // Soot fanned round it on the floor, deeper the more it has burned.
  ctx.fillStyle = 'rgba(24, 20, 17, 0.32)';
  ctx.beginPath();
  ctx.ellipse(cx, cy, 24, 22, 0, 0, TAU);
  ctx.fill();
  // The plate, a slab sunk into the floor: ink rim, lit top-left edge, shaded bottom-right.
  const p = 19;
  ctx.fillStyle = wear === 2 ? '#3d3a37' : '#5a5f68';
  ctx.beginPath();
  ctx.roundRect(cx - p, cy - p, p * 2, p * 2, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.fillRect(cx - p + 2, cy - p + 1.5, p * 2 - 4, 1.6);
  ctx.fillStyle = 'rgba(10, 12, 16, 0.3)';
  ctx.fillRect(cx - p + 2, cy + p - 3, p * 2 - 4, 1.6);
  // Hazard stripes on two corners.
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(cx - p, cy - p, p * 2, p * 2, 4);
  ctx.clip();
  for (const [sx, sy] of [[-1, -1], [1, 1]] as const) {
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i % 2 ? INK : '#e0a43a';
      ctx.beginPath();
      const o = 4 + i * 4;
      ctx.moveTo(cx + sx * p, cy + sy * (p - o));
      ctx.lineTo(cx + sx * (p - o), cy + sy * p);
      ctx.lineTo(cx + sx * (p - o - 4), cy + sy * p);
      ctx.lineTo(cx + sx * p, cy + sy * (p - o - 4));
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.roundRect(cx - p, cy - p, p * 2, p * 2, 4);
  ctx.stroke();
  // Corner bolts.
  ctx.fillStyle = '#8d939c';
  for (const [bx, by] of [[-1, 1], [1, -1]] as const) { ctx.beginPath(); ctx.arc(cx + bx * (p - 4), cy + by * (p - 4), 1.7, 0, TAU); ctx.fill(); ctx.stroke(); }
  // The burner: a dark round mouth with a grate of bars across it, a brass ring round it, bigger each level.
  const r = 9 + lv * 1.5;
  ctx.fillStyle = '#b79a4a';
  ctx.beginPath();
  ctx.arc(cx, cy, r + 2.4, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = SOOT;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.fill();
  // The burner's throat glows a little even at rest, a pilot flame below the grate.
  const breathe = 0.5 + 0.5 * Math.sin(now / 300 + b.cx);
  ctx.fillStyle = tint(FLAME_DEEP, -0.35);
  ctx.globalAlpha = 0.4 + 0.25 * breathe;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.55, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#6d727b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = -2; i <= 2; i++) {
    const off = (i * r) / 2.6, half = Math.sqrt(Math.max(0, r * r - off * off));
    ctx.moveTo(cx + off, cy - half);
    ctx.lineTo(cx + off, cy + half);
  }
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 2.4, 0, TAU);
  ctx.stroke();
  // The fuel line out to the right, with its valve wheel.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4.4;
  ctx.beginPath();
  ctx.moveTo(cx + r + 2, cy + 4);
  ctx.lineTo(cx + p - 2, cy + 4);
  ctx.stroke();
  ctx.strokeStyle = '#a8552e';
  ctx.lineWidth = 2.4;
  ctx.stroke();
  ctx.fillStyle = '#d0573a';
  ctx.beginPath();
  ctx.arc(cx + p - 6, cy + 4, 2.6, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  if (wear === 2) {
    const rnd = seeded(b.cx * 31 + b.cy);
    ctx.fillStyle = 'rgba(18, 15, 13, 0.55)';
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(cx + (rnd() - 0.5) * 30, cy + (rnd() - 0.5) * 30, 3 + rnd() * 3, 0, TAU); ctx.fill(); }
  }
  // The fuel gauge along the bottom edge: five cells, orange while there is fuel, red when dry.
  const ammo = 'ammo' in b ? b.ammo : 10, cells = 5, lit = ammo === 0 ? 0 : Math.max(1, Math.ceil((ammo / 10) * cells));
  for (let i = 0; i < cells; i++) {
    ctx.fillStyle = i < lit ? FLAME : ammo === 0 && Math.floor(now / 250) % 2 === 0 ? '#e5484d' : '#2a2e36';
    ctx.fillRect(cx - 12 + i * 4.8 + 0.5, cy + p - 6.5, 3.8, 3);
  }
}

/**
 * A vent's flame, over the night: while it burns (for `ventFlameMs` after a puff), a roaring column of tongues licking up out of the grate and
 * a hot pool on the floor; embers riding up off it and fading. `since` is how long ago it last puffed. Reduced motion holds the tongues still.
 */
export function drawVentFlame(ctx: CanvasRenderingContext2D, b: BuildingView, since: number, now: number, pxPerUnit: number, reduced: boolean, dark: number) {
  const lv = levelOf(b), burn = ventFlameMs(lv);
  const { x, y, w } = cellRect(b.cx, b.cy);
  const cx = x + w / 2, cy = y + w / 2;
  const pilot = 0.25 + 0.15 * (reduced ? 0.5 : Math.sin(now / 200 + b.cx));
  if (!(since >= 0 && since < burn)) {
    // At rest, only the pilot's glow under the grate.
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = pilot * (0.4 + 0.6 * dark);
    ctx.drawImage(glowSprite(FLAME_DEEP, pxPerUnit), cx - 14, cy - 14, 28, 28);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    return;
  }
  // Full for most of its burn, then guttering out.
  const k = Math.min(1, (burn - since) / 300) * Math.min(1, (since + 60) / 120);
  const reach = turretDef('vent', lv).range + 16;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.65 * k;
  ctx.drawImage(glowSprite(FLAME_DEEP, pxPerUnit), cx - reach * 2.2, cy - reach * 2.2, reach * 4.4, reach * 4.4);
  ctx.globalAlpha = 0.5 * k;
  ctx.drawImage(glowSprite(FLAME, pxPerUnit), cx - reach, cy - reach, reach * 2, reach * 2);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  // Tongues: chunky teardrops leaning up and away from the light, each its own flicker, in three heats.
  const t = reduced ? 0 : now;
  const n = 7 + lv * 2;
  for (const [col, s, lift] of [[FLAME_DEEP, 1, 1], [FLAME, 0.72, 0.85], [FLAME_HOT, 0.42, 0.7]] as const) {
    ctx.fillStyle = col;
    ctx.globalAlpha = k * (col === FLAME_DEEP ? 0.9 : 1);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + (b.cx * 1.7) % TAU;
      const flick = 0.65 + 0.35 * Math.sin(t / (70 + (i % 4) * 23) + i * 2.1);
      const bx = cx + Math.cos(a) * reach * 0.45 * s, by = cy + Math.sin(a) * reach * 0.35 * s;
      const h = (16 + lv * 4) * s * flick * lift, wd = 5.5 * s + 1;
      ctx.beginPath();
      ctx.moveTo(bx - wd, by);
      ctx.quadraticCurveTo(bx - wd * 0.8, by - h * 0.6, bx - LIGHT.x * 3, by - h);
      ctx.quadraticCurveTo(bx + wd * 0.8, by - h * 0.6, bx + wd, by);
      ctx.arc(bx, by, wd, 0, Math.PI);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  if (reduced) return;
  // Embers: specks riding up off the flame on its heat, drifting and fading, each on its own loop.
  const rnd = seeded(b.cx * 97 + b.cy * 13);
  for (let i = 0; i < 10; i++) {
    const period = 700 + rnd() * 600, ph = rnd() * period, f = ((now + ph) % period) / period;
    const ex = cx + (rnd() - 0.5) * reach + Math.sin(now / 260 + i) * 4, ey = cy - f * (40 + rnd() * 30);
    ctx.globalAlpha = k * (1 - f);
    ctx.fillStyle = i % 3 ? FLAME : FLAME_HOT;
    ctx.beginPath();
    ctx.arc(ex, ey, 1.1 + rnd() * 0.9, 0, TAU);
    ctx.fill();
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
