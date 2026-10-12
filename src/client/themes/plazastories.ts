import { C, INK, TAU, box, disc, hexA, letter, shade, turn } from './plazakit.ts';

/**
 * The little stories painted into the Plaza's floor, each a few strokes in the chalky hand of the rest: a stick-figure family drawn
 * on the square by a kid, hopscotch in the park, a dropped ice cream and the stick figure who cried over it, pigeons and the man who
 * feeds them, boot prints across wet concrete that end in a scratched heart, a busker's chalk sun and his hat, the cat in the alley,
 * a picnic someone left, a lunch box on the site, the cafe's chalkboard. Each sits at the margins, never on a lane or a zone, and
 * the east half gets the same spots turned, told a little differently.
 */
type G = CanvasRenderingContext2D;
const CHALK = 'rgba(244, 240, 228, 0.78)';
const at = (g: G, x: number, y: number, rot: number, paint: () => void) => { g.save(); g.translate(x, y); g.rotate(rot); paint(); g.restore(); };
const stroke = (g: G, col: string, w: number, path: () => void) => { g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); path(); g.stroke(); };

/** A chalk stick figure: head, body, arms (raised or down), legs; `s` scales it. */
function stick(g: G, x: number, y: number, s: number, col: string, arms: 'up' | 'out' | 'down' = 'out', mood: 'smile' | 'sad' = 'smile') {
  stroke(g, col, 3 * Math.min(1.4, s), () => {
    g.arc(x, y - 22 * s, 8 * s, 0, TAU);
    g.moveTo(x, y - 14 * s); g.lineTo(x, y + 6 * s);
    g.moveTo(x, y + 6 * s); g.lineTo(x - 8 * s, y + 22 * s); g.moveTo(x, y + 6 * s); g.lineTo(x + 8 * s, y + 22 * s);
    const ay = arms === 'up' ? -16 : arms === 'out' ? -6 : 4;
    g.moveTo(x - 12 * s, y + (ay - 4) * s); g.lineTo(x, y - 8 * s); g.lineTo(x + 12 * s, y + (ay - 4) * s);
  });
  stroke(g, col, 1.6, () => {
    if (mood === 'smile') g.arc(x, y - 22 * s, 4 * s, 0.3, Math.PI - 0.3); else g.arc(x, y - 17 * s, 4 * s, Math.PI + 0.3, -0.3);
  });
}

function familyDrawing(g: G, x: number, y: number, twin: boolean) {
  // the sun with its rays, a house with a crooked chimney, three figures holding hands, and the artist's name
  stroke(g, 'rgba(255, 214, 90, 0.85)', 3, () => { g.arc(x - 70, y - 70, 18, 0, TAU); for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; g.moveTo(x - 70 + Math.cos(a) * 24, y - 70 + Math.sin(a) * 24); g.lineTo(x - 70 + Math.cos(a) * 34, y - 70 + Math.sin(a) * 34); } });
  stroke(g, CHALK, 3, () => { g.rect(x + 40, y - 40, 60, 50); g.moveTo(x + 34, y - 40); g.lineTo(x + 70, y - 72); g.lineTo(x + 106, y - 40); g.moveTo(x + 86, y - 58); g.lineTo(x + 86, y - 74); g.lineTo(x + 94, y - 72); g.lineTo(x + 94, y - 52); g.rect(x + 62, y - 10, 14, 20); });
  stick(g, x - 50, y, 1.2, 'rgba(140, 200, 255, 0.85)');
  stick(g, x - 20, y + 6, 0.8, 'rgba(255, 150, 190, 0.85)', 'up');
  stick(g, x + 8, y, 1.2, CHALK);
  stroke(g, CHALK, 2, () => { g.moveTo(x - 38, y - 9); g.lineTo(x - 30, y - 6); g.moveTo(x - 10, y - 6); g.lineTo(x - 4, y - 9); });
  if (twin) stroke(g, 'rgba(120, 220, 120, 0.8)', 3, () => { g.ellipse(x - 90, y + 10, 14, 9, 0, 0, TAU); g.moveTo(x - 76, y + 10); g.lineTo(x - 68, y + 4); g.moveTo(x - 100, y + 18); g.lineTo(x - 100, y + 24); g.moveTo(x - 82, y + 18); g.lineTo(x - 82, y + 24); });
  letter(g, twin ? 'ME + MY DOG' : 'MY FAMLY', x + 10, y + 50, 16, CHALK, { weight: 700, rot: -0.05 });
}

function hopscotch(g: G, x: number, y: number) {
  const cells: [number, number, string][] = [[0, 0, '1'], [0, -44, '2'], [-22, -88, '3'], [22, -88, '4'], [0, -132, '5'], [-22, -176, '6'], [22, -176, '7'], [0, -220, '8']];
  for (const [dx, dy, n] of cells) { stroke(g, CHALK, 3, () => g.rect(x + dx - 22, y + dy - 22, 44, 44)); letter(g, n, x + dx, y + dy, 18, CHALK, { weight: 700 }); }
  stroke(g, CHALK, 3, () => g.arc(x, y - 264, 22, Math.PI, 0));
  disc(g, x + 18, y - 120, 6, '#8a8e94', 1.2);
}

function iceCream(g: G, x: number, y: number, twin: boolean) {
  g.fillStyle = 'rgba(255, 200, 220, 0.75)'; g.beginPath(); g.ellipse(x, y, 22, 14, 0.3, 0, TAU); g.fill();
  disc(g, x - 4, y - 2, 10, twin ? '#8a5a3a' : '#f4b8c8', 1.6);
  g.fillStyle = '#d8a050'; g.beginPath(); g.moveTo(x + 6, y + 2); g.lineTo(x + 36, y + 14); g.lineTo(x + 8, y + 12); g.closePath(); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.4; g.stroke();
  stick(g, x - 50, y - 6, 0.9, CHALK, 'down', 'sad');
  stroke(g, 'rgba(140, 200, 255, 0.85)', 2, () => { g.moveTo(x - 54, y - 24); g.lineTo(x - 56, y - 16); g.moveTo(x - 46, y - 24); g.lineTo(x - 44, y - 16); });
}

function pigeons(g: G, x: number, y: number) {
  stick(g, x, y, 1.1, CHALK, 'out');
  g.fillStyle = 'rgba(230, 210, 160, 0.8)'; for (let i = 0; i < 24; i++) g.fillRect(x + 30 + Math.cos(i * 2.4) * (12 + i * 2), y + Math.sin(i * 2.4) * (8 + i), 2.5, 2.5);
  for (let i = 0; i < 7; i++) {
    const px = x + 40 + Math.cos(i * 1.7) * (30 + i * 6), py = y + Math.sin(i * 1.7) * (20 + i * 4), a = i * 1.3;
    at(g, px, py, a, () => {
      shade(g, 0, 0, 10, 6, 0.25);
      g.fillStyle = i % 3 ? '#8a8e98' : '#a8acb4'; g.beginPath(); g.ellipse(0, 0, 10, 6, 0, 0, TAU); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.3; g.stroke();
      disc(g, 9, 0, 4, '#6a7a78', 1); g.fillStyle = '#e8a03a'; g.fillRect(12, -1, 4, 2);
      g.fillStyle = '#5a5e68'; g.beginPath(); g.moveTo(-8, 0); g.lineTo(-15, -4); g.lineTo(-15, 4); g.closePath(); g.fill();
    });
  }
}

function bootPrints(g: G, x0: number, y0: number, x1: number, y1: number, twin: boolean) {
  const n = 12;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t + (i % 2 ? 9 : -9), a = Math.atan2(y1 - y0, x1 - x0);
    at(g, x, y, a, () => { g.fillStyle = 'rgba(60, 60, 56, 0.45)'; g.beginPath(); g.ellipse(0, 0, 13, 6, 0, 0, TAU); g.fill(); g.fillRect(-16, -4, 6, 8); });
  }
  stroke(g, 'rgba(50, 50, 46, 0.6)', 2.5, () => { const x = x1 + 30, y = y1; g.moveTo(x, y + 14); g.bezierCurveTo(x - 26, y - 6, x - 10, y - 22, x, y - 8); g.bezierCurveTo(x + 10, y - 22, x + 26, y - 6, x, y + 14); });
  letter(g, twin ? 'A + K' : 'J + M', x1 + 30, y1 + 32, 14, 'rgba(50, 50, 46, 0.6)', { weight: 700 });
}

function busker(g: G, x: number, y: number, twin: boolean) {
  // a big chalk sun mural (a rainbow on the other side) with the hat for coins in front of it
  if (!twin) {
    for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; stroke(g, `hsla(${40 + k * 4}, 90%, 65%, 0.7)`, 8, () => { g.moveTo(x + Math.cos(a) * 60, y + Math.sin(a) * 60); g.lineTo(x + Math.cos(a) * 100, y + Math.sin(a) * 100); }); }
    g.fillStyle = 'rgba(255, 210, 90, 0.7)'; g.beginPath(); g.arc(x, y, 52, 0, TAU); g.fill();
    stroke(g, 'rgba(120, 70, 20, 0.8)', 3, () => { g.arc(x - 16, y - 10, 5, 0, TAU); g.moveTo(x + 21, y - 10); g.arc(x + 16, y - 10, 5, 0, TAU); g.moveTo(x + 22, y + 10); g.arc(x, y + 10, 22, 0.2, Math.PI - 0.2); });
  } else {
    ['#e85a5a', '#e8a03a', '#e8d84a', '#6ac85a', '#4a8ae8', '#8a5ae8'].forEach((col, k) => stroke(g, hexA(col, 0.7), 10, () => g.arc(x, y + 40, 100 - k * 11, Math.PI, 0)));
  }
  const hx = x, hy = y + 120;
  shade(g, hx, hy, 24, 12); g.fillStyle = '#2a2a30'; g.beginPath(); g.ellipse(hx, hy, 24, 14, 0, 0, TAU); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.6; g.stroke();
  g.fillStyle = '#4a3a5a'; g.beginPath(); g.ellipse(hx, hy, 15, 8, 0, 0, TAU); g.fill();
  for (let i = 0; i < 6; i++) disc(g, hx - 8 + (i % 3) * 7, hy - 3 + Math.floor(i / 3) * 6, 2.2, '#d8b04a', 0);
  letter(g, 'THANK YOU!', x, y + 152, 14, CHALK, { weight: 700 });
}

function alleyCat(g: G, x: number, y: number, twin: boolean) {
  // two dumpsters, a fish skeleton, and the cat that owns the alley (or its ginger cousin)
  for (const [dx, col] of [[0, twin ? '#2f6a4a' : '#2f4a7a'], [130, '#6a6e74']] as const) { shade(g, x + dx + 55, y + 36, 60, 34); box(g, x + dx, y, 110, 70, col, 2); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x + dx + 4, y + 4, 102, 6); g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + dx + 55, y); g.lineTo(x + dx + 55, y + 70); g.stroke(); }
  const cx = x + 280, cy = y + 50;
  stroke(g, CHALK, 2, () => { g.moveTo(cx - 40, cy + 20); g.lineTo(cx - 20, cy + 20); for (let k = 0; k < 4; k++) { g.moveTo(cx - 36 + k * 5, cy + 14); g.lineTo(cx - 36 + k * 5, cy + 26); } g.moveTo(cx - 20, cy + 20); g.lineTo(cx - 12, cy + 14); g.lineTo(cx - 12, cy + 26); g.closePath(); });
  const fur = twin ? '#d8883a' : '#2a2a2e';
  shade(g, cx, cy, 16, 9);
  g.fillStyle = fur; g.beginPath(); g.ellipse(cx, cy, 16, 10, 0, 0, TAU); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.6; g.stroke();
  disc(g, cx + 14, cy - 6, 8, fur, 1.4);
  g.fillStyle = fur; g.beginPath(); g.moveTo(cx + 9, cy - 11); g.lineTo(cx + 11, cy - 19); g.lineTo(cx + 15, cy - 13); g.moveTo(cx + 16, cy - 13); g.lineTo(cx + 20, cy - 19); g.lineTo(cx + 21, cy - 10); g.fill();
  stroke(g, fur, 3, () => { g.moveTo(cx - 15, cy); g.quadraticCurveTo(cx - 30, cy - 4, cx - 26, cy - 18); });
  disc(g, cx + 12, cy - 7, 1.4, '#e8e84a', 0); disc(g, cx + 17, cy - 7, 1.4, '#e8e84a', 0);
  letter(g, twin ? 'TINWAR' : 'NO PARKING', x + 120, y - 30, 26, hexA(twin ? '#ff5aa0' : '#e8c84a', 0.55), { rot: -0.08 });
}

function picnic(g: G, x: number, y: number, twin: boolean) {
  at(g, x, y, 0.2, () => {
    g.fillStyle = twin ? '#3a6ab0' : '#c8433a'; g.fillRect(-60, -40, 120, 80);
    g.fillStyle = 'rgba(255,255,255,0.75)'; for (let k = -60; k < 60; k += 20) { g.fillRect(k, -40, 10, 80); } for (let k = -40; k < 40; k += 20) g.fillRect(-60, k, 120, 10);
    g.strokeStyle = INK; g.lineWidth = 1.6; g.strokeRect(-60, -40, 120, 80);
    box(g, 14, -20, 34, 26, '#b08350', 1.4); g.strokeStyle = INK; g.beginPath(); g.arc(31, -20, 12, Math.PI, 0); g.stroke();
    disc(g, -26, 6, 9, C.white, 1.2); disc(g, -26, 6, 5, '#e85a5a', 0); disc(g, -6, 16, 6, '#e8c84a', 1); disc(g, -36, -18, 5, '#6ac85a', 1);
  });
}

function siteLunch(g: G, x: number, y: number) {
  // a hard hat, a lunch box with a sandwich, and the safety board's stick figure lifting a box the right way
  disc(g, x, y, 15, C.yellow, 1.8); g.fillStyle = C.yellowLo; g.fillRect(x - 17, y + 6, 34, 4);
  box(g, x + 30, y - 12, 34, 24, '#c84a3a', 1.4); g.fillStyle = '#e8c87a'; g.beginPath(); g.moveTo(x + 70, y + 10); g.lineTo(x + 92, y + 10); g.lineTo(x + 81, y - 6); g.closePath(); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.2; g.stroke();
  // cement bags stacked by the cabin
  for (let i = 0; i < 4; i++) box(g, x - 80 + (i % 2) * 44, y - 30 + Math.floor(i / 2) * 26, 40, 22, '#c8c0a8', 1.4);
  box(g, x + 110, y - 50, 90, 70, C.white, 1.8);
  letter(g, 'SAFETY FIRST', x + 155, y - 38, 11, '#c83a2a', { weight: 800 });
  stick(g, x + 140, y + 4, 0.7, INK, 'down');
  g.fillStyle = '#b08350'; g.fillRect(x + 150, y - 2, 16, 12);
  stroke(g, '#3ac85a', 2.4, () => { g.moveTo(x + 172, y + 4); g.lineTo(x + 178, y + 10); g.lineTo(x + 190, y - 6); });
}

function chalkboard(g: G, x: number, y: number, twin: boolean) {
  shade(g, x, y + 4, 34, 18);
  box(g, x - 32, y - 22, 64, 44, '#2a3a32', 2);
  g.strokeStyle = '#8a6a44'; g.lineWidth = 3; g.strokeRect(x - 32, y - 22, 64, 44);
  letter(g, twin ? 'PASTA' : 'FLAT WHITE', x, y - 9, 10, CHALK, { weight: 700, spacing: 1 });
  letter(g, twin ? '9.50' : '3.50', x, y + 8, 13, 'rgba(255, 200, 120, 0.9)', { weight: 800 });
}

function queue(g: G, x: number, y: number) {
  letter(g, 'PLEASE QUEUE HERE', x, y, 18, hexA(C.lineYellow, 0.7), { rot: -Math.PI / 2 });
  for (let i = 0; i < 4; i++) { const fy = y + 130 + i * 60; g.fillStyle = hexA(C.lineYellow, 0.55); for (const dx of [-8, 8]) { g.beginPath(); g.ellipse(x + dx, fy, 5, 11, 0, 0, TAU); g.fill(); } }
}

function garageNote(g: G, x: number, y: number, twin: boolean) {
  for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(20, 18, 20, 0.35)'; g.beginPath(); g.ellipse(x + i * 22 - 40, y + (i % 2) * 18, 26, 12, 0.3, 0, TAU); g.fill(); }
  letter(g, twin ? 'RESERVED: MAYOR' : 'COMPACT CARS ONLY', x, y + 60, 18, hexA(C.line, 0.6), { spacing: 3 });
}

const STORIES: readonly [(g: G, x: number, y: number, twin: boolean) => void, number, number][] = [
  [familyDrawing, 2640, 3260],
  [(g, x, y) => hopscotch(g, x, y), 620, 4000],
  [iceCream, 2560, 3780],
  [(g, x, y) => pigeons(g, x, y), 2540, 2720],
  [busker, 1470, 1860],
  [alleyCat, 450, 5790],
  [picnic, 230, 4230],
  [(g, x, y) => siteLunch(g, x, y), 2370, 270],
  [chalkboard, 2240, 2180],
  [(g, x, y) => queue(g, x, y), 600, 2450],
  [garageNote, 1000, 420],
];

export function paintPlazaStories(g: G, rand: () => number) {
  for (const [paint, x, y] of STORIES) {
    paint(g, x, y, false);
    const t = turn({ x, y });
    paint(g, t.x, t.y, true);
  }
  // the site's boot prints across the slab that was poured yesterday
  bootPrints(g, 1560, 560, 2050, 420, false);
  const a = turn({ x: 1560, y: 560 }), b = turn({ x: 2050, y: 420 });
  bootPrints(g, a.x, a.y, b.x, b.y, true);
  // litter the wind leaves in the corners: receipts, a newspaper, cigarette ends
  for (let i = 0; i < 160; i++) {
    const x = rand() * 6000, y = rand() * 6000;
    g.fillStyle = rand() < 0.3 ? 'rgba(240, 236, 224, 0.6)' : 'rgba(220, 200, 160, 0.5)';
    g.save(); g.translate(x, y); g.rotate(rand() * TAU); g.fillRect(-5, -3, rand() < 0.1 ? 26 : 10, rand() < 0.1 ? 18 : 6); g.restore();
  }
}
