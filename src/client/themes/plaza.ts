import type { MapDef } from '../../shared/maps.ts';
import { CRANE, CROSSINGS, FOUNTAIN, PLACES, TABLES } from '../../shared/maps/plazageo.ts';
import { setLight } from '../lighting.ts';
import { paintPlazaFloor } from './plazafloor.ts';
import { C, INK, SIZE, TAU, clock, hash, hexA, inView, mix, mixHex, reduced, turn } from './plazakit.ts';
import { drawPlazaPoly, drawPlazaRoof } from './plazapolys.ts';
import { registerTheme, type ThemeView } from './registry.ts';

/**
 * Plaza: a downtown block at the blue hour. This file registers the theme and is its living part: the fountain's jets and the splash
 * pad round zone B, shop windows and neon signs, the traffic lights at each crossing, the tower crane's jib turning over the site,
 * string lights over the food trucks, the metro's blue glow. Everything is slow (the quickest is a crane beacon at under 1 Hz) and
 * holds still under `prefers-reduced-motion`. The floor is plazafloor.ts (and plazastories.ts), every polygon and roof plazapolys.ts.
 */
type G = CanvasRenderingContext2D;
type Src = { key: string; x: number; y: number; radius: number; color: string; intensity: number; flicker?: number; size?: number; shadows?: boolean };

const sourceCache = new Map<string, Src[]>();
function sources(map: MapDef): Src[] {
  let list = sourceCache.get(map.name);
  if (list) return list;
  list = [];
  const add = (key: string, x: number, y: number, radius: number, color: string, intensity: number, o: Partial<Src> = {}) => list!.push({ key, x, y, radius, color, intensity, size: 20, ...o });
  // every shop and hall lit from inside, each in its own colour of light; its sign in its neon
  for (const p of PLACES) {
    for (const twin of [false, true]) {
      const cx = p.x + p.w / 2, cy = p.y + p.h / 2, c = twin ? turn({ x: cx, y: cy }) : { x: cx, y: cy };
      const accent = twin ? p.twinAccent : p.accent;
      if (p.roofed) add(`pz:in:${p.id}${twin ? '~' : ''}`, c.x, c.y, Math.min(520, Math.max(p.w, p.h) * 0.65), mixHex(accent, 255, 0.6), 0.5, { shadows: false });
      if (p.sign) { const s = twin ? turn(p.sign) : p.sign; add(`pz:sign:${p.id}${twin ? '~' : ''}`, s.x, s.y, 200, accent, 0.55, { flicker: 0.04, size: 12, shadows: false }); }
    }
  }
  add('pz:fountain', FOUNTAIN.x, FOUNTAIN.y, 520, '#7fe0ff', 0.6, { size: 60, shadows: false });
  for (const twin of [false, true]) {
    const k = twin ? '~' : '';
    const P = (x: number, y: number) => (twin ? turn({ x, y }) : { x, y });
    const m = P(2075, 1550); add(`pz:metro${k}`, m.x, m.y, 340, '#5ab0ff', 0.6, { size: 30 });
    const f = P(1700, 350); add(`pz:flood${k}`, f.x, f.y, 520, '#f4f0e0', 0.55, { size: 30 });
    for (const [x, y] of [[300, 300], [800, 300], [300, 800], [800, 800]] as const) { const q = P(x, y); add(`pz:garage${x}${y}${k}`, q.x, q.y, 280, '#d8ecff', 0.4, { flicker: 0.05 }); }
    const t = P(2600, 4200); add(`pz:trucks${k}`, t.x, t.y, 460, '#ffcf7a', 0.55, { flicker: 0.12, size: 40 });
    const st = P(2450, 3000); add(`pz:statue${k}`, st.x, st.y, 240, '#ffe0b0', 0.45, { size: 16 });
    const bus = P(760, 2950); add(`pz:bus${k}`, bus.x, bus.y, 300, '#e8f4ff', 0.4, { size: 30 });
  }
  for (const p of map.props) if (p.kind === 'lamp') add(`pz:lamp${p.x},${p.y}`, p.x, p.y, 380, '#ffc878', 0.65, { size: 14, flicker: 0.03, shadows: true });
  sourceCache.set(map.name, list);
  return list;
}

/** Traffic signals: one head on each side of every crossing, cycling green, amber, red over twenty seconds, the twin half out of phase. */
const SIGNALS = CROSSINGS.flatMap(([x, y, w, h], i) => {
  const horiz = w < h; // a crossing over a horizontal road is taller than wide
  const heads = horiz ? [{ x: x - 16, y: y - 26 }, { x: x + w + 16, y: y + h + 26 }] : [{ x: x - 26, y: y - 16 }, { x: x + w + 26, y: y + h + 16 }];
  return [...heads.map((p) => ({ ...p, phase: i * 0.37 })), ...heads.map((p) => ({ ...turn(p), phase: i * 0.37 + 0.5 }))];
});

function signal(g: G, x: number, y: number, t: number, phase: number) {
  const u = reduced ? 0.2 : ((t / 20000 + phase) % 1 + 1) % 1;
  const lit = u < 0.45 ? 2 : u < 0.55 ? 1 : 0;
  g.fillStyle = 'rgba(14,16,22,0.3)'; g.fillRect(x - 6, y - 12, 18, 34);
  g.fillStyle = '#1e2026'; g.fillRect(x - 9, y - 16, 18, 36); g.strokeStyle = INK; g.lineWidth = 1.6; g.strokeRect(x - 9, y - 16, 18, 36);
  ['#ff4a3a', '#ffb000', '#3aff8a'].forEach((col, k) => {
    g.fillStyle = k === lit ? col : mix(col, 0, 0.75); g.beginPath(); g.arc(x, y - 9 + k * 11, 4, 0, TAU); g.fill();
    if (k === lit) { g.fillStyle = hexA(col, 0.25); g.beginPath(); g.arc(x, y - 9 + k * 11, 10, 0, TAU); g.fill(); }
  });
}

function fountain(g: G, t: number) {
  const cx = FOUNTAIN.x, cy = FOUNTAIN.y;
  // the ring basin's jets arc inwards over the water; the splash pad's nozzles pulse in a slow wave
  g.save();
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * TAU, gapAngle = ((a + Math.PI / 4) % (Math.PI / 2)) - Math.PI / 4;
    if (Math.abs(gapAngle) < FOUNTAIN.gap + 0.06) continue;
    const r0 = 300, ph = reduced ? 0.5 : ((t * 0.0009 + k * 0.13) % 1);
    const x0 = cx + Math.cos(a) * r0, y0 = cy + Math.sin(a) * r0, x1 = cx + Math.cos(a) * 262, y1 = cy + Math.sin(a) * 262;
    g.strokeStyle = 'rgba(220, 245, 255, 0.55)'; g.lineWidth = 3; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 - 34, x1, y1); g.stroke();
    g.fillStyle = 'rgba(240, 252, 255, 0.8)';
    const qx = x0 + (x1 - x0) * ph, qy = y0 + (y1 - y0) * ph - Math.sin(ph * Math.PI) * 17;
    g.beginPath(); g.arc(qx, qy, 2.4, 0, TAU); g.fill();
    g.strokeStyle = `rgba(230, 250, 255, ${(0.4 * (1 - ph)).toFixed(3)})`; g.lineWidth = 1.4; g.beginPath(); g.arc(x1, y1, 3 + ph * 10, 0, TAU); g.stroke();
  }
  for (const [rad, n] of [[120, 8], [200, 12]] as const) for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU + rad, x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
    const wave = reduced ? 0.6 : 0.5 + 0.5 * Math.sin(t * 0.0015 - rad * 0.03 + k * 0.5);
    if (wave < 0.35) continue;
    const hgt = 6 + wave * 22;
    g.fillStyle = `rgba(200, 240, 255, ${(0.25 + 0.3 * wave).toFixed(3)})`; g.beginPath(); g.ellipse(x, y - hgt / 2, 4, hgt / 2, 0, 0, TAU); g.fill();
    g.strokeStyle = `rgba(220, 248, 255, ${(0.35 * wave).toFixed(3)})`; g.lineWidth = 1.4; g.beginPath(); g.arc(x, y, 6 + wave * 6, 0, TAU); g.stroke();
  }
  g.restore();
}

/** The crane's jib: west of the map turns one way, its twin the other, a full turn every two minutes; the load sways under the trolley. */
function craneAngle(t: number, twin: boolean) { return (twin ? Math.PI : 0) + (reduced ? 0.6 : (twin ? -1 : 1) * t * 0.000052); }
function jib(g: G, x: number, y: number, a: number, t: number, shadow: boolean) {
  const L = 980, back = 260, w = 18;
  g.save(); g.translate(x, y); g.rotate(a);
  if (shadow) {
    g.fillStyle = 'rgba(10, 12, 18, 0.18)'; g.fillRect(-back, -w / 2 + 40, L + back, w);
    g.restore(); return;
  }
  // counter-jib with its concrete weights, the jib's lattice, the cab, trolley and hook
  g.fillStyle = C.yellowLo; g.fillRect(-back, -w / 2 - 4, back, w + 8);
  for (let k = 0; k < 3; k++) { g.fillStyle = '#8a8a84'; g.fillRect(-back + 10 + k * 28, -w / 2 - 10, 24, w + 20); g.strokeStyle = INK; g.lineWidth = 1.6; g.strokeRect(-back + 10 + k * 28, -w / 2 - 10, 24, w + 20); }
  g.fillStyle = C.yellow; g.fillRect(0, -w / 2, L, w);
  g.strokeStyle = C.yellowLo; g.lineWidth = 2.4; g.beginPath(); for (let s = 0; s < L; s += 30) { g.moveTo(s, -w / 2); g.lineTo(s + 15, w / 2); g.lineTo(s + 30, -w / 2); } g.stroke();
  g.strokeStyle = INK; g.lineWidth = 2; g.strokeRect(-back, -w / 2 - 4, back + L, w + 8);
  g.fillStyle = '#e8e4dc'; g.fillRect(-18, -24, 36, 22); g.strokeRect(-18, -24, 36, 22); g.fillStyle = '#5a8ab0'; g.fillRect(-14, -20, 28, 8);
  const tx = 300 + (reduced ? 200 : (Math.sin(t * 0.00011) * 0.5 + 0.5) * 560);
  g.fillStyle = '#3a404a'; g.fillRect(tx - 12, -w / 2 - 3, 24, w + 6);
  const sway = reduced ? 0 : Math.sin(t * 0.0011) * 8;
  g.strokeStyle = INK; g.lineWidth = 1.4; g.beginPath(); g.moveTo(tx, 0); g.lineTo(tx + sway, 34); g.stroke();
  g.fillStyle = '#b08350'; g.fillRect(tx + sway - 20, 34, 40, 26); g.strokeRect(tx + sway - 20, 34, 40, 26);
  for (let k = 0; k < 3; k++) { g.fillStyle = '#a9a9a2'; g.fillRect(tx + sway - 17 + k * 12, 37, 10, 20); }
  g.restore();
  // the beacon on the jib's tip, blinking under once a second
  const on = reduced || Math.floor(t / 1300) % 2 === 0;
  const tip = { x: x + Math.cos(a) * L, y: y + Math.sin(a) * L };
  g.fillStyle = on ? '#ff3b30' : '#5a1a16'; g.beginPath(); g.arc(tip.x, tip.y, 5, 0, TAU); g.fill();
  if (on) { g.fillStyle = 'rgba(255, 60, 40, 0.25)'; g.beginPath(); g.arc(tip.x, tip.y, 16, 0, TAU); g.fill(); }
}

/** String lights strung between the food trucks: bulbs breathing a little, in warm colours. */
function stringLights(g: G, x0: number, y0: number, x1: number, y1: number, t: number, seed: number) {
  g.strokeStyle = 'rgba(20, 20, 24, 0.7)'; g.lineWidth = 1.4;
  const sag = 40;
  g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + sag, x1, y1); g.stroke();
  for (let k = 1; k < 14; k++) {
    const u = k / 14, x = (1 - u) * (1 - u) * x0 + 2 * u * (1 - u) * (x0 + x1) / 2 + u * u * x1, y = (1 - u) * (1 - u) * y0 + 2 * u * (1 - u) * ((y0 + y1) / 2 + sag) + u * u * y1;
    const col = ['#ffd27a', '#ff8a5a', '#fff0c0', '#ff6aa0'][(k + seed) % 4]!;
    const b = reduced ? 1 : 0.75 + 0.25 * Math.sin(t * 0.002 + k * 1.7 + seed);
    g.fillStyle = hexA(col, 0.22 * b); g.beginPath(); g.arc(x, y, 9, 0, TAU); g.fill();
    g.fillStyle = col; g.beginPath(); g.arc(x, y, 3, 0, TAU); g.fill();
  }
}

function plazaUnder(g: G, now: number, view: ThemeView, map: MapDef) {
  const t = clock(now);
  for (const s of sources(map)) {
    if (!inView(view, s.x, s.y, s.radius + 120)) continue;
    setLight(s.key, { x: s.x, y: s.y, radius: s.radius, color: s.color, intensity: s.intensity, ...(s.flicker !== undefined && !reduced && { flicker: s.flicker }), ...(s.size !== undefined && { size: s.size }), shadows: s.shadows ?? false });
  }
  for (const twin of [false, true]) {
    const c = twin ? turn(CRANE) : CRANE;
    const a = craneAngle(t, twin);
    if (inView(view, c.x, c.y, 1300)) jib(g, c.x, c.y, a, t, true);
    const tip = { x: c.x + Math.cos(a) * 980, y: c.y + Math.sin(a) * 980 };
    if (inView(view, tip.x, tip.y, 300) && (reduced || Math.floor(t / 1300) % 2 === 0)) setLight(`pz:crane${twin ? '~' : ''}`, { x: tip.x, y: tip.y, radius: 160, color: '#ff3b30', intensity: 0.5, size: 8, shadows: false });
  }
  if (inView(view, FOUNTAIN.x, FOUNTAIN.y, 380)) fountain(g, t);
  for (const s of SIGNALS) if (inView(view, s.x, s.y, 40)) signal(g, s.x, s.y, t, s.phase);
  // a wisp of steam off each food truck's roof vent, and off the cafe's coffee machine through the open door
  for (const [x, y] of [[2420, 3950], [2700, 4480]] as const) for (const p of [{ x, y }, turn({ x, y })]) {
    if (!inView(view, p.x, p.y, 120)) continue;
    for (let k = 0; k < 3; k++) {
      const u = reduced ? 0.4 : ((t * 0.0005 + k / 3) % 1);
      g.fillStyle = `rgba(240, 240, 240, ${(0.22 * (1 - u)).toFixed(3)})`;
      g.beginPath(); g.arc(p.x + Math.sin(u * 6 + k) * 8, p.y - 20 - u * 60, 8 + u * 14, 0, TAU); g.fill();
    }
  }
  void TABLES;
}

/* ------------------------------------------------------------------ signs, hung over everything */

const signSprites = new Map<string, HTMLCanvasElement>();
function signSprite(text: string, accent: string): HTMLCanvasElement {
  const key = `${text}|${accent}`;
  let c = signSprites.get(key);
  if (c) return c;
  const size = 20, padX = 16, h = size + 14;
  c = document.createElement('canvas');
  const g = c.getContext('2d')!;
  const font = `800 ${size}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  g.font = font; (g as unknown as { letterSpacing: string }).letterSpacing = '3px';
  const w = Math.ceil(g.measureText(text).width) + padX * 2;
  c.width = w + 12; c.height = h + 12;
  g.font = font; (g as unknown as { letterSpacing: string }).letterSpacing = '3px';
  g.fillStyle = 'rgba(14, 16, 22, 0.35)'; g.fillRect(9, 9, w, h);
  g.fillStyle = '#1c1f28'; g.fillRect(4, 4, w, h);
  g.strokeStyle = accent; g.lineWidth = 2.5; g.strokeRect(8, 8, w - 8, h - 8);
  g.strokeStyle = INK; g.lineWidth = 2; g.strokeRect(4, 4, w, h);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = accent; g.shadowBlur = 10; g.fillStyle = mix(accent, 255, 0.55); g.fillText(text, 4 + w / 2, 4 + h / 2 + 1);
  g.shadowBlur = 0;
  signSprites.set(key, c);
  return c;
}

/** The metro totem: a blue pole with the white M, glowing faintly, at the stairwell's corner. */
function totem(g: G, x: number, y: number, t: number) {
  g.fillStyle = 'rgba(14,16,22,0.3)'; g.beginPath(); g.ellipse(x + 8, y + 10, 16, 8, 0, 0, TAU); g.fill();
  g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 46); g.stroke();
  g.strokeStyle = '#8a929e'; g.lineWidth = 4; g.stroke();
  const glow = reduced ? 1 : 0.85 + 0.15 * Math.sin(t * 0.0017);
  g.fillStyle = `rgba(90, 170, 255, ${(0.3 * glow).toFixed(3)})`; g.beginPath(); g.arc(x, y - 62, 30, 0, TAU); g.fill();
  g.fillStyle = '#2f6ab8'; g.beginPath(); g.arc(x, y - 62, 19, 0, TAU); g.fill(); g.strokeStyle = INK; g.lineWidth = 2; g.stroke();
  g.fillStyle = '#ffffff'; g.font = '800 24px "Barlow Condensed", "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('M', x, y - 61);
}

function plazaOver(g: G, now: number, view: ThemeView) {
  const t = clock(now);
  for (const twin of [false, true]) {
    const c = twin ? turn(CRANE) : CRANE;
    if (inView(view, c.x, c.y, 1300)) jib(g, c.x, c.y - 40, craneAngle(t, twin), t, false);
  }
  for (const p of PLACES) {
    if (!p.sign) continue;
    for (const twin of [false, true]) {
      const s = twin ? turn(p.sign) : p.sign;
      if (!inView(view, s.x, s.y, 200)) continue;
      const img = signSprite(twin ? p.twinName : p.name, twin ? p.twinAccent : p.accent);
      const vertical = p.id === 'office';
      g.save(); g.translate(s.x, s.y); if (vertical) g.rotate(twin ? Math.PI / 2 : -Math.PI / 2);
      g.drawImage(img, -img.width / 2, -img.height / 2); g.restore();
    }
  }
  for (const p of [{ x: 2215, y: 1440 }, turn({ x: 2215, y: 1440 })]) if (inView(view, p.x, p.y, 90)) totem(g, p.x, p.y, t);
  // string lights over the food-truck lot
  for (const twin of [false, true]) {
    const P = (x: number, y: number) => (twin ? turn({ x, y }) : { x, y });
    const a = P(2250, 3820), b = P(2950, 3900), c2 = P(2300, 4380), d = P(2950, 4300);
    if (inView(view, (a.x + d.x) / 2, (a.y + d.y) / 2, 600)) { stringLights(g, a.x, a.y, b.x, b.y, t, twin ? 1 : 0); stringLights(g, c2.x, c2.y, d.x, d.y, t, twin ? 3 : 2); }
  }
  void hash; void SIZE;
}

registerTheme('plaza', {
  floor: paintPlazaFloor,
  under: plazaUnder,
  over: plazaOver,
  drawPoly: drawPlazaPoly,
  roof: drawPlazaRoof,
  dusk: 0.3,
});
