import { heightAt } from './terrain.js';

export function circleHit(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y, r = a.r + b.r;
  return dx * dx + dy * dy < r * r;
}

export function hitsTerrain(x, y, r, t) {
  if (y + r > heightAt(t.floor, t.step, x)) return true;
  if (t.ceil && y - r < heightAt(t.ceil, t.step, x)) return true;
  return false;
}
