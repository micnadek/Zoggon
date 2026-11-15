import { mulberry32 } from './rng.js';
import { SECTORS } from './sectors.js';

export const STEP = 16;
const FLOOR_MIN = 300, FLOOR_MAX = 520, MIN_GAP = 140;

export function heightAt(arr, step, x) {
  const f = Math.max(0, Math.min(arr.length - 1, x / step));
  const i = Math.floor(f), j = Math.min(arr.length - 1, i + 1);
  return arr[i] + (arr[j] - arr[i]) * (f - i);
}

function noise(rand, n, octaves) {
  const out = new Float32Array(n);
  let amp = 1, total = 0;
  for (const period of octaves) {
    const pts = [];
    for (let k = 0; k <= Math.ceil(n / period) + 1; k++) pts.push(rand() * 2 - 1);
    for (let i = 0; i < n; i++) {
      const f = i / period, k = Math.floor(f), t = f - k;
      const s = t * t * (3 - 2 * t);
      out[i] += amp * (pts[k] + (pts[k + 1] - pts[k]) * s);
    }
    total += amp; amp *= 0.5;
  }
  for (let i = 0; i < n; i++) out[i] /= total;
  return out;
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function buildTerrain(sectorIndex) {
  const sec = SECTORS[sectorIndex];
  const rand = mulberry32(0xC64 + sectorIndex * 7919);
  const n = Math.ceil(sec.length / STEP) + 2;
  const base = noise(rand, n, [90, 30, 9]);
  const floor = new Float32Array(n);
  const ceil = sec.cave ? new Float32Array(n) : null;
  const ceilNoise = sec.cave ? noise(rand, n, [70, 22, 7]) : null;
  for (let i = 0; i < n; i++) {
    // Flat runway at both ends so the start and boss arena are fair.
    const edge = Math.min(1, i / 40, (n - 1 - i) / 40);
    floor[i] = clamp(470 - edge * (base[i] * 190 + 70), FLOOR_MIN, FLOOR_MAX);
    if (ceil) {
      const c = 90 + edge * (ceilNoise[i] * 70 + 70);
      ceil[i] = Math.min(c, floor[i] - MIN_GAP);
    }
  }
  const objects = [];
  const place = (type, x) => {
    const gx = clamp(x, 0, sec.length);
    objects.push({ type, x: gx, y: heightAt(floor, STEP, gx) });
  };
  // Fuel: guaranteed one tank in each 750 px block, plus extras by density.
  for (let x = 600; x < sec.length - 600; x += 750) {
    place('tank', x + rand() * 600);
    if (rand() < sec.spawns.tank - 1 + 0.3) place('tank', x + rand() * 600);
  }
  const ground = ['rocket', 'cannon', 'laser'];
  const air = ['ufo', 'meteor'];
  for (const type of [...ground, ...air]) {
    const per1000 = sec.spawns[type];
    if (!per1000) continue;
    const count = Math.round((sec.length - 1600) / 1000 * per1000);
    for (let k = 0; k < count; k++) {
      const x = 800 + rand() * (sec.length - 1800);
      if (ground.includes(type)) place(type, x);
      else objects.push({ type, x, y: 80 + rand() * 220 });
    }
  }
  objects.sort((a, b) => a.x - b.x);
  return { floor, ceil, step: STEP, objects };
}
