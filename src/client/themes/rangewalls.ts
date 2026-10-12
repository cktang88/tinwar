import type { Solid, SolidKind } from '../tilt.ts';
import { C, FONT, TAU, ammoCan, box, casing, disc, hash, hazard, text } from './rangekit.ts';

/**
 * The shooting range's rect walls, each painted whole into its sprite: the blockwork back wall, sandbag dividers and nests, the
 * blast wall by the explosives pit, wooden shooting benches with their rests, the ammo table, the range control tower, the ammo
 * hut, the shoot-house's plywood walls and the earth backstop berm. Every solid shows its top (its collision rect) and a front face
 * hanging below its south edge, as tilt.ts draws the rest.
 */
type G = CanvasRenderingContext2D;

const FACE = { rgwall: 18, rgbags: 13, rgblast: 16, rgbench: 10, rgtable: 10, rgtower: 22, rghut: 16, rgply: 16, rgberm: 20 } as const;

/** The front face below the south edge: a fill, a darker foot and an ink frame. */
function front(g: G, s: Solid, fh: number, fill: string, low: string) {
  g.fillStyle = fill; g.fillRect(s.x, s.y + s.h, s.w, fh);
  g.fillStyle = low; g.fillRect(s.x, s.y + s.h + fh * 0.6, s.w, fh * 0.4);
  g.fillStyle = 'rgba(255, 248, 228, 0.14)'; g.fillRect(s.x, s.y + s.h, s.w, 2);
  g.strokeStyle = C.ink; g.lineWidth = 2; g.strokeRect(s.x, s.y + s.h, s.w, fh);
}
/** Light along the north and west edges of the top, shade along the south and east. */
function cel(g: G, s: Solid, e = 3) {
  g.fillStyle = 'rgba(255, 250, 235, 0.16)'; g.fillRect(s.x, s.y, s.w, e); g.fillRect(s.x, s.y, e, s.h);
  g.fillStyle = 'rgba(20, 16, 10, 0.2)'; g.fillRect(s.x, s.y + s.h - e, s.w, e); g.fillRect(s.x + s.w - e, s.y, e, s.h);
}
const outline = (g: G, s: Solid, lw = 2) => { g.strokeStyle = C.ink; g.lineWidth = lw; g.strokeRect(s.x, s.y, s.w, s.h); };
const clip = (g: G, x: number, y: number, w: number, h: number, paint: () => void) => { g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); paint(); g.restore(); };

/** Cinder blockwork with a coping along the top, a painted range number and a few weather streaks. */
function rgwall(g: G, s: Solid) {
  const fh = FACE.rgwall, seed = Math.round(s.x * 3 + s.y * 7);
  front(g, s, fh, C.blockFront, '#57534b');
  clip(g, s.x, s.y + s.h, s.w, fh, () => { g.strokeStyle = 'rgba(30, 28, 24, 0.4)'; g.lineWidth = 1; for (let x = s.x + 12; x < s.x + s.w; x += 24) { g.beginPath(); g.moveTo(x, s.y + s.h); g.lineTo(x, s.y + s.h + fh); g.stroke(); } });
  g.fillStyle = C.block; g.fillRect(s.x, s.y, s.w, s.h);
  clip(g, s.x, s.y, s.w, s.h, () => {
    const vert = s.h > s.w, len = vert ? s.h : s.w;
    g.strokeStyle = 'rgba(50, 46, 40, 0.45)'; g.lineWidth = 1.4;
    for (let k = 0; k < len; k += 40) {
      g.beginPath();
      if (vert) { g.moveTo(s.x, s.y + k); g.lineTo(s.x + s.w, s.y + k); } else { g.moveTo(s.x + k, s.y); g.lineTo(s.x + k, s.y + s.h); }
      g.stroke();
    }
    g.fillStyle = C.blockHi;
    if (vert) g.fillRect(s.x + s.w / 2 - 1, s.y, 2, s.h); else g.fillRect(s.x, s.y + s.h / 2 - 1, s.w, 2);
    for (let i = 0; i < len / 60; i++) {
      const t = hash(seed, i) * len, w = 6 + hash(seed, i, 2) * 14;
      g.fillStyle = `rgba(60, 54, 44, ${0.12 + hash(seed, i, 3) * 0.14})`;
      if (vert) g.fillRect(s.x + 3, s.y + t, s.w - 6, w); else g.fillRect(s.x + t, s.y + 3, w, s.h - 6);
    }
    // a red and white band every 300 px: the range's own marking on its back wall
    for (let k = 150; k < len - 40; k += 300) {
      g.fillStyle = C.red; if (vert) g.fillRect(s.x, s.y + k, s.w, 14); else g.fillRect(s.x + k, s.y, 14, s.h);
      g.fillStyle = C.bone; if (vert) g.fillRect(s.x, s.y + k + 14, s.w, 8); else g.fillRect(s.x + k + 14, s.y, 8, s.h);
    }
  });
  cel(g, s); outline(g, s);
}

/** Stacked sandbags in courses, each bag stitched at its ends, with the odd darker wet one. */
function rgbags(g: G, s: Solid) {
  const fh = FACE.rgbags, seed = Math.round(s.x * 5 + s.y * 11);
  front(g, s, fh, C.bagLo, '#5e5038');
  clip(g, s.x, s.y + s.h, s.w, fh, () => { for (let x = s.x; x < s.x + s.w; x += 26) { g.fillStyle = 'rgba(30, 24, 14, 0.35)'; g.fillRect(x, s.y + s.h, 2, fh); } });
  g.fillStyle = C.bagLo; g.fillRect(s.x, s.y, s.w, s.h);
  clip(g, s.x, s.y, s.w, s.h, () => {
    const vert = s.h > s.w * 1.2;
    const bl = 30, bw = 18;
    const along = vert ? s.h : s.w, across = vert ? s.w : s.h;
    for (let r = 0, row = 0; r < across + bw; r += bw - 2, row++) {
      for (let k = -((row % 2) * bl) / 2; k < along + bl; k += bl) {
        const n = hash(seed, row, Math.round(k));
        g.fillStyle = n < 0.12 ? '#8a7650' : n < 0.55 ? C.bag : C.bagHi;
        g.beginPath();
        if (vert) g.roundRect(s.x + r - 1, s.y + k + 1, bw, bl - 2, 6); else g.roundRect(s.x + k + 1, s.y + r - 1, bl - 2, bw, 6);
        g.fill(); g.strokeStyle = 'rgba(40, 32, 18, 0.7)'; g.lineWidth = 1.2; g.stroke();
        g.strokeStyle = 'rgba(60, 48, 28, 0.5)'; g.lineWidth = 1;
        g.beginPath();
        if (vert) { g.moveTo(s.x + r + 3, s.y + k + 6); g.lineTo(s.x + r + bw - 5, s.y + k + 6); } else { g.moveTo(s.x + k + 6, s.y + r + 3); g.lineTo(s.x + k + 6, s.y + r + bw - 5); }
        g.stroke();
      }
    }
  });
  cel(g, s, 2); outline(g, s);
}

/** A poured concrete blast wall with a hazard-striped cap, scorched on the side facing the pit. */
function rgblast(g: G, s: Solid) {
  const fh = FACE.rgblast;
  front(g, s, fh, '#6a665c', '#4e4b44');
  hazard(g, s.x + 1, s.y + s.h + 2, s.w - 2, 5, C.yellow, C.ink, 6);
  g.fillStyle = '#8f8c84'; g.fillRect(s.x, s.y, s.w, s.h);
  clip(g, s.x, s.y, s.w, s.h, () => {
    g.strokeStyle = 'rgba(40, 38, 34, 0.45)'; g.lineWidth = 1.4;
    for (let y = s.y + 40; y < s.y + s.h; y += 40) { g.beginPath(); g.moveTo(s.x, y); g.lineTo(s.x + s.w, y); g.stroke(); }
    const grad = g.createLinearGradient(s.x + s.w, 0, s.x, 0);
    grad.addColorStop(0, 'rgba(26, 22, 18, 0.65)'); grad.addColorStop(1, 'rgba(26, 22, 18, 0)');
    g.fillStyle = grad; g.fillRect(s.x, s.y, s.w, s.h);
    hazard(g, s.x, s.y, 8, s.h, C.yellow, C.ink, 8);
    for (let i = 0; i < 8; i++) disc(g, s.x + 18 + hash(i, 4) * (s.w - 24), s.y + 10 + hash(i, 5) * (s.h - 20), 1.6 + hash(i, 6) * 2, '#3a3630', 0);
  });
  text(g, 'BLAST WALL', s.x + s.w / 2 + 3, s.y + s.h / 2, 13, 'rgba(226, 220, 203, 0.85)', Math.PI / 2);
  cel(g, s); outline(g, s);
}

/** A heavy wooden shooting bench: planks, a sandbag rest at the muzzle end, a box of rounds and a few cases. */
function rgbench(g: G, s: Solid) {
  const fh = FACE.rgbench, seed = Math.round(s.y);
  front(g, s, fh, C.woodLo, '#46321f');
  g.fillStyle = C.ink; g.fillRect(s.x + 4, s.y + s.h, 4, fh); g.fillRect(s.x + s.w - 8, s.y + s.h, 4, fh);
  g.fillStyle = C.wood; g.fillRect(s.x, s.y, s.w, s.h);
  clip(g, s.x, s.y, s.w, s.h, () => {
    for (let y = s.y; y < s.y + s.h; y += 12) { g.fillStyle = hash(seed, y) < 0.5 ? C.woodHi : C.wood; g.fillRect(s.x, y + 1, s.w, 10); g.fillStyle = 'rgba(40, 26, 12, 0.5)'; g.fillRect(s.x, y + 11, s.w, 1.4); }
    // the rest: two small sandbags at the east (muzzle) end, with a V between
    for (const dy of [-11, 11]) { g.fillStyle = C.bag; g.beginPath(); g.roundRect(s.x + s.w - 18, s.y + s.h / 2 + dy - 8, 16, 16, 5); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 1.2; g.stroke(); }
    // a carton of rounds and a few cases
    box(g, s.x + 6, s.y + 8, 14, 10, C.red, 1.2); g.fillStyle = C.bone; g.fillRect(s.x + 8, s.y + 12, 10, 2);
    for (let i = 0; i < 4; i++) casing(g, s.x + 8 + hash(seed, i) * 22, s.y + 28 + hash(seed, i, 2) * 26, hash(seed, i, 3) * TAU, 6);
  });
  cel(g, s, 2); outline(g, s);
}

/** The ammo table: an olive steel field table loaded with ammo cans, magazines, a clipboard and the range officer's mug. */
function rgtable(g: G, s: Solid) {
  const fh = FACE.rgtable;
  front(g, s, fh, C.oliveLo, C.oliveDeep);
  g.fillStyle = C.olive; g.fillRect(s.x, s.y, s.w, s.h);
  clip(g, s.x, s.y, s.w, s.h, () => {
    g.strokeStyle = 'rgba(20, 24, 12, 0.4)'; g.lineWidth = 1; g.strokeRect(s.x + 4, s.y + 4, s.w - 8, s.h - 8);
    ammoCan(g, s.x + 18, s.y + 16, 0.05); ammoCan(g, s.x + 20, s.y + 38, -0.08, 24, 13); ammoCan(g, s.x + 46, s.y + 16, 0.1, 22, 13);
    for (let i = 0; i < 3; i++) { g.save(); g.translate(s.x + 42 + i * 8, s.y + 42); g.rotate(0.15 * (i - 1)); box(g, -3, -9, 6, 18, C.steelDark, 1); g.restore(); }
    // clipboard with the firing roster
    g.save(); g.translate(s.x + 76, s.y + 30); g.rotate(-0.12); box(g, -10, -13, 20, 26, C.woodHi, 1.2); g.fillStyle = C.paper; g.fillRect(-8, -9, 16, 20);
    g.fillStyle = 'rgba(40, 40, 40, 0.6)'; for (let k = 0; k < 5; k++) g.fillRect(-6, -6 + k * 4, 12 - (k % 2) * 4, 1.2); g.fillStyle = C.steelHi; g.fillRect(-4, -14, 8, 4); g.restore();
    // the mug, and a ring where it stood before
    g.strokeStyle = 'rgba(70, 44, 20, 0.5)'; g.lineWidth = 1.4; g.beginPath(); g.arc(s.x + s.w - 14, s.y + 46, 6, 0, TAU); g.stroke();
    disc(g, s.x + s.w - 14, s.y + 20, 7, C.bone, 1.4); disc(g, s.x + s.w - 14, s.y + 20, 4.4, '#4a2e18', 0);
    g.fillStyle = C.bone; g.fillRect(s.x + s.w - 8, s.y + 18, 4, 4);
  });
  cel(g, s); outline(g, s);
}

/** The range control tower from above: a flat roof with a parapet, antennas and loudspeakers; its south face carries the glazed cab. */
function rgtower(g: G, s: Solid) {
  const fh = FACE.rgtower;
  front(g, s, fh, C.oliveLo, C.oliveDeep);
  // the cab's windows on the front face, and its name board
  g.fillStyle = C.glass; for (let x = s.x + 8; x < s.x + s.w - 10; x += 28) { g.fillRect(x, s.y + s.h + 3, 22, 10); g.fillStyle = 'rgba(160, 200, 220, 0.35)'; g.fillRect(x + 2, s.y + s.h + 4, 6, 8); g.fillStyle = C.glass; }
  box(g, s.x + s.w / 2 - 38, s.y + s.h + 13, 76, 8, C.bone, 1);
  g.font = FONT(8); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = C.ink; g.fillText('RANGE CONTROL', s.x + s.w / 2, s.y + s.h + 17.5);
  g.fillStyle = C.olive; g.fillRect(s.x, s.y, s.w, s.h);
  clip(g, s.x, s.y, s.w, s.h, () => {
    g.fillStyle = C.oliveLo; g.fillRect(s.x + 8, s.y + 8, s.w - 16, s.h - 16);
    g.fillStyle = 'rgba(255, 250, 230, 0.07)'; for (let x = s.x + 8; x < s.x + s.w - 8; x += 16) g.fillRect(x, s.y + 8, 8, s.h - 16);
    g.strokeStyle = C.ink; g.lineWidth = 1.4; g.strokeRect(s.x + 8, s.y + 8, s.w - 16, s.h - 16);
    // roof hatch, an AC unit, the antenna mast and the loudspeakers
    box(g, s.x + 18, s.y + 18, 26, 22, C.steelLo, 1.4); g.strokeStyle = C.steelHi; g.lineWidth = 1; g.beginPath(); g.moveTo(s.x + 18, s.y + 29); g.lineTo(s.x + 44, s.y + 29); g.stroke();
    box(g, s.x + 18, s.y + s.h - 44, 34, 26, C.steelHi, 1.4); disc(g, s.x + 35, s.y + s.h - 31, 9, C.steelLo, 1.2);
    disc(g, s.x + s.w - 34, s.y + s.h / 2, 5, C.steelDark, 1.4);
    g.strokeStyle = C.ink; g.lineWidth = 2; g.beginPath(); g.moveTo(s.x + s.w - 34, s.y + s.h / 2); g.lineTo(s.x + s.w - 54, s.y + 22); g.moveTo(s.x + s.w - 34, s.y + s.h / 2); g.lineTo(s.x + s.w - 14, s.y + 22); g.stroke();
    for (const dy of [-22, 22]) { g.save(); g.translate(s.x + s.w - 14, s.y + s.h / 2 + dy); g.fillStyle = C.steelHi; g.beginPath(); g.moveTo(-8, -4); g.lineTo(6, -9); g.lineTo(6, 9); g.lineTo(-8, 4); g.closePath(); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 1.2; g.stroke(); g.restore(); }
  });
  cel(g, s, 4); outline(g, s);
}

/** The ammo hut: a corrugated olive roof, an explosives placard and the stencilled name. */
function rghut(g: G, s: Solid) {
  const fh = FACE.rghut;
  front(g, s, fh, '#434c36', '#2e3424');
  box(g, s.x + s.w / 2 - 20, s.y + s.h + 2, 40, fh - 2, C.steelLo, 1.4);
  g.fillStyle = C.yellow; g.fillRect(s.x + s.w / 2 - 2, s.y + s.h + 6, 4, 4);
  g.fillStyle = '#5f6a4c'; g.fillRect(s.x, s.y, s.w, s.h);
  clip(g, s.x, s.y, s.w, s.h, () => {
    for (let x = s.x; x < s.x + s.w; x += 10) { g.fillStyle = 'rgba(255, 250, 230, 0.09)'; g.fillRect(x, s.y, 4, s.h); g.fillStyle = 'rgba(10, 14, 6, 0.18)'; g.fillRect(x + 6, s.y, 2, s.h); }
    g.fillStyle = 'rgba(20, 24, 12, 0.35)'; g.fillRect(s.x, s.y + s.h / 2 - 2, s.w, 4);
    // the orange explosives diamond
    g.save(); g.translate(s.x + 28, s.y + 30); g.rotate(Math.PI / 4); box(g, -11, -11, 22, 22, '#e07a2a', 1.4); g.restore();
    text(g, '1.4', s.x + 28, s.y + 31, 10, C.ink);
    text(g, 'AMMO', s.x + s.w / 2 + 18, s.y + 32, 22, 'rgba(226, 220, 203, 0.8)');
    text(g, 'NO NAKED FLAMES', s.x + s.w / 2, s.y + s.h - 24, 11, 'rgba(226, 179, 58, 0.8)');
  });
  cel(g, s, 3); outline(g, s);
}

/** Shoot-house walls: plywood sheets on a 2x4 frame, room numbers sprayed on, chewed by rounds. */
function rgply(g: G, s: Solid) {
  const fh = FACE.rgply, seed = Math.round(s.x * 13 + s.y);
  front(g, s, fh, C.plyLo, '#7e6440');
  clip(g, s.x, s.y + s.h, s.w, fh, () => { g.strokeStyle = 'rgba(60, 44, 20, 0.6)'; g.lineWidth = 1.4; for (let x = s.x + 120; x < s.x + s.w; x += 120) { g.beginPath(); g.moveTo(x, s.y + s.h); g.lineTo(x, s.y + s.h + fh); g.stroke(); } });
  g.fillStyle = C.ply; g.fillRect(s.x, s.y, s.w, s.h);
  clip(g, s.x, s.y, s.w, s.h, () => {
    const vert = s.h > s.w, len = vert ? s.h : s.w;
    g.fillStyle = C.wood; if (vert) g.fillRect(s.x + s.w / 2 - 3, s.y, 6, s.h); else g.fillRect(s.x, s.y + s.h / 2 - 3, s.w, 6);
    g.strokeStyle = 'rgba(70, 50, 24, 0.6)'; g.lineWidth = 1.4;
    for (let k = 120; k < len; k += 120) { g.beginPath(); if (vert) { g.moveTo(s.x, s.y + k); g.lineTo(s.x + s.w, s.y + k); } else { g.moveTo(s.x + k, s.y); g.lineTo(s.x + k, s.y + s.h); } g.stroke(); }
    for (let i = 0; i < len / 14; i++) {
      const t = hash(seed, i) * len, o = hash(seed, i, 2) * (vert ? s.w : s.h);
      disc(g, vert ? s.x + o : s.x + t, vert ? s.y + t : s.y + o, 1.4 + hash(seed, i, 3) * 1.4, '#3a2a18', 0);
    }
  });
  cel(g, s, 2); outline(g, s);
}

/** The earth backstop: a long mound of packed spoil, crowned with grass, its face pocked where rounds bury themselves. */
function rgberm(g: G, s: Solid) {
  const fh = FACE.rgberm, seed = Math.round(s.x + s.y * 3);
  front(g, s, fh, '#5a4a34', '#44382a');
  clip(g, s.x, s.y + s.h, s.w, fh, () => { for (let i = 0; i < s.w / 9; i++) disc(g, s.x + hash(seed, i, 7) * s.w, s.y + s.h + 3 + hash(seed, i, 8) * (fh - 6), 1.4 + hash(seed, i, 9) * 2, 'rgba(30, 24, 16, 0.5)', 0); });
  g.fillStyle = '#7a6a4c'; g.fillRect(s.x, s.y, s.w, s.h);
  clip(g, s.x, s.y, s.w, s.h, () => {
    const vert = s.h > s.w;
    // contour bands: a lighter crown down the middle, darker toes either side
    const across = vert ? s.w : s.h;
    for (let k = 0; k < 5; k++) {
      const f = k / 5, w = across * (1 - f) * 0.9;
      g.fillStyle = k % 2 ? 'rgba(130, 114, 82, 0.35)' : 'rgba(150, 132, 96, 0.28)';
      if (vert) g.fillRect(s.x + (across - w) / 2, s.y, w, s.h); else g.fillRect(s.x, s.y + (across - w) / 2, s.w, w);
    }
    // grass on the crown and a scatter of stones
    const n = Math.round((s.w * s.h) / 420);
    for (let i = 0; i < n; i++) {
      const cx = vert ? s.x + across * (0.2 + hash(seed, i) * 0.6) : s.x + hash(seed, i) * s.w;
      const cy = vert ? s.y + hash(seed, i, 1) * s.h : s.y + across * (0.15 + hash(seed, i, 1) * 0.7);
      if (hash(seed, i, 2) < 0.6) {
        g.strokeStyle = hash(seed, i, 3) < 0.5 ? C.grass : C.grassHi; g.lineWidth = 2; g.lineCap = 'round';
        g.beginPath(); for (let b = -2; b <= 2; b++) { g.moveTo(cx, cy); g.lineTo(cx + b * 3, cy - 6 - hash(seed, i, b + 5) * 5); } g.stroke();
      } else disc(g, cx, cy, 2 + hash(seed, i, 4) * 3, hash(seed, i, 5) < 0.5 ? C.gravel : C.gravelHi, 1);
    }
    // where rounds go in: dark pocks on the face toward the firing line
    if (vert) for (let i = 0; i < s.h / 10; i++) disc(g, s.x + 4 + hash(seed, i, 11) * 26, s.y + hash(seed, i, 12) * s.h, 1.6 + hash(seed, i, 13) * 2.2, 'rgba(34, 26, 16, 0.65)', 0);
  });
  cel(g, s, 4); outline(g, s);
}

export const RANGE_WALLS: Partial<Record<SolidKind, (ctx: CanvasRenderingContext2D, s: Solid) => void>> = { rgwall, rgbags, rgblast, rgbench, rgtable, rgtower, rghut, rgply, rgberm };
