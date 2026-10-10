import assert from 'node:assert/strict';
import { test } from 'node:test';
import { barcode, fitScale, receiptLines, receiptText, sourceLabel, tillLine } from '../src/client/receipt.ts';
import type { ReceiptRow } from '../src/shared/protocol.ts';
import { BUILDINGS } from '../src/shared/defs.ts';

const players = [{ id: 7, name: 'Halberd' }, { id: 9, name: 'Pocket' }];
const buildings = [{ kind: 'sentry' as const }, { kind: 'sentry' as const }, { kind: 'sentry' as const }, { kind: 'mortar' as const }, { kind: 'wall' as const }];

test('a source is named as the slip prints it: a player by name, a building kind with how many stand, the core and stray blasts', () => {
  assert.equal(sourceLabel(7, players, buildings), 'HALBERD');
  assert.equal(sourceLabel(42, players, buildings), 'SOLDIER #42', 'someone who has left since');
  assert.equal(sourceLabel('sentry', players, buildings), 'SENTRY ×3');
  assert.equal(sourceLabel('tesla', players, buildings), 'TESLA COIL', 'none standing now: no count');
  assert.equal(sourceLabel('spikes', players, buildings), 'SPIKE STRIP');
  assert.equal(sourceLabel('bastion', players, buildings), 'BASTION CORE');
  assert.equal(sourceLabel('blast', players, buildings), 'BLASTS');
  assert.equal(sourceLabel('flamer', players, buildings), 'FLAMER', 'a kind the client does not know yet still prints');
});

test('the line items run from most damage down, ties by kills then name, and mark your own', () => {
  const rows: ReceiptRow[] = [[9, 300, 2], ['sentry', 4210, 23], [7, 300, 5], ['mortar', 300, 5], ['bastion', 12, 1]];
  const lines = receiptLines(rows, players, buildings, 7);
  assert.deepEqual(lines.map((l) => l.label), ['SENTRY ×3', 'HALBERD', 'MORTAR ×1', 'POCKET', 'BASTION CORE']);
  assert.deepEqual(lines.map((l) => l.you), [false, true, false, false, false]);
});

test('a till line is exactly as wide as the slip, the label run out to the numbers with dots, a long name cut', () => {
  const line = tillLine('SENTRY ×3', '23', '4,210', 32);
  assert.equal(line.length, 32);
  assert.match(line, /^SENTRY ×3 \.+   23   4,210$/);
  const long = tillLine('ABCDEFGHIJKLMNOPQRSTUV', '1', '9', 26);
  assert.equal(long.length, 26);
  assert.ok(long.includes('…'), long);
});

test('the slip totals every source, folds what does not fit into one line, and a phone slip keeps the top five', () => {
  const rows: ReceiptRow[] = Array.from({ length: 8 }, (_, i): ReceiptRow => [`k${i}`, 1000 - i * 100, i]);
  const lines = receiptLines(rows, players, buildings, 7);
  const at = new Date(2026, 9, 10);
  const desk = receiptText(4, lines, 32, 6, at);
  assert.equal(desk.items.length, 5);
  assert.match(desk.more!, /^\+3 MORE \.+ +18 +1,200$/);
  assert.match(desk.total, /^TOTAL \.+ +28 +5,200$/);
  assert.ok(desk.head.some((l) => l.includes('NIGHT 4 · RECEIPT')) && desk.head.some((l) => l.startsWith('10/10/26')));
  for (const l of [...desk.head, desk.cols, ...desk.items.map((i) => i.text), desk.total]) assert.ok(l.length <= 32, l);
  const phone = receiptText(4, lines, 26, 5, at, false);
  assert.equal(phone.items.length, 5);
  assert.equal(phone.more, null);
  assert.equal(phone.total, tillLine('TOTAL', '28', '5,200', 26));
});

test('the barcode is the same for the same night, and the slip shrinks to its room but never past the HUD scale', () => {
  assert.deepEqual(barcode(123), barcode(123));
  assert.notDeepEqual(barcode(123), barcode(124));
  assert.ok(barcode(5).every((w) => w >= 1 && w <= 3));
  assert.equal(fitScale({ top: 100, bottom: 900, width: 500, k: 1 }, 260, 400), 1);
  assert.equal(fitScale({ top: 100, bottom: 300, width: 500, k: 1 }, 260, 400), 0.5);
  assert.equal(fitScale({ top: 100, bottom: 120, width: 500, k: 1 }, 260, 400), 0.45, 'never unreadably small');
});

test('every building kind prints under its own name from the building table, so a new kind needs no client change', () => {
  for (const kind of Object.keys(BUILDINGS) as (keyof typeof BUILDINGS)[]) {
    assert.equal(sourceLabel(kind, players, [{ kind }]), `${BUILDINGS[kind].name.toUpperCase()} ×1`, kind);
  }
});
