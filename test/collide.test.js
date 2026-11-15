import test from 'node:test';
import assert from 'node:assert/strict';
import { circleHit, hitsTerrain } from '../js/collide.js';
import { makeBomb, makeBullet, makeEnemy, updateEntity, GRAVITY } from '../js/entities.js';

const flat = (y, ceil = null) => ({ floor: Float32Array.from([y, y, y]), ceil: ceil === null ? null : Float32Array.from([ceil, ceil, ceil]), step: 100 });

test('circleHit detects overlap only', () => {
  assert.ok(circleHit({ x: 0, y: 0, r: 5 }, { x: 8, y: 0, r: 5 }));
  assert.ok(!circleHit({ x: 0, y: 0, r: 5 }, { x: 11, y: 0, r: 5 }));
});

test('hitsTerrain below floor and above cave ceiling', () => {
  assert.ok(hitsTerrain(50, 395, 10, flat(400)));
  assert.ok(!hitsTerrain(50, 300, 10, flat(400)));
  assert.ok(hitsTerrain(50, 105, 10, flat(400, 100)));
  assert.ok(!hitsTerrain(50, 200, 10, flat(400, 100)));
});

test('bomb falls about 112 px in 0.5 s', () => {
  assert.equal(GRAVITY, 900);
  const b = makeBomb(0, 0, 150);
  for (let i = 0; i < 30; i++) updateEntity(b, 1 / 60, { x: 0, y: 0 });
  assert.ok(Math.abs(b.y - 112.5) < 6, `y=${b.y}`);
  assert.ok(b.x > 50);
});

test('bullet flies 900 px/s to the right', () => {
  const b = makeBullet(0, 0);
  updateEntity(b, 0.5, { x: 0, y: 0 });
  assert.equal(b.x, 450);
});

test('rocket launches only when ship is within 260 px horizontally', () => {
  const r = makeEnemy({ type: 'rocket', x: 1000, y: 400 });
  updateEntity(r, 1 / 60, { x: 700, y: 200 });
  assert.equal(r.launched, false);
  updateEntity(r, 1 / 60, { x: 750, y: 200 });
  assert.equal(r.launched, true);
  for (let i = 0; i < 30; i++) updateEntity(r, 1 / 60, { x: 750, y: 200 });
  assert.ok(r.y < 400);
});

test('laser toggles every 1.2 s', () => {
  const l = makeEnemy({ type: 'laser', x: 0, y: 400 });
  const on0 = l.on;
  updateEntity(l, 1.25, { x: 0, y: 0 });
  assert.equal(l.on, !on0);
});
