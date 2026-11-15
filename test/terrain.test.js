import test from 'node:test';
import assert from 'node:assert/strict';
import { SECTORS } from '../js/sectors.js';
import { buildTerrain, heightAt } from '../js/terrain.js';

test('there are 8 sectors', () => assert.equal(SECTORS.length, 8));

test('terrain is deterministic per sector', () => {
  const a = buildTerrain(2), b = buildTerrain(2);
  assert.deepEqual(Array.from(a.floor), Array.from(b.floor));
  assert.deepEqual(a.objects, b.objects);
});

test('floor stays within 190..520 in every sector', () => {
  for (let i = 0; i < 8; i++) {
    for (const y of buildTerrain(i).floor) assert.ok(y >= 190 && y <= 520, `sector ${i} y=${y}`);
  }
});

test('caves keep a gap of at least 140 px', () => {
  for (let i = 0; i < 8; i++) {
    const t = buildTerrain(i);
    if (!SECTORS[i].cave) { assert.equal(t.ceil, null); continue; }
    for (let k = 0; k < t.floor.length; k++) assert.ok(t.floor[k] - t.ceil[k] >= 140, `sector ${i} k=${k}`);
  }
});

test('at least one fuel tank per 1500 px', () => {
  for (let i = 0; i < 8; i++) {
    const t = buildTerrain(i);
    const len = SECTORS[i].length;
    for (let x0 = 600; x0 + 1500 <= len - 600; x0 += 1500) {
      assert.ok(t.objects.some(o => o.type === 'tank' && o.x >= x0 && o.x < x0 + 1500), `sector ${i} window ${x0}`);
    }
  }
});

test('heightAt interpolates linearly between samples', () => {
  const arr = Float32Array.from([100, 200]);
  assert.equal(heightAt(arr, 10, 5), 150);
  assert.equal(heightAt(arr, 10, 0), 100);
  assert.equal(heightAt(arr, 10, 99), 200);
});

test('terrain is mountainous: open sectors have peaks of 240 px or more', () => {
  for (let i = 0; i < 8; i++) {
    if (SECTORS[i].cave) continue;
    const f = buildTerrain(i).floor;
    assert.ok(Math.max(...f) - Math.min(...f) >= 240, `sector ${i}: ${Math.max(...f) - Math.min(...f)}`);
  }
});

test('mountains leave a 150 px flying corridor above every peak', () => {
  for (let i = 0; i < 8; i++) for (const y of buildTerrain(i).floor) assert.ok(y >= 190);
});

test('UFOs and meteors start at least 120 px above the ground', () => {
  for (let i = 0; i < 8; i++) {
    const t = buildTerrain(i);
    for (const o of t.objects) if (o.type === 'ufo' || o.type === 'meteor') assert.ok(o.y <= heightAt(t.floor, t.step, o.x) - 120, `sector ${i} ${o.type}`);
  }
});
