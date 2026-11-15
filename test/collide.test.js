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

test('launched rocket climbs', () => {
  const r = makeEnemy({ type: 'rocket', x: 1000, y: 400 });
  for (let i = 0; i < 30; i++) updateEntity(r, 1 / 60, { x: 750, y: 200 });
  assert.ok(r.y < 400);
});

test('laser toggles every 1.2 s', () => {
  const l = makeEnemy({ type: 'laser', x: 0, y: 400 });
  const on0 = l.on;
  updateEntity(l, 1.25, { x: 0, y: 0 });
  assert.equal(l.on, !on0);
});

test('rocket launches when ship is within 380 px horizontally', () => {
  const r = makeEnemy({ type: 'rocket', x: 1000, y: 400 });
  updateEntity(r, 1 / 60, { x: 600, y: 50 });
  assert.equal(r.launched, false);
  updateEntity(r, 1 / 60, { x: 630, y: 50 });
  assert.equal(r.launched, true);
});

test('launched rocket steers horizontally toward the ship', () => {
  const r = makeEnemy({ type: 'rocket', x: 1000, y: 400 });
  for (let i = 0; i < 60; i++) updateEntity(r, 1 / 60, { x: 800, y: 50 });
  assert.ok(r.x < 1000, `x=${r.x}`);
});

test('ufo drifts toward the ship altitude', () => {
  const u = makeEnemy({ type: 'ufo', x: 1000, y: 250 });
  for (let i = 0; i < 180; i++) updateEntity(u, 1 / 60, { x: 700, y: 40 });
  assert.ok(u.baseY < 150, `baseY=${u.baseY}`);
});

test('fighter flies left fast and follows ship altitude', () => {
  const f = makeEnemy({ type: 'fighter', x: 1000, y: 300 });
  for (let i = 0; i < 30; i++) updateEntity(f, 1 / 60, { x: 600, y: 40 });
  assert.ok(f.x < 900);
  assert.ok(f.y < 300);
});
