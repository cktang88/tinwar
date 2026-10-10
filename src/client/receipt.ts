import { BUILDINGS, ZOM, type BuildingKind } from '../shared/defs.ts';
import type { BuildingView, LeaderRow, PlayerView, ReceiptRow, Snapshot } from '../shared/protocol.ts';
import { emitSfx } from './sfxbus.ts';

/**
 * Dawn's receipt: what each source dealt the horde last night (the `receipt` event, sim/run.ts `takeReceipt`), printed as an old
 * thermal till slip at the right edge, between the board and the minimap. The text is laid out here in plain monospace columns, so
 * what a test reads is what the slip shows.
 */

export type ReceiptLine = { key: number | string; label: string; dealt: number; kills: number; you: boolean };

/** What a source is called on the slip: a player by name, a building by its kind with how many of them stand, the core, or the stray blasts. */
export function sourceLabel(key: number | string, players: readonly Pick<PlayerView | LeaderRow, 'id' | 'name'>[], buildings: readonly Pick<BuildingView, 'kind'>[]): string {
  if (typeof key === 'number') return (players.find((p) => p.id === key)?.name ?? `Soldier #${key}`).toUpperCase();
  if (key === 'bastion') return 'BASTION CORE';
  if (key === 'blast') return 'BLASTS';
  if (!(key in BUILDINGS)) return key.toUpperCase();
  const standing = buildings.filter((b) => b.kind === key).length;
  return `${BUILDINGS[key as BuildingKind].name.toUpperCase()}${standing > 0 ? ` ×${standing}` : ''}`;
}

/** The slip's line items: most damage first, then most kills, then by name so the order never flickers. */
export function receiptLines(rows: readonly ReceiptRow[], players: readonly Pick<PlayerView | LeaderRow, 'id' | 'name'>[], buildings: readonly Pick<BuildingView, 'kind'>[], selfId: number): ReceiptLine[] {
  return rows
    .map(([key, dealt, kills]) => ({ key, label: sourceLabel(key, players, buildings), dealt, kills, you: key === selfId }))
    .sort((a, b) => b.dealt - a.dealt || b.kills - a.kills || a.label.localeCompare(b.label));
}

export const money = (n: number) => Math.round(n).toLocaleString('en-US');

/** One till line `width` characters wide: the label run out to the numbers with a dotted leader, the kills, then the damage. */
export function tillLine(label: string, kills: string, dealt: string, width: number, fill = '.'): string {
  const right = ` ${kills.padStart(4)} ${dealt.padStart(7)}`;
  const room = width - right.length;
  const name = label.length > room - 2 ? `${label.slice(0, room - 3)}…` : label;
  const gap = room - name.length;
  return `${name}${gap > 1 ? ` ${fill.repeat(gap - 1)}` : ' '.repeat(gap)}${right}`;
}

export const center = (s: string, width: number) => {
  const pad = Math.max(0, width - s.length);
  return `${' '.repeat(Math.floor(pad / 2))}${s}${' '.repeat(Math.ceil(pad / 2))}`;
};

/** Two pieces of text at either end of a line `width` wide. */
export const spread = (a: string, b: string, width: number) => `${a}${b.padStart(Math.max(b.length + 1, width - a.length))}`;

/** A barcode's bar and gap widths (1 to 3 units), the same for the same seed. */
export function barcode(seed: number, bars = 34): number[] {
  let x = (seed * 2654435761) >>> 0 || 1;
  return Array.from({ length: bars * 2 }, () => {
    x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
    return 1 + (x % 3);
  });
}

export type ReceiptText = {
  head: string[]; time: string; cols: string; items: { text: string; you: boolean }[]; more: string | null; total: string; kills: string; foot: string[]; code: string; seed: number;
};

/**
 * The whole slip's text for night `night`, `width` characters wide, at most `maxRows` line items: the rest are folded into one
 * `+N MORE` line, or with `fold` false simply left to the total. `at` is the wall clock it prints at, for the date.
 */
export function receiptText(night: number, lines: readonly ReceiptLine[], width: number, maxRows: number, at: Date, fold = true): ReceiptText {
  const dealt = lines.reduce((n, l) => n + l.dealt, 0), kills = lines.reduce((n, l) => n + l.kills, 0);
  const shown = lines.length <= maxRows ? lines : lines.slice(0, fold ? maxRows - 1 : maxRows);
  const rest = lines.slice(shown.length);
  const date = `${String(at.getMonth() + 1).padStart(2, '0')}/${String(at.getDate()).padStart(2, '0')}/${String(at.getFullYear() % 100).padStart(2, '0')}`;
  // Every receipt is printed at first light, a minute later each night.
  const time = `05:${String(30 + (night % 30)).padStart(2, '0')} AM`;
  const no = String(night * 1000 + (dealt % 1000)).padStart(6, '0');
  return {
    head: [center('BASTION DEFENSE CO.', width), center('OUTPOST 7 · NIGHT DESK', width), '', spread(`NIGHT ${night} · RECEIPT`, `#${no}`, width), spread(date, time, width)],
    time,
    cols: tillLine('ITEM', 'KO', 'DMG', width, ' '),
    items: shown.map((l) => ({ text: tillLine(l.label, String(l.kills), money(l.dealt), width), you: l.you })),
    more: rest.length && fold ? tillLine(`+${rest.length} MORE`, String(rest.reduce((n, l) => n + l.kills, 0)), money(rest.reduce((n, l) => n + l.dealt, 0)), width) : null,
    total: tillLine('TOTAL', String(kills), money(dealt), width),
    kills: `${lines.length} SOURCE${lines.length === 1 ? '' : 'S'} · ${kills} KILL${kills === 1 ? '' : 'S'}`,
    foot: [center('THANK YOU FOR SURVIVING', width), center('PLEASE COME AGAIN TONIGHT', width)],
    code: `${no.slice(0, 3)} ${String(dealt).padStart(6, '0')} ${String(kills).padStart(4, '0')}`,
    seed: night * 7919 + dealt,
  };
}

/** How long a receipt stays up: most of the day, then it tears off. */
export const RECEIPT_HOLD_MS = ZOM.dayMs * 0.75;
/** One line feeds out of the slot this often. */
export const LINE_FEED_MS = 70;
const TEAR_MS = 420;

/**
 * The free stretch of the right edge, in CSS px (hud.ts `drawnRightRoom`): from `top` to `bottom`, `right` in from the screen's
 * edge and at most `width` wide; `k` the HUD's scale, which the slip grows and shrinks with.
 */
export type RightRoom = { top: number; bottom: number; right: number; width: number; k: number; phone: boolean; boardOpen: boolean };

/** The slip's scale: the HUD's, shrunk further so it fits its room, and never so small it cannot be read. */
export const fitScale = (room: Pick<RightRoom, 'top' | 'bottom' | 'width' | 'k'>, w: number, h: number) =>
  Math.max(0.45, Math.min(room.k, (room.bottom - room.top) / Math.max(1, h), room.width / Math.max(1, w)));

/** The DOM slip: `onSnap` catches dawn's receipt, `update` (each frame) places it, prints it in line by line, and tears it off. */
export function createReceipt(host: HTMLElement) {
  const el = document.createElement('div');
  el.className = 'receipt';
  el.hidden = true;
  el.setAttribute('role', 'status');
  el.title = 'Click to tear off';
  const slot = document.createElement('div');
  slot.className = 'receipt-slot';
  const feed = document.createElement('div');
  feed.className = 'receipt-feed';
  const paper = document.createElement('div');
  paper.className = 'receipt-paper';
  feed.append(paper);
  el.append(slot, feed);
  host.append(el);

  let shownAt = 0, printAt = 0, tornAt = 0, printed = 0, lineEls: HTMLElement[] = [], phone: boolean | null = null;
  let last: { night: number; rows: ReceiptRow[]; snap: Snapshot; selfId: number; at: Date } | null = null;
  const tear = () => { if (!el.hidden && !tornAt) tornAt = performance.now(); };
  el.addEventListener('pointerdown', (e) => { e.stopPropagation(); tear(); });

  const line = (text: string, cls = '') => {
    const d = document.createElement('div');
    d.className = `rl ${cls}`.trim();
    d.textContent = text;
    return d;
  };

  const render = (compact: boolean) => {
    if (!last) return;
    const width = compact ? 26 : 32;
    const lines = receiptLines(last.rows, [...last.snap.players, ...last.snap.leaderboard], last.snap.buildings ?? [], last.selfId);
    // A phone's slip is the top five and the total, under a two-line head, so it fits between the top-right row and the buttons.
    const t = receiptText(last.night, lines, width, compact ? 5 : 10, last.at, !compact);
    const rule = '-'.repeat(width), dbl = '='.repeat(width);
    const bars = document.createElement('div');
    bars.className = 'rl receipt-code';
    const widths = barcode(t.seed, compact ? 26 : 34);
    bars.append(...widths.map((wd, i) => Object.assign(document.createElement('i'), { className: i % 2 ? 'gap' : '', style: `width:${wd}px` })));
    const head = compact ? [t.head[0]!, spread(`NIGHT ${last.night} · RECEIPT`, t.time, width)] : t.head;
    const parts: HTMLElement[] = [
      ...head.map((s, i) => line(s, i === 0 ? 'rh' : '')),
      line(rule),
      ...(compact ? [] : [line(t.cols, 'rc')]),
      ...(t.items.length ? t.items.map((it) => line(it.text, it.you ? 'you' : '')) : [line(center('NO DAMAGE DEALT', width))]),
      ...(t.more ? [line(t.more, 'rm')] : []),
      line(dbl),
      line(t.total, 'rt'),
      ...(compact ? [] : [line(t.kills, 'rm')]),
      ...(compact ? [bars] : [line(rule), ...t.foot.map((s) => line(s)), bars, line(center(t.code, width), 'rn')]),
    ];
    paper.replaceChildren(...parts);
    lineEls = parts;
  };

  const lift = () => {
    // The paper hangs from the slot, fed out to the line last printed; the rest is still inside the printer.
    const h = paper.offsetHeight;
    feed.style.height = `${printed >= lineEls.length ? h : lineEls[printed]?.offsetTop ?? h}px`;
  };

  return {
    onSnap(snap: Snapshot, selfId: number) {
      for (const e of snap.events) {
        if (e.e !== 'receipt') continue;
        last = { night: e.night, rows: e.rows, snap, selfId, at: new Date() };
        shownAt = performance.now();
        printAt = 0;
        tornAt = 0;
        printed = 0;
        phone = null;
        el.hidden = true;
      }
    },
    update(snap: Snapshot | null, room: RightRoom | null) {
      if (!last) return;
      const now = performance.now();
      if (!tornAt && (now - shownAt > RECEIPT_HOLD_MS || !snap?.run || snap.run.phase !== 'day')) tornAt = now;
      if (tornAt && now - tornAt > TEAR_MS) { el.hidden = true; last = null; el.classList.remove('torn'); return; }
      if (!room) { el.hidden = true; return; }
      if (phone !== room.phone) { phone = room.phone; el.classList.toggle('compact', room.phone); render(room.phone); }
      el.hidden = false;
      el.classList.toggle('torn', !!tornAt);
      // Dawn's XP card docks at the same edge for a few seconds: the slip waits under it, then rises into its place.
      const xp = document.getElementById('xp-card');
      const card = xp && !xp.hidden && xp.parentElement?.id === 'hud' ? xp.getBoundingClientRect() : null;
      const top = card && card.height > 0 && card.left < innerWidth - room.right && card.right > innerWidth - room.right - el.offsetWidth * room.k ? Math.max(room.top, card.bottom + 10) : room.top;
      // Where too little room is left under the card (a phone), the slip steps aside until the card has gone, never over the buttons.
      const natural = slot.offsetHeight + paper.offsetHeight;
      const crowded = top > room.top && room.bottom - top < natural * Math.min(room.k, 1) * 0.6;
      el.classList.toggle('away', room.boardOpen || crowded);
      el.style.top = `${crowded ? room.top : top}px`;
      room = { ...room, top: crowded ? room.top : top };
      el.style.right = `${room.right}px`;
      // Shrinks to fit the room it has, never over the minimap below or past the play area's edge.
      el.style.transform = `scale(${fitScale(room, el.offsetWidth, natural)})`;
      // It prints once it is first in view, so a slip that waited out the XP card still feeds out line by line.
      if (el.classList.contains('away')) return;
      printAt ||= now;
      const due = Math.min(lineEls.length, Math.floor((now - printAt) / LINE_FEED_MS));
      if (due > printed) {
        // A soft step of the print head for each line fed, not every one, so a long slip purrs rather than rattles.
        if (printed % 2 === 0) emitSfx('notReady', { gain: 0.35, pan: 0.7 });
        printed = due;
      }
      lift();
    },
    tear,
    /** Whether (x, y) CSS px is on the slip: a click there with the pointer locked tears it off instead of firing. */
    hit(x: number, y: number): boolean {
      if (el.hidden || tornAt || el.classList.contains('away')) return false;
      const r = el.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    },
  };
}
