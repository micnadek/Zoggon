import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, tickFuel, addFuel, addScore, loseLife, clearSector } from '../js/state.js';
import { loadBest, saveBest } from '../js/storage.js';

test('new game starts with 3 lives and full fuel', () => {
  const s = newGame();
  assert.equal(s.lives, 3); assert.equal(s.fuel, 100); assert.equal(s.sector, 0); assert.equal(s.phase, 'title');
});

test('fuel drains from 100 to 0 in 40 s', () => {
  const s = newGame();
  for (let i = 0; i < 39 * 60; i++) tickFuel(s, 1 / 60);
  assert.ok(s.fuel > 0);
  for (let i = 0; i < 61; i++) tickFuel(s, 1 / 60);
  assert.equal(s.fuel, 0);
});

test('addFuel adds 25 capped at 100', () => {
  const s = newGame(); s.fuel = 50; addFuel(s); assert.equal(s.fuel, 75); addFuel(s); addFuel(s); assert.equal(s.fuel, 100);
});

test('extra life every 10000 points, including multiple crossings', () => {
  const s = newGame(); addScore(s, 9999); assert.equal(s.lives, 3);
  addScore(s, 10002); assert.equal(s.lives, 5); assert.equal(s.nextLifeAt, 30000);
});

test('loseLife restarts sector with full fuel, game over at last life', () => {
  const s = newGame(); s.phase = 'play'; s.sector = 3; s.fuel = 10;
  loseLife(s); assert.equal(s.lives, 2); assert.equal(s.sector, 3); assert.equal(s.fuel, 100); assert.equal(s.phase, 'dead');
  s.lives = 1; loseLife(s); assert.equal(s.phase, 'over');
});

test('clearing sector 8 wins the game', () => {
  const s = newGame(); s.sector = 6; clearSector(s); assert.equal(s.sector, 7); assert.equal(s.phase, 'sectorClear');
  clearSector(s); assert.equal(s.phase, 'win');
});

test('best score survives missing localStorage', () => {
  const saved = globalThis.localStorage;
  globalThis.localStorage = undefined;
  assert.doesNotThrow(() => saveBest(1234));
  assert.equal(loadBest(), 1234);
  globalThis.localStorage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.doesNotThrow(() => saveBest(2000));
  assert.equal(loadBest(), 2000);
  globalThis.localStorage = saved;
});
