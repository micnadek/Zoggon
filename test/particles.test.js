import test from 'node:test';
import assert from 'node:assert/strict';
import { createParticles, MAX_PARTICLES } from '../js/particles.js';

test('particle pool never exceeds 400', () => {
  assert.equal(MAX_PARTICLES, 400);
  const p = createParticles();
  for (let i = 0; i < 50; i++) p.burst(0, 0, '#fff', 30);
  assert.ok(p.count() <= 400);
});

test('particles expire', () => {
  const p = createParticles();
  p.burst(0, 0, '#fff', 20);
  for (let i = 0; i < 300; i++) p.update(1 / 60);
  assert.equal(p.count(), 0);
});
