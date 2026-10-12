import type { MapDef } from '../../shared/maps.ts';
import { setLight } from '../lighting.ts';
import { registerTheme, type ThemeView } from './registry.ts';
import { FLOODS, paintOutpostFloor } from './outpostfloor.ts';
import { OUTPOST_WALLS } from './outpostwalls.ts';
import { C, MID, PLACE, TAU, TOWERS } from './outpostkit.ts';

/**
 * Outpost, Firebase Bastion: a forward operating base holding out against the horde at night. Registers the theme: the floor in
 * outpostfloor.ts, the walls in outpostwalls.ts, the shared palette and places in outpostkit.ts. Here, per frame and cheap: the
 * watchtowers' searchlights sweeping the dark outside the wire, the sodium floodlights on their poles round the parade ground and
 * at the gates, the radio mast's red beacon, the helipad's edge lights, the med tent's lamp, and the fires still burning in the
 * burn pit and the wrecks. Its crows, tumbleweed, paper and rats stay in ambientmaps.ts.
 */
const calm = (() => { try { return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } })();
const clock = (now: number) => (calm ? 4000 : now);
const inView = (v: ThemeView, x: number, y: number, r: number) => x + r >= v.x0 && x - r <= v.x1 && y + r >= v.y0 && y - r <= v.y1;

/** Fires still burning: the burn pit, the helicopter, a convoy truck. */
const FIRES = [{ x: PLACE.pit.x, y: PLACE.pit.y, r: 1 }, { x: 420, y: 1350, r: 0.7 }, { x: 2650, y: 1120, r: 0.6 }] as const;

function outpostUnder(ctx: CanvasRenderingContext2D, now: number, view: ThemeView, _map: MapDef) {
  const t = clock(now);
  // the towers' searchlights: each sweeps the quarter of dark it looks out over
  TOWERS.forEach((p, i) => {
    if (!inView(view, p.x, p.y, 1300)) return;
    const out = Math.atan2(p.y - MID, p.x - MID);
    const sweep = out + Math.sin(t / 2600 + i * 1.7) * 0.75;
    setLight(`op:search:${i}`, { x: p.x, y: p.y, radius: 1000, color: '#f4f0dc', intensity: 1.05, cone: { angle: sweep, half: 0.13 }, beam: 0.9, size: 8, inside: 60, shadows: false });
    setLight(`op:tower:${i}`, { x: p.x, y: p.y, radius: 200, color: C.lamp, intensity: 0.5, size: 10, inside: 60, shadows: false });
  });
  // sodium floodlights on their poles, a little flicker on the one at the south gate
  FLOODS.forEach((p, i) => {
    if (!inView(view, p.x, p.y, 480)) return;
    const flick = i === 6 && !calm ? (Math.sin(t / 70) > 0.6 && Math.sin(t / 900) > 0.3 ? 0.25 : 1) : 1;
    setLight(`op:flood:${i}`, { x: p.x, y: p.y, radius: 430, color: C.sodium, intensity: 0.62 * flick, size: 14, inside: 14 });
  });
  // the med tent's lamp, the comms shack's screens
  if (inView(view, PLACE.med.x, PLACE.med.y, 260)) setLight('op:med', { x: PLACE.med.x - 100, y: PLACE.med.y + 10, radius: 220, color: '#e6f2ff', intensity: 0.45, size: 18, shadows: false });
  if (inView(view, PLACE.comms.x, PLACE.comms.y, 240)) setLight('op:comms', { x: PLACE.comms.x - 20, y: PLACE.comms.y + 80, radius: 170, color: '#9ff0c0', intensity: 0.35, size: 14, shadows: false });
  // fires: a light that breathes, and embers drawn over the floor
  FIRES.forEach((f, i) => {
    if (!inView(view, f.x, f.y, 300)) return;
    const k = calm ? 1 : 0.85 + 0.15 * Math.sin(t / 110 + i * 2) * Math.sin(t / 270 + i);
    setLight(`op:fire:${i}`, { x: f.x, y: f.y, radius: 260 * f.r + 60, color: '#ff9a48', intensity: 0.7 * k, flicker: calm ? 0 : 0.2, size: 20, shadows: false });
    for (let e = 0; e < 7; e++) {
      const ph = ((t / 1400 + e / 7 + i * 0.3) % 1);
      const ex = f.x + Math.sin(e * 2.3 + t / 900) * 22 * f.r + ph * 14, ey = f.y - ph * 46 * f.r;
      ctx.fillStyle = `rgba(255, ${150 + e * 12}, 60, ${0.85 * (1 - ph)})`;
      ctx.fillRect(ex, ey, 2.4, 2.4);
    }
    ctx.fillStyle = `rgba(255, 140, 50, ${0.22 * k})`; ctx.beginPath(); ctx.ellipse(f.x, f.y, 26 * f.r + 8, 16 * f.r + 6, 0, 0, TAU); ctx.fill();
  });
  // the helipad's edge lights, chasing round
  const hp = PLACE.helipad;
  if (inView(view, hp.x, hp.y, hp.r + 40)) {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU, on = calm || Math.floor(t / 140) % 12 === i;
      ctx.fillStyle = on ? '#9fe0ff' : 'rgba(110, 160, 190, 0.55)';
      ctx.beginPath(); ctx.arc(hp.x + Math.cos(a) * (hp.r + 2), hp.y + Math.sin(a) * (hp.r + 2), on ? 3.6 : 2.4, 0, TAU); ctx.fill();
    }
  }
}

function outpostOver(ctx: CanvasRenderingContext2D, now: number, view: ThemeView, _map: MapDef) {
  const t = clock(now);
  // the radio mast stands over everything: its lattice up to the beacon, which blinks red
  const m = PLACE.mast;
  if (inView(view, m.x, m.y - 80, 140)) {
    const top = { x: m.x + 6, y: m.y - 120 };
    ctx.strokeStyle = 'rgba(160, 166, 172, 0.9)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(m.x - 8, m.y); ctx.lineTo(top.x, top.y); ctx.moveTo(m.x + 8, m.y); ctx.lineTo(top.x, top.y); ctx.stroke();
    ctx.lineWidth = 1; ctx.beginPath();
    for (let k = 1; k < 8; k++) { const f = k / 8, y = m.y + (top.y - m.y) * f, half = 8 * (1 - f); ctx.moveTo(m.x - half + 6 * f, y); ctx.lineTo(m.x + half + 6 * f, y - 10); }
    ctx.stroke();
    const on = calm || Math.floor(t / 700) % 2 === 0;
    ctx.fillStyle = on ? C.alarm : '#5a1a16'; ctx.beginPath(); ctx.arc(top.x, top.y, 4, 0, TAU); ctx.fill();
    if (on) setLight('op:mast', { x: top.x, y: top.y + 60, radius: 160, color: C.alarm, intensity: 0.5, size: 6, shadows: false });
  }
  // the windsock by the helipad, lifting and falling with the gusts
  const hp = PLACE.helipad, sx = hp.x + hp.r + 50, sy = hp.y - hp.r + 10;
  if (inView(view, sx, sy, 80)) {
    const lift = calm ? 0.3 : 0.3 + 0.25 * Math.sin(t / 1300) + 0.1 * Math.sin(t / 310);
    ctx.strokeStyle = C.steelLo; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy - 40); ctx.stroke();
    ctx.save(); ctx.translate(sx, sy - 40); ctx.rotate(0.5 - lift);
    for (let k = 0; k < 4; k++) { ctx.fillStyle = k % 2 ? '#e8e2cc' : '#d9682a'; ctx.beginPath(); ctx.moveTo(k * 8, -5 + k); ctx.lineTo(k * 8 + 8, -4 + k); ctx.lineTo(k * 8 + 8, 4 - k); ctx.lineTo(k * 8, 5 - k); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
}

registerTheme('outpost', { floor: paintOutpostFloor, walls: OUTPOST_WALLS, under: outpostUnder, over: outpostOver, dusk: 0.22 });
