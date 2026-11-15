export const GRAVITY = 900;
export const BULLET_SPEED = 900;
const ROCKET_RANGE = 260;

export const POINTS = { tank: 150, rocket: 100, cannon: 200, ufo: 250, meteor: 120, laser: 300, boss: 5000 };
const HP = { tank: 1, rocket: 1, cannon: 2, ufo: 1, meteor: 2, laser: 3, boss: 60 };
const RADIUS = { tank: 16, rocket: 12, cannon: 16, ufo: 18, meteor: 20, laser: 14, boss: 70 };

export function makeShip() {
  return { kind: 'ship', x: 160, y: 200, r: 14, vx: 0, vy: 0, fireCd: 0, bombCd: 0, inv: 0, alive: true };
}
export const makeBullet = (x, y) => ({ kind: 'bullet', x, y, r: 4, vx: BULLET_SPEED, vy: 0, alive: true });
export const makeBomb = (x, y, vx) => ({ kind: 'bomb', x, y, r: 6, vx, vy: 0, alive: true });
export const makeShot = (x, y, vx, vy) => ({ kind: 'shot', x, y, r: 5, vx, vy, alive: true });

export function makeEnemy(o) {
  const e = { kind: 'enemy', type: o.type, x: o.x, y: o.y, r: RADIUS[o.type], hp: HP[o.type], alive: true, t: 0, vx: 0, vy: 0 };
  if (o.type === 'tank' || o.type === 'rocket' || o.type === 'cannon' || o.type === 'laser') e.y = o.y - e.r;
  if (o.type === 'rocket') e.launched = false;
  if (o.type === 'cannon') e.cd = 0.8 + (o.x % 7) / 10;
  if (o.type === 'laser') { e.on = false; e.timer = 1.2; }
  if (o.type === 'ufo') { e.baseY = o.y; e.phase = o.x % 6.28; }
  if (o.type === 'meteor') { e.vx = -120 - (o.x % 80); e.vy = 40 + (o.x % 50); e.spin = 0; }
  if (o.type === 'boss') { e.maxHp = e.hp; e.cd = 1.5; e.baseY = 200; }
  return e;
}

export function updateEntity(e, dt, ship, spawn = () => {}) {
  e.t = (e.t || 0) + dt;
  switch (e.kind === 'enemy' ? e.type : e.kind) {
    case 'bomb': e.vy += GRAVITY * dt; break;
    case 'rocket':
      if (!e.launched && Math.abs(e.x - ship.x) < ROCKET_RANGE) e.launched = true;
      if (e.launched) e.vy = Math.max(-420, e.vy - 700 * dt);
      break;
    case 'cannon':
      e.cd -= dt;
      if (e.cd <= 0 && e.x > ship.x && e.x - ship.x < 700) {
        e.cd = 1.6;
        const dx = ship.x - e.x, dy = ship.y - e.y, d = Math.hypot(dx, dy) || 1;
        spawn(makeShot(e.x, e.y - 12, (dx / d) * 300, (dy / d) * 300));
      }
      break;
    case 'laser':
      e.timer -= dt;
      while (e.timer <= 0) { e.on = !e.on; e.timer += 1.2; }
      break;
    case 'ufo':
      e.y = e.baseY + Math.sin(e.t * 2.4 + e.phase) * 60;
      e.vx = -60;
      break;
    case 'meteor': e.spin += dt * 3; break;
    case 'boss': {
      e.y = e.baseY + Math.sin(e.t * 1.1) * 110;
      e.cd -= dt;
      if (e.cd <= 0) {
        const rage = e.hp < e.maxHp / 2;
        e.cd = rage ? 0.9 : 1.4;
        const n = rage ? 7 : 5;
        for (let k = 0; k < n; k++) {
          const a = Math.PI + (k - (n - 1) / 2) * 0.22;
          spawn(makeShot(e.x - 60, e.y, Math.cos(a) * 280, Math.sin(a) * 280));
        }
      }
      break;
    }
  }
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  return e;
}
