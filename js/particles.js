export const MAX_PARTICLES = 400;

export function createParticles() {
  const list = [];
  return {
    list,
    count: () => list.length,
    burst(x, y, color, n, speed = 260, life = 0.9, size = 3) {
      for (let i = 0; i < n; i++) {
        if (list.length >= MAX_PARTICLES) list.shift();
        const a = Math.random() * Math.PI * 2, s = speed * (0.25 + Math.random() * 0.75);
        list.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.5 + Math.random() * 0.5), max: life, color, size: size * (0.5 + Math.random()) });
      }
    },
    trail(x, y, color) {
      if (list.length >= MAX_PARTICLES) return;
      list.push({ x, y, vx: -120 - Math.random() * 80, vy: (Math.random() - 0.5) * 40, life: 0.35, max: 0.35, color, size: 2.5 });
    },
    update(dt) {
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.life -= dt;
        if (p.life <= 0) { list.splice(i, 1); continue; }
        p.vx *= 1 - 1.8 * dt; p.vy = p.vy * (1 - 1.8 * dt) + 120 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
    },
    clear() { list.length = 0; },
  };
}
