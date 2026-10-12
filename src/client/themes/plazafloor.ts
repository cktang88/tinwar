import { CROSSINGS, FOUNTAIN, ROADS, TREES, VEHICLES, type PlazaFloor } from '../../shared/maps/plazageo.ts';
import type { FloorPlan } from '../floor.ts';
import { blotch, seeded } from '../grain.ts';
import { MAPS } from '../../shared/maps.ts';
import { C, INK, SIZE, TAU, both, box, disc, hexA, letter, mix, placeRects, rr, shade, turn, type Box } from './plazakit.ts';
import { paintPlazaStories } from './plazastories.ts';

/**
 * The Plaza's ground, baked once: pale sidewalk slabs everywhere, the avenues and the boulevard in asphalt with kerbs, lane lines,
 * zebra crossings and their names painted on, granite rings round the fountain, and a floor of its own in every room (marble in
 * the tower, herringbone in the cafe, parquet in the library, chequer in the pizzeria, bays in the garage, dirt on the site, grass
 * in the park). The busy things sit at the margins so lanes stay readable; the hand-drawn little stories are plazastories.ts.
 */
type G = CanvasRenderingContext2D;

const clip = (g: G, r: Box, paint: () => void) => { g.save(); g.beginPath(); g.rect(r.x, r.y, r.w, r.h); g.clip(); paint(); g.restore(); };

function sidewalk(g: G, size: number, rand: () => number) {
  g.fillStyle = C.pave; g.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += 100) for (let x = 0; x < size; x += 100) {
    const k = rand() - 0.5;
    g.fillStyle = k > 0 ? hexA(C.paveHi, k * 0.6) : hexA(C.paveLo, -k * 0.6);
    g.fillRect(x, y, 100, 100);
  }
  g.strokeStyle = hexA(C.joint, 0.55); g.lineWidth = 2; g.beginPath();
  for (let v = 0; v <= size; v += 100) { g.moveTo(v, 0); g.lineTo(v, size); g.moveTo(0, v); g.lineTo(size, v); }
  g.stroke();
  g.strokeStyle = hexA(C.joint, 0.22); g.lineWidth = 1; g.beginPath();
  for (let v = 50; v <= size; v += 100) { g.moveTo(v, 0); g.lineTo(v, size); g.moveTo(0, v); g.lineTo(size, v); }
  g.stroke();
  // gum spots and weathering
  for (let i = 0; i < 2600; i++) { g.fillStyle = rand() < 0.6 ? 'rgba(40, 40, 40, 0.16)' : 'rgba(255, 255, 250, 0.12)'; g.beginPath(); g.arc(rand() * size, rand() * size, 1.5 + rand() * 2.5, 0, TAU); g.fill(); }
}

function road(g: G, r: Box, axis: 'h' | 'v', rand: () => number) {
  g.fillStyle = C.asphalt; g.fillRect(r.x, r.y, r.w, r.h);
  for (let i = 0; i < (r.w * r.h) / 2500; i++) { g.fillStyle = rand() < 0.5 ? hexA(C.asphaltHi, 0.6) : hexA(C.asphaltLo, 0.6); g.fillRect(r.x + rand() * r.w, r.y + rand() * r.h, 3, 3); }
  // patches and a sealed crack or two
  for (let i = 0; i < (r.w * r.h) / 120000; i++) { const w = 60 + rand() * 120, h = 40 + rand() * 80; g.fillStyle = 'rgba(30, 32, 36, 0.35)'; g.fillRect(r.x + rand() * (r.w - w), r.y + rand() * (r.h - h), w, h); }
  // the kerb: a pale stone edge and its shadow on the road
  g.fillStyle = C.kerb;
  if (axis === 'h') { g.fillRect(r.x, r.y - 10, r.w, 10); g.fillRect(r.x, r.y + r.h, r.w, 10); }
  else { g.fillRect(r.x - 10, r.y, 10, r.h); g.fillRect(r.x + r.w, r.y, 10, r.h); }
  g.fillStyle = 'rgba(10, 12, 16, 0.3)';
  if (axis === 'h') g.fillRect(r.x, r.y, r.w, 6); else g.fillRect(r.x, r.y, 6, r.h);
  g.strokeStyle = INK; g.lineWidth = 1.5; g.beginPath();
  if (axis === 'h') { g.moveTo(r.x, r.y); g.lineTo(r.x + r.w, r.y); g.moveTo(r.x, r.y + r.h); g.lineTo(r.x + r.w, r.y + r.h); }
  else { g.moveTo(r.x, r.y); g.lineTo(r.x, r.y + r.h); g.moveTo(r.x + r.w, r.y); g.lineTo(r.x + r.w, r.y + r.h); }
  g.stroke();
  // lane lines: a dashed white centre line and solid edge lines
  g.strokeStyle = hexA(C.line, 0.75); g.lineWidth = 5; g.setLineDash([60, 50]); g.beginPath();
  if (axis === 'h') { g.moveTo(r.x, r.y + r.h / 2); g.lineTo(r.x + r.w, r.y + r.h / 2); } else { g.moveTo(r.x + r.w / 2, r.y); g.lineTo(r.x + r.w / 2, r.y + r.h); }
  g.stroke(); g.setLineDash([]);
  g.strokeStyle = hexA(C.lineYellow, 0.6); g.lineWidth = 3; g.beginPath();
  if (axis === 'h') { g.moveTo(r.x, r.y + 18); g.lineTo(r.x + r.w, r.y + 18); g.moveTo(r.x, r.y + r.h - 18); g.lineTo(r.x + r.w, r.y + r.h - 18); }
  else { g.moveTo(r.x + 18, r.y); g.lineTo(r.x + 18, r.y + r.h); g.moveTo(r.x + r.w - 18, r.y); g.lineTo(r.x + r.w - 18, r.y + r.h); }
  g.stroke();
  // drains along the kerb and manholes in the lane
  for (let t = 150; t < (axis === 'h' ? r.w : r.h); t += 420) {
    const [dx, dy] = axis === 'h' ? [r.x + t, r.y + 8] : [r.x + 8, r.y + t];
    box(g, dx - (axis === 'h' ? 22 : 6), dy - (axis === 'h' ? 6 : 22), axis === 'h' ? 44 : 14, axis === 'h' ? 14 : 44, '#2a2c30', 1.4);
    if ((t / 420) % 2 < 1) { const [mx, my] = axis === 'h' ? [r.x + t + 180, r.y + r.h * 0.72] : [r.x + r.w * 0.72, r.y + t + 180]; manhole(g, mx, my); }
  }
}

function manhole(g: G, x: number, y: number) {
  disc(g, x, y, 20, '#4a4c50', 2);
  g.strokeStyle = 'rgba(200, 200, 200, 0.25)'; g.lineWidth = 1.5;
  for (let k = -12; k <= 12; k += 6) { g.beginPath(); g.moveTo(x - Math.sqrt(256 - k * k * 0.9), y + k); g.lineTo(x + Math.sqrt(256 - k * k * 0.9), y + k); g.stroke(); }
}

function zebra(g: G, x: number, y: number, w: number, h: number) {
  g.fillStyle = hexA(C.line, 0.85);
  if (h > w) for (let yy = y + 8; yy < y + h - 8; yy += 36) g.fillRect(x + 12, yy, w - 24, 20);
  else for (let xx = x + 8; xx < x + w - 8; xx += 36) g.fillRect(xx, y + 12, 20, h - 24);
}

/* ------------------------------------------------------------------ room floors */

function tiles(g: G, r: Box, t: number, a: string, b: string, joint: string) {
  for (let y = r.y, j = 0; y < r.y + r.h; y += t, j++) for (let x = r.x, i = 0; x < r.x + r.w; x += t, i++) { g.fillStyle = (i + j) % 2 ? a : b; g.fillRect(x, y, t, t); }
  g.strokeStyle = joint; g.lineWidth = 1.2; g.beginPath();
  for (let x = r.x; x <= r.x + r.w; x += t) { g.moveTo(x, r.y); g.lineTo(x, r.y + r.h); }
  for (let y = r.y; y <= r.y + r.h; y += t) { g.moveTo(r.x, y); g.lineTo(r.x + r.w, y); }
  g.stroke();
}
function planks(g: G, r: Box, w: number, col: string, rand: () => number, horizontal = true) {
  g.fillStyle = col; g.fillRect(r.x, r.y, r.w, r.h);
  const len = horizontal ? r.h : r.w;
  for (let t = 0; t < len; t += w) {
    let s = -rand() * 200;
    while (s < (horizontal ? r.w : r.h)) {
      const l = 120 + rand() * 160;
      g.fillStyle = rand() < 0.5 ? 'rgba(255, 230, 190, 0.08)' : 'rgba(40, 20, 6, 0.1)';
      if (horizontal) g.fillRect(r.x + s, r.y + t, l, w); else g.fillRect(r.x + t, r.y + s, w, l);
      g.fillStyle = 'rgba(40, 20, 8, 0.4)';
      if (horizontal) g.fillRect(r.x + s, r.y + t, 1.5, w); else g.fillRect(r.x + t, r.y + s, w, 1.5);
      s += l;
    }
    g.fillStyle = 'rgba(40, 20, 8, 0.35)';
    if (horizontal) g.fillRect(r.x, r.y + t, r.w, 1.5); else g.fillRect(r.x + t, r.y, 1.5, r.h);
  }
}
function herringbone(g: G, r: Box, col: string) {
  g.fillStyle = col; g.fillRect(r.x, r.y, r.w, r.h);
  g.strokeStyle = 'rgba(50, 26, 10, 0.4)'; g.lineWidth = 1.4;
  const s = 18, L = 54;
  for (let y = r.y - L; y < r.y + r.h + L; y += L) for (let x = r.x - L; x < r.x + r.w + L; x += s * 2) {
    const off = ((y - r.y) / L) % 2 ? s : 0;
    g.strokeRect(x + off, y, s, L / 2 + s / 2);
    g.save(); g.translate(x + off + s, y + L / 2); g.strokeRect(0, 0, L / 2 + s / 2, s); g.restore();
  }
}

function floorOf(g: G, kind: PlazaFloor, r: Box, rand: () => number, twin: boolean) {
  clip(g, r, () => {
    switch (kind) {
      case 'garage': {
        g.fillStyle = '#6c6c68'; g.fillRect(r.x, r.y, r.w, r.h);
        for (let i = 0; i < 18; i++) blotch(g, r.x + rand() * r.w, r.y + rand() * r.h, 30 + rand() * 50, '20, 20, 22', 0.3);
        // bays along the north wall and down the middle, numbered
        g.strokeStyle = hexA(C.line, 0.7); g.lineWidth = 4; g.beginPath();
        const yN = twin ? r.y + r.h - 340 : r.y + 50, yM = twin ? r.y + r.h - 840 : r.y + 550;
        for (const y0 of [yN, yM]) for (let x = r.x + 420; x < r.x + r.w - 60; x += 145) { g.moveTo(x, y0); g.lineTo(x, y0 + 290); }
        g.stroke();
        let n = 1;
        for (const y0 of [yN, yM]) for (let x = r.x + 420; x < r.x + r.w - 200; x += 145) letter(g, String(n++).padStart(2, '0'), x + 72, y0 + (twin ? 40 : 250), 22, hexA(C.line, 0.55));
        // the driving lane's arrows and the hatched no-park box by the booth
        g.fillStyle = hexA(C.yellow, 0.5);
        for (let x = r.x + 300; x < r.x + r.w - 100; x += 300) letter(g, twin ? '◀' : '▶', x, r.y + (twin ? r.h - 470 : 470), 40, hexA(C.line, 0.45));
        break;
      }
      case 'site': {
        g.fillStyle = C.dirt; g.fillRect(r.x, r.y, r.w, r.h);
        for (let i = 0; i < 40; i++) blotch(g, r.x + rand() * r.w, r.y + rand() * r.h, 60 + rand() * 120, rand() < 0.5 ? '70, 56, 40' : '150, 130, 100', 0.25);
        for (let i = 0; i < 1800; i++) { g.fillStyle = rand() < 0.5 ? 'rgba(190, 175, 150, 0.4)' : 'rgba(50, 40, 30, 0.35)'; g.fillRect(r.x + rand() * r.w, r.y + rand() * r.h, 3, 3); }
        // tyre ruts from the gate, a poured slab under the frame, puddles
        g.strokeStyle = 'rgba(40, 30, 20, 0.45)'; g.lineWidth = 16; g.lineCap = 'round';
        const gx = twin ? SIZE - 1800 : 1800;
        for (const off of [-40, 40]) { g.beginPath(); g.moveTo(gx + off, twin ? r.y : r.y + r.h); g.quadraticCurveTo(gx + off + 200, r.y + r.h / 2, gx + off + 500 * (twin ? -1 : 1), twin ? r.y + r.h - 200 : r.y + 200); g.stroke(); }
        g.lineCap = 'butt';
        const slab = twin ? { x: SIZE - 2400, y: SIZE - 650, w: 900, h: 600 } : { x: 1500, y: 50, w: 900, h: 600 };
        g.fillStyle = '#9a9890'; g.fillRect(slab.x, slab.y, slab.w, slab.h);
        g.strokeStyle = 'rgba(40, 40, 40, 0.35)'; g.lineWidth = 2; g.strokeRect(slab.x, slab.y, slab.w, slab.h);
        g.strokeStyle = hexA('#e85a5a', 0.6); g.lineWidth = 3; g.setLineDash([16, 10]); g.strokeRect(slab.x + 40, slab.y + 40, slab.w - 80, slab.h - 80); g.setLineDash([]);
        for (let i = 0; i < 6; i++) { const x = r.x + rand() * r.w, y = r.y + rand() * r.h; g.fillStyle = hexA(C.waterLo, 0.55); g.beginPath(); g.ellipse(x, y, 30 + rand() * 40, 14 + rand() * 18, rand() * 3, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,0.2)'; g.beginPath(); g.ellipse(x - 8, y - 4, 10, 3, 0, 0, TAU); g.fill(); }
        break;
      }
      case 'marble': case 'terrazzo': {
        if (kind === 'marble') {
          tiles(g, r, 100, '#d8d4cc', '#c8c2b8', 'rgba(80, 76, 70, 0.35)');
          g.strokeStyle = 'rgba(120, 110, 100, 0.25)'; g.lineWidth = 1.5;
          for (let i = 0; i < 40; i++) { let x = r.x + rand() * r.w, y = r.y + rand() * r.h; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (rand() - 0.3) * 60; y += (rand() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); }
        } else {
          g.fillStyle = '#c4bcae'; g.fillRect(r.x, r.y, r.w, r.h);
          for (let i = 0; i < (r.w * r.h) / 60; i++) { g.fillStyle = ['rgba(90,80,70,0.4)', 'rgba(240,236,226,0.5)', 'rgba(160,90,70,0.3)'][Math.floor(rand() * 3)]!; g.fillRect(r.x + rand() * r.w, r.y + rand() * r.h, 2.5, 2.5); }
          g.strokeStyle = hexA('#b79a4a', 0.6); g.lineWidth = 3; g.beginPath(); for (let x = r.x + 200; x < r.x + r.w; x += 200) { g.moveTo(x, r.y); g.lineTo(x, r.y + r.h); } g.stroke();
        }
        const gr = g.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
        gr.addColorStop(0, 'rgba(255,255,255,0.14)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,0.1)');
        g.fillStyle = gr; g.fillRect(r.x, r.y, r.w, r.h);
        break;
      }
      case 'station': {
        tiles(g, r, 100, mix(C.granite, 255, 0.05), C.granite, 'rgba(60, 58, 52, 0.35)');
        break;
      }
      case 'cafe': herringbone(g, r, C.oak); break;
      case 'checker': tiles(g, r, 50, '#e8e4da', '#2e3036', 'rgba(20,20,24,0.4)'); break;
      case 'terrace': planks(g, r, 25, '#9b7448', rand); break;
      case 'oak': planks(g, r, 20, '#a8784a', rand, false); break;
      case 'vinyl': tiles(g, r, 50, '#dcdcd6', '#cfd0cc', 'rgba(80, 80, 80, 0.25)'); break;
      case 'tile': tiles(g, r, 25, '#ecece6', '#e2e2dc', 'rgba(80, 90, 100, 0.3)'); break;
      case 'lot': {
        g.fillStyle = C.asphaltHi; g.fillRect(r.x, r.y, r.w, r.h);
        for (let i = 0; i < 900; i++) { g.fillStyle = rand() < 0.5 ? 'rgba(90,92,96,0.5)' : 'rgba(40,42,46,0.5)'; g.fillRect(r.x + rand() * r.w, r.y + rand() * r.h, 3, 3); }
        g.strokeStyle = hexA(C.lineYellow, 0.55); g.lineWidth = 4; g.setLineDash([22, 14]);
        g.strokeRect(r.x + 30, r.y + 30, r.w - 60, r.h - 60); g.setLineDash([]);
        break;
      }
      case 'platform': {
        g.fillStyle = '#9c9a92'; g.fillRect(r.x, r.y, r.w, r.h);
        tiles(g, { x: r.x, y: r.y, w: 640, h: r.h }, 50, '#a6a49c', '#9e9c94', 'rgba(60,60,56,0.3)');
        // the platform edge: a yellow tactile strip, then the bus bay in asphalt with its BUS STOP box
        const ex = twin ? SIZE - 650 : 640;
        g.fillStyle = C.asphalt; g.fillRect(twin ? r.x : ex + 10, r.y, twin ? ex - r.x - 10 : r.x + r.w - ex - 10, r.h);
        g.fillStyle = C.yellow; g.fillRect(twin ? ex - 10 : ex - 30, r.y, 30, r.h);
        g.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = r.y + 6; y < r.y + r.h; y += 10) for (let k = 0; k < 3; k++) { g.beginPath(); g.arc((twin ? ex - 10 : ex - 30) + 5 + k * 10, y, 2, 0, TAU); g.fill(); }
        g.fillStyle = C.kerb; g.fillRect(twin ? ex - 20 : ex, r.y, 10, r.h);
        const bx = twin ? r.x + 30 : ex + 30;
        g.strokeStyle = hexA(C.lineYellow, 0.8); g.lineWidth = 5; g.strokeRect(bx, r.y + 250, 240, 800);
        g.beginPath(); for (let y = r.y + 270; y < r.y + 1040; y += 60) { g.moveTo(bx, y); g.lineTo(bx + 240, y + 60); } g.stroke();
        letter(g, 'BUS STOP', bx + 120, r.y + 200, 36, hexA(C.lineYellow, 0.85), { rot: twin ? Math.PI / 2 : -Math.PI / 2 });
        break;
      }
      case 'park': {
        g.fillStyle = C.grass; g.fillRect(r.x, r.y, r.w, r.h);
        for (let x = r.x; x < r.x + r.w; x += 60) { g.fillStyle = (x - r.x) / 60 % 2 ? 'rgba(255,255,220,0.05)' : 'rgba(0,30,0,0.05)'; g.fillRect(x, r.y, 60, r.h); }
        for (let i = 0; i < 1400; i++) { g.strokeStyle = rand() < 0.5 ? hexA(C.grassHi, 0.6) : hexA(C.grassLo, 0.6); g.lineWidth = 1.6; const x = r.x + rand() * r.w, y = r.y + rand() * r.h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rand() - 0.5) * 4, y - 6); g.stroke(); }
        // a gravel path winding from the gap by the terminal to the east gate, round the pond
        g.strokeStyle = C.gravel; g.lineWidth = 70; g.lineCap = 'round';
        const P = (x: number, y: number) => (twin ? turn({ x, y }) : { x, y });
        const a = P(450, 3700), b = P(450, 3950), c = P(700, 4150), d = P(850, 4120), e = P(150, 4420), f = P(450, 4650);
        g.beginPath(); g.moveTo(a.x, a.y); g.quadraticCurveTo(b.x, b.y, c.x, c.y); g.lineTo(d.x, d.y); g.stroke();
        g.beginPath(); g.moveTo(c.x, c.y); g.quadraticCurveTo(e.x, e.y, f.x, f.y); g.stroke();
        g.strokeStyle = 'rgba(80, 70, 50, 0.3)'; g.lineWidth = 2; g.setLineDash([3, 7]);
        g.beginPath(); g.moveTo(a.x, a.y); g.quadraticCurveTo(b.x, b.y, c.x, c.y); g.lineTo(d.x, d.y); g.stroke(); g.setLineDash([]);
        g.lineCap = 'butt';
        // flower beds
        for (let i = 0; i < 6; i++) { const p = P(100 + rand() * 650, 3780 + rand() * 750); g.fillStyle = '#5a4030'; g.beginPath(); g.ellipse(p.x, p.y, 40, 22, rand(), 0, TAU); g.fill(); for (let k = 0; k < 14; k++) disc(g, p.x + (rand() - 0.5) * 60, p.y + (rand() - 0.5) * 30, 3.4, twin ? (rand() < 0.5 ? '#ff6a8a' : '#ffd0e0') : (rand() < 0.5 ? '#ffd24a' : '#b48ae0'), 0.6); }
        break;
      }
      case 'alley': {
        g.fillStyle = '#55565a'; g.fillRect(r.x, r.y, r.w, r.h);
        for (let i = 0; i < 30; i++) blotch(g, r.x + rand() * r.w, r.y + rand() * r.h, 40 + rand() * 60, '20, 20, 18', 0.3);
        g.strokeStyle = 'rgba(30,30,30,0.5)'; g.lineWidth = 6; g.beginPath(); g.moveTo(r.x, r.y + r.h / 2); g.lineTo(r.x + r.w, r.y + r.h / 2); g.stroke();
        break;
      }
      case 'square': break;
    }
  });
}

/* ------------------------------------------------------------------ the civic square */

function square(g: G) {
  const cx = FOUNTAIN.x, cy = FOUNTAIN.y;
  const box0 = { x: 2200, y: 2350, w: 1600, h: 1300 };
  clip(g, box0, () => {
    g.fillStyle = C.granite; g.fillRect(box0.x, box0.y, box0.w, box0.h);
    // rings of granite setts round the fountain, alternating tones, joints radiating
    for (let rad = 1000; rad > 330; rad -= 60) {
      g.fillStyle = (rad / 60) % 2 < 1 ? C.granite : mix(C.granite, 0, 0.08);
      g.beginPath(); g.arc(cx, cy, rad, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(50, 46, 40, 0.35)'; g.lineWidth = 2; g.stroke();
      g.strokeStyle = 'rgba(50, 46, 40, 0.2)'; g.lineWidth = 1.2; g.beginPath();
      const n = Math.round((TAU * rad) / 70);
      for (let k = 0; k < n; k++) { const a = (k / n) * TAU + rad; g.moveTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad); g.lineTo(cx + Math.cos(a) * (rad - 60), cy + Math.sin(a) * (rad - 60)); }
      g.stroke();
    }
    // a darker band of basalt round the basin, and the four paths across it in pale stone
    g.fillStyle = '#5e5c58'; g.beginPath(); g.arc(cx, cy, 380, 0, TAU); g.fill();
    g.strokeStyle = hexA(C.cream, 0.5); g.lineWidth = 4; g.beginPath(); g.arc(cx, cy, 380, 0, TAU); g.stroke();
    for (let k = 0; k < 4; k++) {
      g.save(); g.translate(cx, cy); g.rotate((k * TAU) / 4);
      g.fillStyle = mix(C.granite, 255, 0.12); g.fillRect(200, -80, 820, 160);
      g.strokeStyle = 'rgba(60, 56, 50, 0.3)'; g.lineWidth = 1.5; for (let x = 200; x < 1020; x += 40) { g.beginPath(); g.moveTo(x, -80); g.lineTo(x, 80); g.stroke(); }
      g.restore();
    }
    // the splash pad: blue-grey resin, a sun of nozzles, zone B's own floor
    g.fillStyle = '#5f7a86'; g.beginPath(); g.arc(cx, cy, 250, 0, TAU); g.fill();
    const gr = g.createRadialGradient(cx, cy, 20, cx, cy, 250);
    gr.addColorStop(0, 'rgba(160, 220, 235, 0.5)'); gr.addColorStop(1, 'rgba(160, 220, 235, 0)');
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, 250, 0, TAU); g.fill();
    g.strokeStyle = hexA(C.cream, 0.55); g.lineWidth = 3;
    for (const rad of [80, 160, 230]) { g.beginPath(); g.arc(cx, cy, rad, 0, TAU); g.stroke(); }
    for (let k = 0; k < 16; k++) { const a = (k / 16) * TAU; g.beginPath(); g.moveTo(cx + Math.cos(a) * 80, cy + Math.sin(a) * 80); g.lineTo(cx + Math.cos(a) * 230, cy + Math.sin(a) * 230); g.stroke(); }
    for (const rad of [120, 200]) for (let k = 0; k < (rad === 120 ? 8 : 12); k++) { const a = (k / (rad === 120 ? 8 : 12)) * TAU + rad; disc(g, cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, 5, '#c8d0d4', 1.4); disc(g, cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, 2, '#2a3a44', 0); }
    // a compass in brass at the very centre, the city's year in the ring
    g.fillStyle = hexA('#d8b04a', 0.85);
    g.beginPath(); for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU - Math.PI / 2, q = k % 2 ? 14 : 50; g.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q); } g.closePath(); g.fill();
    g.strokeStyle = INK; g.lineWidth = 1.6; g.stroke();
    letter(g, 'N', cx, cy - 64, 18, hexA('#d8b04a', 0.9));
    letter(g, 'CIVIC SQUARE · EST. 1891', cx, cy + 300 + 22, 18, hexA(C.cream, 0.6), { spacing: 4 });
  });
}

/* ------------------------------------------------------------------ street furniture painted flat */

function treeGrate(g: G, x: number, y: number) {
  g.fillStyle = '#3a3c40'; g.fillRect(x - 46, y - 46, 92, 92);
  g.strokeStyle = 'rgba(160,160,160,0.4)'; g.lineWidth = 2;
  for (let k = 1; k < 4; k++) { g.beginPath(); g.arc(x, y, k * 13, 0, TAU); g.stroke(); }
  g.strokeStyle = INK; g.lineWidth = 2; g.strokeRect(x - 46, y - 46, 92, 92);
}
function bikeRack(g: G, x: number, y: number, n: number, rand: () => number) {
  for (let i = 0; i < n; i++) {
    const bx = x + i * 34;
    g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.moveTo(bx, y - 22); g.lineTo(bx, y + 22); g.stroke();
    g.strokeStyle = C.steel; g.lineWidth = 3; g.stroke();
    if (rand() < 0.6) {
      const col = ['#c83a3a', '#3a6ac8', '#2a2a2a', '#e8c83a'][Math.floor(rand() * 4)]!;
      g.strokeStyle = INK; g.lineWidth = 2;
      for (const dy of [-18, 18]) { g.beginPath(); g.arc(bx + 8, y + dy, 11, 0, TAU); g.stroke(); }
      g.strokeStyle = col; g.lineWidth = 3; g.beginPath(); g.moveTo(bx + 8, y - 18); g.lineTo(bx + 8, y + 18); g.stroke();
    }
  }
}
function pads(g: G) {
  const map = MAPS.plaza;
  const mat = (r: Box, col: string) => {
    g.fillStyle = 'rgba(20, 22, 26, 0.3)'; rr(g, r.x - 8, r.y - 6, r.w + 18, r.h + 18, 14); g.fill();
    g.fillStyle = hexA(col, 0.45); rr(g, r.x - 8, r.y - 8, r.w + 16, r.h + 16, 14); g.fill();
    g.strokeStyle = hexA(C.white, 0.6); g.lineWidth = 3; g.setLineDash([18, 10]); rr(g, r.x + 4, r.y + 4, r.w - 8, r.h - 8, 8); g.stroke(); g.setLineDash([]);
    g.strokeStyle = INK; g.lineWidth = 2.2; rr(g, r.x - 8, r.y - 8, r.w + 16, r.h + 16, 14); g.stroke();
    // a big bus-stop roundel: a team colour ring and a bus pictogram
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    disc(g, cx, cy, 46, hexA(C.white, 0.7), 0); g.strokeStyle = hexA(col, 0.95); g.lineWidth = 10; g.beginPath(); g.arc(cx, cy, 46, 0, TAU); g.stroke();
    letter(g, 'BUS', cx, cy + 1, 30, hexA(col, 0.95));
  };
  for (const r of map.spawns.red) mat(r, '#c4524a');
  for (const r of map.spawns.blue) mat(r, '#4f7fc4');
  for (const r of map.spawns.ffa) {
    if (map.spawns.red.some((q) => q.x === r.x && q.y === r.y) || map.spawns.blue.some((q) => q.x === r.x && q.y === r.y)) continue;
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2, R = Math.min(r.w, r.h) / 2 + 20;
    g.strokeStyle = hexA(C.white, 0.5); g.lineWidth = 6; g.setLineDash([16, 12]); g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.stroke(); g.setLineDash([]);
    g.fillStyle = hexA(C.white, 0.35); g.beginPath(); for (let i = 0; i < 10; i++) { const a = (i * TAU) / 10 - Math.PI / 2, q = i % 2 ? 7 : 18; g.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q); } g.closePath(); g.fill();
  }
}

/* ------------------------------------------------------------------------------------------------------------------ */

export function paintPlazaFloor(g: G, size: number, seed: number, _plan: FloorPlan) {
  const rand = seeded(seed ^ 0x51a2a);
  sidewalk(g, size, rand);
  for (const rd of ROADS) for (const r of both(rd)) road(g, r, rd.axis, rand);
  // the seam lanes at the top and bottom of the map: a cobbled shared street between the halves
  for (const r of [{ x: 2850, y: 0, w: 300, h: 1100 }, { x: 2850, y: 4900, w: 300, h: 1100 }]) clip(g, r, () => { tiles(g, r, 25, '#7c7a74', '#86847d', 'rgba(40,40,36,0.35)'); });
  for (const [x, y, w, h] of CROSSINGS) for (const r of both({ x, y, w, h })) zebra(g, r.x, r.y, r.w, r.h);
  // street names on the carriageways
  for (const [name, twinName, x, y, rot] of [['MAIN AVENUE', 'HARBOUR AVENUE', 2000, 1250, 0], ['MARKET STREET', 'CANAL STREET', 2000, 4800, 0], ['CIVIC BOULEVARD', 'CIVIC BOULEVARD', 1150, 3600, -Math.PI / 2]] as const) {
    letter(g, name, x, y, 40, hexA(C.line, 0.4), { rot, spacing: 8 });
    const t = turn({ x, y }); letter(g, twinName, t.x, t.y, 40, hexA(C.line, 0.4), { rot: rot === 0 ? 0 : Math.PI / 2, spacing: 8 });
  }
  // parking bays where the cars stand at the kerb
  for (const v of VEHICLES.filter((q) => q.id.startsWith('a-'))) for (const p of [v, { ...turn(v), rot: v.rot }]) {
    g.save(); g.translate(p.x, p.y); g.rotate(v.rot);
    g.strokeStyle = hexA(C.line, 0.5); g.lineWidth = 3; g.strokeRect(-150, -70, 300, 140);
    g.restore();
  }
  for (const pl of [...placeRects()].reverse()) {
    const kind = pl.twin ? pl.p.twinFloor ?? pl.p.floor : pl.p.floor;
    floorOf(g, kind, pl.r, rand, pl.twin);
  }
  square(g);
  for (const [x, y] of TREES) for (const p of [{ x, y }, turn({ x, y })]) {
    const inPark = (p.x < 900 && p.y > 3650 && p.y < 4650) || (p.x > 5100 && p.y > 1350 && p.y < 2350);
    if (!inPark) treeGrate(g, p.x, p.y);
  }
  for (const [x, y, n] of [[1380, 2250, 5], [2300, 3780, 4], [700, 2400, 4], [1400, 5800, 6]] as const) {
    bikeRack(g, x, y, n, rand);
    const t = turn({ x, y }); bikeRack(g, t.x - n * 34, t.y, n, rand);
  }
  // the station's big M roundel set into the paving, and the bus stop's waiting line
  for (const p of [{ x: 2075, y: 1780 }, turn({ x: 2075, y: 1780 })]) {
    disc(g, p.x, p.y, 54, hexA('#2f6ab8', 0.85), 2.4);
    g.strokeStyle = hexA(C.white, 0.85); g.lineWidth = 6; g.beginPath(); g.arc(p.x, p.y, 44, 0, TAU); g.stroke();
    letter(g, 'M', p.x, p.y + 2, 56, hexA(C.white, 0.9));
  }
  paintPlazaStories(g, rand);
  pads(g);
  // the rim of the world darkens so the city feels like it carries on past the edge
  const rim = 160;
  for (const [x0, y0, x1, y1, rx, ry, rw, rh] of [[0, 0, 0, rim, 0, 0, size, rim], [0, size, 0, size - rim, 0, size - rim, size, rim], [0, 0, rim, 0, 0, 0, rim, size], [size, 0, size - rim, 0, size - rim, 0, rim, size]] as const) {
    const grad = g.createLinearGradient(x0, y0, x1, y1);
    grad.addColorStop(0, 'rgba(12, 14, 20, 0.4)'); grad.addColorStop(1, 'rgba(12, 14, 20, 0)');
    g.fillStyle = grad; g.fillRect(rx, ry, rw, rh);
  }
  void shade;
}
