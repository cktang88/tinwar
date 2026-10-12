/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WORLD } from '../src/shared/defs.ts';
import { bearingIndex, bodyExposed, coverIndex, pickCover } from '../src/server/bot/cover.ts';
import { clearShot, navGrid } from '../src/server/bot/nav.ts';

const R = WORLD.playerRadius;
const pillar = { x: 1000, y: 900, w: 40, h: 200 };
const setup = (rects = [pillar]) => {
  const nav = navGrid(3000, rects, R);
  return { nav, index: coverIndex(nav, rects, R), rects };
};

test('cover against a threat to the east is the pillar\'s west face, hidden from the threat, with a peek that sees it', () => {
  const { nav, index, rects } = setup();
  const threat = { x: 1600, y: 1000 };
  const pick = pickCover(index, nav, rects, { x: 700, y: 1000 }, [threat], { reach: 500, range: 500, peek: true });
  assert.ok(pick && pick.peek, 'found cover with a peek');
  assert.ok(pick.spot.x < pillar.x, `stands west of the pillar: ${JSON.stringify(pick.spot)}`);
  assert.ok(!clearShot(rects, pick.spot, threat), 'the threat cannot shoot the spot');
  assert.ok(clearShot(rects, pick.peek, threat), 'the peek sees the threat');
});

test('the same pillar against a threat to the west puts the bot on its east face', () => {
  const { nav, index, rects } = setup();
  const threat = { x: 400, y: 1000 };
  const pick = pickCover(index, nav, rects, { x: 1300, y: 1000 }, [threat], { reach: 500, range: 500, peek: true });
  assert.ok(pick, 'found cover');
  assert.ok(pick.spot.x > pillar.x + pillar.w, `stands east of the pillar: ${JSON.stringify(pick.spot)}`);
  assert.ok(!clearShot(rects, pick.spot, threat));
});

test('a spot that hides from one threat but not a second is refused', () => {
  const { nav, index, rects } = setup();
  const pick = pickCover(index, nav, rects, { x: 700, y: 1000 }, [{ x: 1600, y: 1000 }, { x: 700, y: 400 }], { reach: 500, range: 500, peek: false });
  for (const t of [{ x: 1600, y: 1000 }, { x: 700, y: 400 }]) assert.ok(!pick || !clearShot(rects, pick.spot, t), `no spot in sight of (${t.x}, ${t.y})`);
});

test('no cover is offered beyond reach or in an open field', () => {
  const { nav, index, rects } = setup();
  assert.equal(pickCover(index, nav, rects, { x: 200, y: 200 }, [{ x: 1600, y: 1000 }], { reach: 300, range: 500, peek: true }), null);
  const open = setup([]);
  assert.equal(pickCover(open.index, open.nav, [], { x: 700, y: 1000 }, [{ x: 1600, y: 1000 }], { reach: 500, range: 500, peek: true }), null);
});

test('cover is judged against the live cover, so a spot behind a crate that broke is not offered', () => {
  // Two crates stacked: one alone (44 px) is narrower than a body (48 px), so it hides none wholly (see the shoulder test below).
  const crates = [{ x: 1000, y: 956, w: 44, h: 44 }, { x: 1000, y: 1000, w: 44, h: 44 }];
  const { nav, index } = setup(crates);
  const threat = { x: 1600, y: 1000 };
  assert.ok(pickCover(index, nav, crates, { x: 800, y: 1000 }, [threat], { reach: 400, range: 500, peek: false }), 'the standing crates are cover');
  assert.equal(pickCover(index, nav, [], { x: 800, y: 1000 }, [threat], { reach: 400, range: 500, peek: false }), null, 'the broken crates are not');
});

test('cover hides the whole body, a margin round it, from the threat: no shoulder past the corner, nor behind a lone crate narrower than a body', () => {
  const { nav, index, rects } = setup();
  // At an angle past the pillar's south end: the corner spot hides a bot's centre from him but not its shoulder.
  const threat = { x: 1600, y: 1095 };
  const corner = { x: pillar.x - R - 6, y: pillar.y + pillar.h };
  assert.ok(!clearShot(rects, corner, threat) && bodyExposed(rects, corner, threat), 'the corner spot shows him a shoulder');
  for (const from of [{ x: 700, y: 1000 }, { x: 700, y: 1150 }, { x: 900, y: 850 }]) {
    const pick = pickCover(index, nav, rects, from, [threat], { reach: 500, range: 500, peek: false });
    assert.ok(pick, `found cover from (${from.x}, ${from.y})`);
    assert.ok(!bodyExposed(rects, pick.spot, threat), `no part of a body at ${JSON.stringify(pick.spot)} is in his line`);
  }
  const crate = [{ x: 1000, y: 978, w: 44, h: 44 }];
  const lone = setup(crate);
  assert.equal(pickCover(lone.index, lone.nav, crate, { x: 800, y: 1000 }, [{ x: 1600, y: 1000 }], { reach: 400, range: 500, peek: false }), null, 'a lone crate hides no body wholly');
});

test('each cover point records the bearings its wall shields: a west-face spot blocks shots from the east and not from the west', () => {
  const { index } = setup();
  const points = index.cells.flat();
  const west = points.filter((p) => p.x < pillar.x && p.y > pillar.y + 20 && p.y < pillar.y + pillar.h - 20);
  assert.ok(west.length > 0, 'the west face has cover points');
  for (const p of west) {
    assert.ok(p.shieldedBearings & (1 << bearingIndex(p, { x: 2000, y: p.y })), `(${p.x}, ${p.y}) blocks the east`);
    assert.ok(!(p.shieldedBearings & (1 << bearingIndex(p, { x: 0, y: p.y }))), `(${p.x}, ${p.y}) is open to the west`);
  }
  assert.ok(points.every((p) => p.shieldedBearings !== 0), 'no point that shields nothing');
});
