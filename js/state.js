export const FUEL_DRAIN = 100 / 40;
export const FUEL_PER_TANK = 25;
export const LIFE_EVERY = 10000;
export const SECTOR_COUNT = 8;

export function newGame() {
  return { sector: 0, lives: 3, score: 0, fuel: 100, nextLifeAt: LIFE_EVERY, phase: 'title' };
}
export function tickFuel(s, dt) { s.fuel = Math.max(0, s.fuel - FUEL_DRAIN * dt); }
export function addFuel(s, amount = FUEL_PER_TANK) { s.fuel = Math.min(100, s.fuel + amount); }
export function addScore(s, pts) {
  s.score += pts;
  let gained = 0;
  while (s.score >= s.nextLifeAt) { s.lives++; gained++; s.nextLifeAt += LIFE_EVERY; }
  return gained;
}
export function loseLife(s) {
  s.lives--;
  s.fuel = 100;
  s.phase = s.lives <= 0 ? 'over' : 'dead';
}
export function clearSector(s) {
  if (s.sector >= SECTOR_COUNT - 1) { s.phase = 'win'; return; }
  s.sector++;
  s.fuel = 100;
  s.phase = 'sectorClear';
}
