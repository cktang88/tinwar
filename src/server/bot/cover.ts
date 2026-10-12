import { WORLD } from '../../shared/defs.ts';
import type { MapDoor } from '../../shared/geom.ts';
import type { Rect } from '../../shared/sim/movement.ts';
import { clearShot, isOpen, type NavGrid, type Point } from './nav.ts';

type CoverPoint = { x: number; y: number; shieldedBearings: number };

export type CoverIndex = { bucket: number; n: number; cells: CoverPoint[][] };

const BEARINGS = 16;
const STANDOFF = 6;
/** Extra standoffs tried, in turn, for a cover point whose nav cell is closed (see `coverIndex`). */
const STANDOFF_TRIES = [0, 8, 16] as const;
const SPACING = 50;
const SHIELD_PX = 90;
const BUCKET_PX = 250;
const TAKEN_PX = 60;
const PEEK_STEPS = [40, 65, 90] as const;

export const bearingIndex = (from: Point, to: Point) => {
  const a = Math.atan2(to.y - from.y, to.x - from.x);
  return ((Math.round((a / (2 * Math.PI)) * BEARINGS) % BEARINGS) + BEARINGS) % BEARINGS;
};

/** A doorway is no place to stand: a bot there blocks the way and is shot from both rooms. */
const DOORWAY_PX = 110;
const inDoorway = (doors: readonly MapDoor[], p: Point) => doors.some((d) => {
  const ex = d.axis === 'h' ? d.w : 0, ey = d.axis === 'v' ? d.w : 0;
  const t = Math.max(0, Math.min(1, ((p.x - d.x) * ex + (p.y - d.y) * ey) / (d.w * d.w)));
  return Math.hypot(p.x - (d.x + ex * t), p.y - (d.y + ey * t)) < DOORWAY_PX;
});

/** The lines cover points are laid along: a box's four sides, or a polygon part's own edges, pushed out by `off`. */
function offsetEdges(r: Rect, off: number): [Point, Point][] {
  if (r.pts) {
    const out: [Point, Point][] = [];
    const n = r.pts.length / 2;
    for (let i = 0; i < n; i++) {
      const ax = r.pts[2 * i]!, ay = r.pts[2 * i + 1]!, bx = r.pts[2 * ((i + 1) % n)]!, by = r.pts[2 * ((i + 1) % n) + 1]!;
      const len = Math.hypot(bx - ax, by - ay);
      if (len < 1) continue;
      const nx = ((by - ay) / len) * off, ny = (-(bx - ax) / len) * off;
      out.push([{ x: ax + nx, y: ay + ny }, { x: bx + nx, y: by + ny }]);
    }
    return out;
  }
  return [
    [{ x: r.x, y: r.y - off }, { x: r.x + r.w, y: r.y - off }],
    [{ x: r.x, y: r.y + r.h + off }, { x: r.x + r.w, y: r.y + r.h + off }],
    [{ x: r.x - off, y: r.y }, { x: r.x - off, y: r.y + r.h }],
    [{ x: r.x + r.w + off, y: r.y }, { x: r.x + r.w + off, y: r.y + r.h }],
  ];
}

export function coverIndex(nav: NavGrid, cover: readonly Rect[], radius: number, doors: readonly MapDoor[] = []): CoverIndex {
  const n = Math.ceil(nav.size / BUCKET_PX);
  const cells: CoverPoint[][] = Array.from({ length: n * n }, () => []);
  const off = radius + STANDOFF;
  for (const r of cover) {
    // A point whose nav cell the wall's clearance closes (the grid is coarser than the standoff) is stood a little further out instead.
    const lines = STANDOFF_TRIES.map((extra) => offsetEdges(r, off + extra));
    lines[0]!.forEach(([a, b], j) => {
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const count = Math.max(1, Math.round(len / SPACING));
      for (let i = 0; i <= count; i++) {
        const at = (k: number) => { const [a2, b2] = lines[k]![j]!; return { x: a2.x + ((b2.x - a2.x) * i) / count, y: a2.y + ((b2.y - a2.y) * i) / count }; };
        const k = STANDOFF_TRIES.findIndex((_, k) => isOpen(nav, at(k)));
        if (k < 0) continue;
        const p = at(k);
        if (doors.length && inDoorway(doors, p)) continue;
        // A ray SHIELD_PX long can only meet what lies within SHIELD_PX, and `clearShot` finds that through the walls' grid.
        let shieldedBearings = 0;
        for (let k = 0; k < BEARINGS; k++) {
          const t = (2 * Math.PI * k) / BEARINGS;
          if (!clearShot(cover, p, { x: p.x + Math.cos(t) * SHIELD_PX, y: p.y + Math.sin(t) * SHIELD_PX })) shieldedBearings |= 1 << k;
        }
        if (shieldedBearings === 0) continue;
        const bx = Math.min(n - 1, Math.floor(p.x / BUCKET_PX)), by = Math.min(n - 1, Math.floor(p.y / BUCKET_PX));
        cells[by * n + bx]!.push({ ...p, shieldedBearings });
      }
    });
  }
  return { bucket: BUCKET_PX, n, cells };
}

/** Cover points within `within` px of `at`, with the bearings each one shields (see `bearingIndex`). Polygon walls and rects alike. */
export const coverPointsNear = (index: CoverIndex, at: Point, within: number): CoverPoint[] => coverNear(index, at, within);

export function coverNear(index: CoverIndex, at: Point, within: number): CoverPoint[] {
  const out: CoverPoint[] = [];
  const x0 = Math.max(0, Math.floor((at.x - within) / index.bucket)), x1 = Math.min(index.n - 1, Math.floor((at.x + within) / index.bucket));
  const y0 = Math.max(0, Math.floor((at.y - within) / index.bucket)), y1 = Math.min(index.n - 1, Math.floor((at.y + within) / index.bucket));
  for (let by = y0; by <= y1; by++) {
    for (let bx = x0; bx <= x1; bx++) {
      for (const c of index.cells[by * index.n + bx]!) if (Math.hypot(c.x - at.x, c.y - at.y) <= within) out.push(c);
    }
  }
  return out;
}

/**
 * A sliver more than a body's radius (a round hits anywhere within it): a spot is cover only when the whole body, and this much round it,
 * is out of a shooter's line (a shoulder past the corner is a target a person clips). A wider margin hides it from angles no one could clip
 * it from and leaves it fewer, deeper spots, and bots that fight from cover far less.
 */
export const BODY_MARGIN_PX = 3;
/** How far short of its spot a bot may pull up (the motor's arrival slack): a cover spot must also hide it there, on the way in. */
const ARRIVE_SLACK_PX = 14;
const BODY_SAMPLES = [-1, -0.5, 0, 0.5, 1] as const;

/**
 * Whether any of a body at `at` (its radius and `margin` round it) lies in a clear line from `from`: the line to its centre, and to
 * points across it at right angles to the line, out to its edge, as a round grazing a shoulder flies. A centre hidden behind a corner
 * with a shoulder past it is exposed.
 */
export function bodyExposed(solids: readonly Rect[], at: Point, from: Point, margin = BODY_MARGIN_PX): boolean {
  const dx = at.x - from.x, dy = at.y - from.y, d = Math.hypot(dx, dy);
  if (d < 1) return true;
  const px = -dy / d, py = dx / d, r = WORLD.playerRadius + margin;
  return BODY_SAMPLES.some((k) => clearShot(solids, from, { x: at.x + px * r * k, y: at.y + py * r * k }));
}

/** Whether a body at `at` is wholly hidden from every one of `threats` (see `bodyExposed`). */
export const bodyHidden = (solids: readonly Rect[], at: Point, threats: readonly Point[], margin = BODY_MARGIN_PX) =>
  threats.every((t) => !bodyExposed(solids, at, t, margin));

/** Its spot and the place it would pull up on the way in from `me`, `ARRIVE_SLACK_PX` short, both wholly hidden from every threat. */
function hidesBody(solids: readonly Rect[], c: Point, me: Point, threats: readonly Point[]): boolean {
  if (!bodyHidden(solids, c, threats)) return false;
  const d = Math.hypot(me.x - c.x, me.y - c.y);
  if (d < ARRIVE_SLACK_PX) return true;
  const short = { x: c.x + ((me.x - c.x) / d) * ARRIVE_SLACK_PX, y: c.y + ((me.y - c.y) / d) * ARRIVE_SLACK_PX };
  return bodyHidden(solids, short, threats, 0);
}

function peekFrom(nav: NavGrid, solids: readonly Rect[], spot: Point, threat: Point): Point | null {
  const a = Math.atan2(threat.y - spot.y, threat.x - spot.x);
  for (const step of PEEK_STEPS) {
    for (const side of [1, -1]) {
      const p = { x: spot.x + Math.cos(a + (side * Math.PI) / 2) * step, y: spot.y + Math.sin(a + (side * Math.PI) / 2) * step };
      if (isOpen(nav, p) && clearShot(solids, p, threat) && clearShot(solids, spot, p)) return p;
    }
  }
  return null;
}

type CoverPick = { spot: CoverPoint; peek: Point | null };

export function pickCover(
  index: CoverIndex, nav: NavGrid, solids: readonly Rect[], me: Point, threats: readonly Point[],
  opts: { reach: number; range: number; peek: boolean; taken?: readonly Point[]; takenPx?: number; nearest?: boolean },
): CoverPick | null {
  const main = threats[0];
  if (!main) return null;
  const ranked: { c: CoverPoint; score: number }[] = [];
  for (const c of coverNear(index, me, opts.reach)) {
    if (!isOpen(nav, c) || !(c.shieldedBearings & (1 << bearingIndex(c, main)))) continue;
    if (opts.taken?.some((t) => Math.hypot(t.x - c.x, t.y - c.y) < (opts.takenPx ?? TAKEN_PX))) continue;
    const toMain = Math.hypot(main.x - c.x, main.y - c.y);
    const walk = Math.hypot(c.x - me.x, c.y - me.y);
    // `nearest`: the closest spot that hides it (a tuck out of a line it is being shot down), whatever its range.
    ranked.push({ c, score: opts.nearest ? walk : opts.peek ? walk + Math.abs(toMain - opts.range) * 0.7 : walk - toMain * 0.5 });
  }
  ranked.sort((x, y) => x.score - y.score);
  for (const { c } of ranked) {
    if (!hidesBody(solids, c, me, threats)) continue;
    const peek = opts.peek ? peekFrom(nav, solids, c, main) : null;
    if (!opts.peek || peek) return { spot: c, peek };
  }
  return null;
}
