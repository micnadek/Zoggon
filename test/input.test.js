import test from 'node:test';
import assert from 'node:assert/strict';
import { stickAxis, createInput } from '../js/input.js';

test('stickAxis clamps to unit length', () => {
  const a = stickAxis({ x: 0, y: 0 }, { x: 300, y: 400 }, 70);
  assert.ok(Math.abs(Math.hypot(a.x, a.y) - 1) < 1e-9);
  assert.ok(Math.abs(a.x - 0.6) < 1e-9);
});

test('stickAxis has a 0.15 dead zone', () => {
  assert.deepEqual(stickAxis({ x: 0, y: 0 }, { x: 10, y: 0 }, 70), { x: 0, y: 0 });
  assert.ok(stickAxis({ x: 0, y: 0 }, { x: 35, y: 0 }, 70).x > 0.4);
});

function fakeTarget() {
  const h = {};
  return {
    addEventListener: (n, f) => { h[n] = f; },
    fire: (n, e) => h[n]({ preventDefault() {}, ...e }),
  };
}

test('two pointers: stick and fire work independently', () => {
  const t = fakeTarget();
  const input = createInput(t, { keyTarget: fakeTarget(), toLogical: (x, y) => ({ x, y }) });
  input.layout(960, 540);
  t.fire('pointerdown', { pointerId: 1, clientX: 150, clientY: 400 });
  t.fire('pointermove', { pointerId: 1, clientX: 220, clientY: 400 });
  const fb = input.buttons.fire;
  t.fire('pointerdown', { pointerId: 2, clientX: fb.x, clientY: fb.y });
  assert.ok(input.axis.x > 0.9);
  assert.equal(input.fire, true);
  t.fire('pointerup', { pointerId: 2 });
  assert.equal(input.fire, false);
  assert.ok(input.axis.x > 0.9, 'stick still held');
  t.fire('pointerup', { pointerId: 1 });
  assert.equal(input.axis.x, 0);
});

test('keyboard arrows and Z/X map to axis, fire, bomb', () => {
  const k = fakeTarget();
  const input = createInput(fakeTarget(), { keyTarget: k, toLogical: (x, y) => ({ x, y }) });
  k.fire('keydown', { code: 'ArrowUp' }); k.fire('keydown', { code: 'KeyZ' }); k.fire('keydown', { code: 'KeyX' });
  assert.equal(input.axis.y, -1); assert.equal(input.fire, true); assert.equal(input.bomb, true);
  k.fire('keyup', { code: 'ArrowUp' });
  assert.equal(input.axis.y, 0);
});
