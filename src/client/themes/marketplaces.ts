/**
 * Night Market places painted into the baked floor: the Old Canal and its three bridges, the floors inside the halls and under the
 * canopies, Festival Square and the bus square with their markings, and the big stencilled names. Everything here is painted once
 * (paintMarketFloor), so none of it costs a frame. Each piece is authored for the west half and painted again at its half turn,
 * dressed for the district it lands in.
 */
import type { MapDef } from '../../shared/maps.ts';
import type { Pt } from '../../shared/geom.ts';
import { CANAL, CANOPIES, HALLS } from '../../shared/maps/marketgeo.ts';
import { seeded } from '../grain.ts';
import { districtAt, font, hash, hexA, OUTLINE, shade } from './marketkit.ts';

type G = CanvasRenderingContext2D;
type Box = { x0: number; y0: number; x1: number; y1: number };
const TAU = Math.PI * 2;

/** A west-half box and its half-turn twin. */
const both = (b: Box, size: number): Box[] => [b, { x0: size - b.x1, y0: size - b.y1, x1: size - b.x0, y1: size - b.y0 }];
const W = (b: Box) => b.x1 - b.x0, H = (b: Box) => b.y1 - b.y0;
const trace = (g: G, pts: readonly Pt[]) => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath(); };
const stencil = (g: G, t: string, x: number, y: number, size: number, col: string, rot = 0) => {
  g.save(); g.translate(x, y); g.rotate(rot); g.font = font(size); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = col; g.fillText(t, 0, 0); g.restore();
};

/* ------------------------------------------------------------------------------------------------- the canal */

function canal(g: G, map: MapDef) {
  const water = (map.polys ?? []).filter((p) => p.material === 'canal');
  // stone quay: a broad kerb all round each stretch of water, then the water itself, deep and still
  for (const p of water) { trace(g, p.points); g.strokeStyle = '#6e6a62'; g.lineWidth = 26; g.lineJoin = 'round'; g.stroke(); }
  for (const p of water) { trace(g, p.points); g.strokeStyle = '#8c877c'; g.lineWidth = 14; g.stroke(); }
  for (const p of water) {
    trace(g, p.points); g.strokeStyle = 'rgba(20,18,16,0.5)'; g.lineWidth = 2; g.stroke();
    // kerb joints
    g.save(); trace(g, p.points); g.lineWidth = 26; g.setLineDash([2, 34]); g.strokeStyle = 'rgba(30,28,24,0.45)'; g.stroke(); g.restore();
  }
  for (const p of water) {
    g.save(); trace(g, p.points); g.clip();
    const b = p.points.reduce((a, q) => ({ x0: Math.min(a.x0, q.x), y0: Math.min(a.y0, q.y), x1: Math.max(a.x1, q.x), y1: Math.max(a.y1, q.y) }), { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
    const gr = g.createLinearGradient(0, b.y0, 0, b.y1);
    gr.addColorStop(0, '#16303c'); gr.addColorStop(0.5, '#1d3d4a'); gr.addColorStop(1, '#122632');
    g.fillStyle = gr; g.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    const rand = seeded((hash(b.x0, b.y0) * 4294967296) >>> 0);
    // the quay's shadow on the water, ripples, and the lanterns of the far bank smeared across it
    g.fillStyle = 'rgba(5,10,14,0.45)'; g.fillRect(b.x0, b.y0, b.x1 - b.x0, 16);
    g.strokeStyle = 'rgba(160,210,230,0.16)'; g.lineWidth = 1.4;
    for (let k = 0; k < (b.x1 - b.x0) / 20; k++) { const x = b.x0 + rand() * (b.x1 - b.x0), y = b.y0 + 20 + rand() * (b.y1 - b.y0 - 30); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 10, y - 3, x + 22 + rand() * 18, y); g.stroke(); }
    for (let x = b.x0 + 40 + rand() * 60; x < b.x1 - 20; x += 90 + rand() * 90) {
      const d = districtAt(x, (b.y0 + b.y1) / 2), col = rand() < 0.5 ? d.lantern : d.neon;
      for (let k = 0; k < 4; k++) { g.fillStyle = hexA(col, 0.32 - k * 0.06); g.fillRect(x - 10 + k * 3 + Math.sin(k * 2) * 4, b.y0 + 22 + k * 22, 20 - k * 4, 6); }
    }
    // lily pads and a lotus or two where it widens into the basin
    for (let k = 0; k < (b.x1 - b.x0) / 140; k++) {
      const x = b.x0 + 30 + rand() * (b.x1 - b.x0 - 60), y = b.y0 + 30 + rand() * (b.y1 - b.y0 - 60), r = 9 + rand() * 7;
      g.fillStyle = '#3f6a3a'; g.beginPath(); g.arc(x, y, r, 0.3, TAU - 0.1); g.lineTo(x, y); g.closePath(); g.fill(); g.strokeStyle = 'rgba(10,20,10,0.6)'; g.lineWidth = 1; g.stroke();
      if (rand() < 0.3) { g.fillStyle = '#f2a6c4'; for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(x + Math.cos(i * 1.26) * 4, y + Math.sin(i * 1.26) * 4, 4, 2.4, i * 1.26, 0, TAU); g.fill(); } g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(x, y, 2, 0, TAU); g.fill(); }
    }
    // floating river lanterns
    for (let k = 0; k < (b.x1 - b.x0) / 220; k++) {
      const x = b.x0 + 40 + rand() * (b.x1 - b.x0 - 80), y = b.y0 + 40 + rand() * (b.y1 - b.y0 - 80);
      g.fillStyle = 'rgba(255,190,90,0.22)'; g.beginPath(); g.arc(x, y, 18, 0, TAU); g.fill();
      g.fillStyle = '#f4d58a'; g.fillRect(x - 5, y - 5, 10, 10); g.strokeStyle = OUTLINE; g.lineWidth = 1.2; g.strokeRect(x - 5, y - 5, 10, 10);
      g.fillStyle = '#ff9a3c'; g.beginPath(); g.arc(x, y, 2.4, 0, TAU); g.fill();
    }
    // a sampan moored in the basin, its lamp lit and nobody aboard
    if (p.id?.startsWith('canal-d')) {
      const cx = (b.x0 + b.x1) / 2 + 30, cy = (b.y0 + b.y1) / 2;
      g.save(); g.translate(cx, cy); g.rotate(p.id.endsWith('~') ? Math.PI + 0.2 : 0.2);
      g.fillStyle = 'rgba(5,10,14,0.4)'; g.beginPath(); g.ellipse(4, 6, 78, 22, 0, 0, TAU); g.fill();
      g.fillStyle = '#6a4a2a'; g.beginPath(); g.moveTo(-80, 0); g.quadraticCurveTo(-40, -24, 60, -18); g.lineTo(80, 0); g.lineTo(60, 18); g.quadraticCurveTo(-40, 24, -80, 0); g.closePath(); g.fill();
      g.strokeStyle = OUTLINE; g.lineWidth = 2; g.stroke();
      g.fillStyle = '#4a3220'; g.beginPath(); g.moveTo(-60, 0); g.quadraticCurveTo(-30, -14, 50, -10); g.lineTo(62, 0); g.lineTo(50, 10); g.quadraticCurveTo(-30, 14, -60, 0); g.closePath(); g.fill();
      g.fillStyle = '#8a7a5a'; g.beginPath(); g.ellipse(-6, 0, 26, 15, 0, 0, TAU); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(40,30,20,0.6)'; g.lineWidth = 1.2; for (let k = -20; k <= 10; k += 8) { g.beginPath(); g.moveTo(k, -14); g.lineTo(k, 14); g.stroke(); }
      g.fillStyle = 'rgba(255,170,80,0.35)'; g.beginPath(); g.arc(56, 0, 26, 0, TAU); g.fill();
      g.fillStyle = '#e5412d'; g.beginPath(); g.ellipse(56, 0, 6, 7, 0, 0, TAU); g.fill(); g.strokeStyle = OUTLINE; g.lineWidth = 1.2; g.stroke();
      g.strokeStyle = '#3a2a1a'; g.lineWidth = 3; g.beginPath(); g.moveTo(-70, 6); g.lineTo(-120, 30); g.stroke();
      g.restore();
    }
    g.restore();
  }
}

/** A bridge across the canal: a deck running north-south, its railings along the east and west edges. */
function bridge(g: G, b: Box, moon: boolean) {
  const x0 = b.x0, x1 = b.x1, y0 = b.y0 - 26, y1 = b.y1 + 26;
  const deck = moon ? '#9a3a2e' : '#7a5a3a';
  g.fillStyle = 'rgba(5,8,12,0.4)'; g.fillRect(x0 - 6, y0 + 10, x1 - x0 + 12, y1 - y0);
  g.fillStyle = deck; g.fillRect(x0, y0, x1 - x0, y1 - y0);
  // planks across, the hump of the arch lighter at the crown
  g.strokeStyle = 'rgba(20,10,6,0.45)'; g.lineWidth = 1.2; g.beginPath(); for (let y = y0 + 9; y < y1; y += 9) { g.moveTo(x0, y + 0.5); g.lineTo(x1, y + 0.5); } g.stroke();
  const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, 'rgba(0,0,0,0.25)'); gr.addColorStop(0.5, 'rgba(255,240,210,0.16)'); gr.addColorStop(1, 'rgba(0,0,0,0.25)');
  g.fillStyle = gr; g.fillRect(x0, y0, x1 - x0, y1 - y0);
  // railings with posts, and a lantern on each end post of the moon bridge
  for (const x of [x0 + 4, x1 - 4]) {
    g.fillStyle = moon ? '#c0392b' : '#5a3f28'; g.fillRect(x - 4, y0, 8, y1 - y0);
    g.strokeStyle = OUTLINE; g.lineWidth = 1.5; g.strokeRect(x - 4, y0, 8, y1 - y0);
    for (let y = y0; y <= y1; y += (y1 - y0) / 4) { g.fillStyle = moon ? '#e8b84a' : '#3a2a1a'; g.fillRect(x - 6, y - 4, 12, 8); g.strokeRect(x - 6, y - 4, 12, 8); }
    if (moon) for (const y of [y0, y1]) { g.fillStyle = 'rgba(255,120,70,0.3)'; g.beginPath(); g.arc(x, y, 22, 0, TAU); g.fill(); g.fillStyle = '#e5412d'; g.beginPath(); g.ellipse(x, y, 7, 8, 0, 0, TAU); g.fill(); g.stroke(); }
  }
  g.strokeStyle = OUTLINE; g.lineWidth = 2; g.strokeRect(x0, y0, x1 - x0, y1 - y0);
}

/* --------------------------------------------------------------------------------------------------- floors */

function boards(g: G, b: Box, col: string, rand: () => number) {
  g.fillStyle = col; g.fillRect(b.x0, b.y0, W(b), H(b));
  for (let y = b.y0; y < b.y1; y += 16) {
    g.fillStyle = `rgba(0,0,0,${(0.04 + rand() * 0.08).toFixed(3)})`; g.fillRect(b.x0, y, W(b), 16);
    g.fillStyle = 'rgba(20,10,4,0.45)'; g.fillRect(b.x0, y, W(b), 1.2);
    for (let x = b.x0 + rand() * 120; x < b.x1; x += 90 + rand() * 90) g.fillRect(x, y, 1.2, 16);
  }
}
function tilesFloor(g: G, b: Box, a: string, c: string, step: number) {
  for (let y = b.y0, j = 0; y < b.y1; y += step, j++) for (let x = b.x0, i = 0; x < b.x1; x += step, i++) { g.fillStyle = (i + j) % 2 ? a : c; g.fillRect(x, y, step, step); }
  g.strokeStyle = 'rgba(10,10,14,0.3)'; g.lineWidth = 1; g.beginPath();
  for (let y = b.y0; y <= b.y1; y += step) { g.moveTo(b.x0, y + 0.5); g.lineTo(b.x1, y + 0.5); }
  for (let x = b.x0; x <= b.x1; x += step) { g.moveTo(x + 0.5, b.y0); g.lineTo(x + 0.5, b.y1); }
  g.stroke();
}

function hallFloor(g: G, kind: keyof typeof HALLS, b: Box) {
  const rand = seeded((hash(b.x0 + 3, b.y0 + 9) * 4294967296) >>> 0);
  const d = districtAt((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2);
  const inner = { x0: b.x0 + 50, y0: b.y0 + 50, x1: b.x1 - 50, y1: b.y1 - 50 };
  switch (kind) {
    case 'temple': {
      if (d.id === 'temple') {
        boards(g, inner, '#6a3a2a', rand);
        // a long red runner from the porch to the altar, and prayer cushions either side
        const cx = (inner.x0 + inner.x1) / 2;
        g.fillStyle = '#9a2a24'; g.fillRect(cx - 45, inner.y0 + 40, 90, H(inner) - 40); g.fillStyle = '#e8b84a'; g.fillRect(cx - 45, inner.y0 + 40, 6, H(inner) - 40); g.fillRect(cx + 39, inner.y0 + 40, 6, H(inner) - 40);
        for (let r = 0; r < 3; r++) for (const s of [-1, 1]) for (let k = 0; k < 2; k++) { g.fillStyle = '#c9a24a'; g.beginPath(); g.arc(cx + s * (90 + k * 50), inner.y0 + 150 + r * 60, 13, 0, TAU); g.fill(); g.strokeStyle = OUTLINE; g.lineWidth = 1.2; g.stroke(); }
      } else {
        boards(g, inner, '#5a4232', rand);
        // long beer tables with benches
        for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) {
          const x = inner.x0 + 50 + c * 260, y = inner.y0 + 50 + r * 110;
          g.fillStyle = '#8a6a42'; g.fillRect(x, y, 180, 30); g.fillStyle = '#6a4a2a'; g.fillRect(x, y - 16, 180, 9); g.fillRect(x, y + 37, 180, 9);
          g.strokeStyle = OUTLINE; g.lineWidth = 1.4; g.strokeRect(x, y, 180, 30);
          for (let k = 0; k < 5; k++) { g.fillStyle = '#e8a93a'; g.beginPath(); g.arc(x + 20 + k * 35, y + 15, 5, 0, TAU); g.fill(); }
        }
      }
      break;
    }
    case 'bazaar': tilesFloor(g, inner, '#7a4a3a', '#8a5a44', 50); break;
    case 'parking': {
      g.fillStyle = '#4c4e52'; g.fillRect(inner.x0, inner.y0, W(inner), H(inner));
      g.fillStyle = 'rgba(10,10,14,0.22)'; for (let k = 0; k < 40; k++) { g.beginPath(); g.ellipse(inner.x0 + rand() * W(inner), inner.y0 + rand() * H(inner), 12 + rand() * 26, 6 + rand() * 10, rand() * 3, 0, TAU); g.fill(); }
      // bays along the walls, a drive arrow, the ramp up in the middle
      g.strokeStyle = 'rgba(240,236,220,0.55)'; g.lineWidth = 3;
      for (let x = inner.x0 + 20; x < inner.x1 - 20; x += 70) { g.beginPath(); g.moveTo(x, inner.y0); g.lineTo(x, inner.y0 + 110); g.stroke(); }
      const rx = inner.x0 + W(inner) / 2 - 60, ry = inner.y0 + 160;
      g.fillStyle = '#5c5e62'; g.fillRect(rx, ry, 120, H(inner) - 220);
      g.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = ry; y < ry + H(inner) - 220; y += 22) g.fillRect(rx, y, 120, 8);
      g.strokeStyle = '#e8c23a'; g.lineWidth = 4; g.strokeRect(rx, ry, 120, H(inner) - 220);
      stencil(g, 'UP', rx + 60, ry + 40, 28, 'rgba(240,236,220,0.7)');
      stencil(g, d.id === 'fish' ? 'ICE TRUCKS' : 'PARKING', inner.x0 + W(inner) / 2, inner.y1 - 40, 34, 'rgba(240,236,220,0.35)');
      break;
    }
    case 'arcade': {
      if (d.id === 'fish') { tilesFloor(g, inner, '#7f9aa4', '#8ea8b2', 25); g.fillStyle = 'rgba(200,230,240,0.15)'; for (let k = 0; k < 30; k++) { g.beginPath(); g.ellipse(inner.x0 + rand() * W(inner), inner.y0 + rand() * H(inner), 20 + rand() * 30, 8 + rand() * 10, 0, 0, TAU); g.fill(); } break; }
      g.fillStyle = '#1f2540'; g.fillRect(inner.x0, inner.y0, W(inner), H(inner));
      // the carpet every arcade has: confetti of neon shapes
      for (let k = 0; k < W(inner) * H(inner) / 900; k++) {
        const x = inner.x0 + rand() * W(inner), y = inner.y0 + rand() * H(inner), c = ['#3fe0e0', '#ff4fd0', '#ffd34d', '#9be36a'][Math.floor(rand() * 4)]!;
        g.fillStyle = hexA(c, 0.5);
        const s = rand();
        if (s < 0.33) { g.beginPath(); g.arc(x, y, 3, 0, TAU); g.fill(); } else if (s < 0.66) g.fillRect(x - 3, y - 1, 7, 2.5); else { g.beginPath(); g.moveTo(x, y - 4); g.lineTo(x + 4, y + 3); g.lineTo(x - 4, y + 3); g.closePath(); g.fill(); }
      }
      break;
    }
  }
}

/* ---------------------------------------------------------------------------------------------- the squares */

/** Festival Square around zone A (and its twin round zone C): a ring of red and gold paving, lanterns painted on, a big stencilled name. */
function festival(g: G, b: Box, zone: Pt, temple: boolean) {
  const a = temple ? '#7a3a30' : '#6a4a3a', c = temple ? '#c9a24a' : '#b8683a';
  g.fillStyle = 'rgba(255,240,210,0.05)'; g.fillRect(b.x0, b.y0, W(b), H(b));
  g.strokeStyle = hexA(c, 0.35); g.lineWidth = 6; g.strokeRect(b.x0 + 20, b.y0 + 20, W(b) - 40, H(b) - 40);
  for (const [r, col, lw] of [[330, a, 26], [300, c, 6], [250, a, 4], [210, c, 10]] as const) { g.strokeStyle = hexA(col, 0.55); g.lineWidth = lw; g.beginPath(); g.arc(zone.x, zone.y, r, 0, TAU); g.stroke(); }
  for (let k = 0; k < 16; k++) { const t = (k / 16) * TAU; g.fillStyle = hexA(k % 2 ? c : a, 0.5); g.beginPath(); g.moveTo(zone.x + Math.cos(t) * 216, zone.y + Math.sin(t) * 216); g.lineTo(zone.x + Math.cos(t + 0.12) * 296, zone.y + Math.sin(t + 0.12) * 296); g.lineTo(zone.x + Math.cos(t - 0.12) * 296, zone.y + Math.sin(t - 0.12) * 296); g.closePath(); g.fill(); }
  stencil(g, temple ? 'FESTIVAL SQUARE' : 'FOOD COURT SQUARE', zone.x, zone.y + (zone.y < 3000 ? 380 : -380), 40, 'rgba(250,236,200,0.28)');
}

/** The bus square in arcade row (a bus bay, a zebra, the word BUS); its twin in the fish market is the loading yard. */
function busSquare(g: G, b: Box) {
  const d = districtAt((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2);
  const bus = d.id !== 'fish';
  g.fillStyle = 'rgba(14,14,18,0.12)'; g.fillRect(b.x0, b.y0, W(b), H(b));
  const yb = bus ? b.y0 + 160 : b.y1 - 260;
  g.strokeStyle = 'rgba(232,194,58,0.75)'; g.lineWidth = 5; g.setLineDash([24, 14]); g.strokeRect(b.x0 + 80, yb, W(b) - 160, 100); g.setLineDash([]);
  stencil(g, bus ? 'BUS STOP' : 'LOADING ONLY', (b.x0 + b.x1) / 2, yb + 50, 40, 'rgba(232,194,58,0.6)');
  g.fillStyle = 'rgba(240,236,220,0.22)';
  const zy = bus ? b.y1 - 120 : b.y0 + 40;
  for (let x = b.x0 + 60; x < b.x1 - 60; x += 44) g.fillRect(x, zy, 26, 80);
  stencil(g, bus ? 'NIGHT BUS SQUARE' : 'FISH AUCTION YARD', (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2 + 30, 34, 'rgba(250,236,200,0.22)');
  if (!bus) for (let k = 0; k < 6; k++) stencil(g, `LOT ${k + 1}`, b.x0 + 120 + (k % 3) * 220, b.y0 + 200 + Math.floor(k / 3) * 120, 22, 'rgba(240,236,220,0.3)');
}

/** The temple's forecourt: flagstones in a grid, a stone path from the gate to the porch. */
function forecourt(g: G, b: Box, path: Box) {
  g.strokeStyle = 'rgba(30,26,22,0.4)'; g.lineWidth = 2; g.beginPath();
  for (let y = b.y0; y <= b.y1; y += 75) { g.moveTo(b.x0, y); g.lineTo(b.x1, y); }
  for (let x = b.x0; x <= b.x1; x += 75) { g.moveTo(x, b.y0); g.lineTo(x, b.y1); }
  g.stroke();
  g.fillStyle = 'rgba(210,200,180,0.16)'; g.fillRect(path.x0, path.y0, W(path), H(path));
  g.strokeStyle = 'rgba(30,26,22,0.5)'; g.lineWidth = 1.5; for (let y = path.y0; y < path.y1; y += 40) { g.beginPath(); g.moveTo(path.x0, y); g.lineTo(path.x1, y); g.stroke(); }
}

export function paintPlaces(g: G, size: number, map: MapDef) {
  const turn = (b: Box): Box => ({ x0: size - b.x1, y0: size - b.y1, x1: size - b.x0, y1: size - b.y0 });
  for (const [kind, b] of Object.entries(HALLS) as [keyof typeof HALLS, Box][]) for (const bb of both(b, size)) hallFloor(g, kind, bb);
  for (const b of both(CANOPIES.produce, size)) { g.fillStyle = 'rgba(200,170,110,0.08)'; g.fillRect(b.x0, b.y0, W(b), H(b)); }
  const zA = map.zones[0]!, zC = map.zones[2]!;
  festival(g, { x0: 1050, y0: 1050, x1: 1850, y1: 1800 }, zA, true);
  festival(g, turn({ x0: 1050, y0: 1050, x1: 1850, y1: 1800 }), zC, false);
  for (const b of both({ x0: 1150, y0: 4300, x1: 1950, y1: 4950 }, size)) busSquare(g, b);
  forecourt(g, { x0: 150, y0: 650, x1: 1000, y1: 1100 }, { x0: 475, y0: 650, x1: 625, y1: 1100 });
  forecourt(g, turn({ x0: 150, y0: 650, x1: 1000, y1: 1100 }), turn({ x0: 475, y0: 650, x1: 625, y1: 1100 }));
  canal(g, map);
  for (const [i, b] of CANAL.bridges.entries()) for (const bb of both(b, size)) bridge(g, bb, i === 1);
  stencil(g, 'OLD CANAL', 900, 2235, 30, 'rgba(220,235,240,0.25)');
  stencil(g, 'OLD CANAL', size - 900, size - 2235, 30, 'rgba(220,235,240,0.25)');
  void shade;
}
