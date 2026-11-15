import { heightAt } from './terrain.js';
import { SECTORS } from './sectors.js';

export const W = 960, H = 540;
const bgCache = new Map();

function skyLayer(sectorIndex) {
  if (bgCache.has(sectorIndex)) return bgCache.get(sectorIndex);
  const pal = SECTORS[sectorIndex].palette;
  const c = (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(W, H) : Object.assign(document.createElement('canvas'), { width: W, height: H });
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, pal.sky[0]); grad.addColorStop(1, pal.sky[1]);
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  // Big hazy planet.
  const pg = g.createRadialGradient(720, 130, 10, 720, 130, 110);
  pg.addColorStop(0, pal.glow + '55'); pg.addColorStop(0.6, pal.glow + '18'); pg.addColorStop(1, 'transparent');
  g.fillStyle = pg; g.fillRect(560, 0, 340, 300);
  bgCache.set(sectorIndex, c);
  return c;
}

const stars = Array.from({ length: 90 }, (_, i) => ({ x: (i * 97.3) % W, y: (i * 53.7) % 330, z: 0.2 + (i % 5) / 10, s: 0.6 + (i % 3) * 0.5 }));

function ridge(ctx, camX, factor, base, amp, color, seed) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(0, H);
  const off = camX * factor;
  for (let x = 0; x <= W + 20; x += 20) {
    const u = (x + off) / 140 + seed;
    const y = base - amp * (0.55 * Math.sin(u) + 0.3 * Math.sin(u * 2.3 + 1.7) + 0.15 * Math.sin(u * 5.1));
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
}

function terrainPath(ctx, arr, step, camX, close) {
  const i0 = Math.max(0, Math.floor(camX / step) - 1), i1 = Math.min(arr.length - 1, Math.ceil((camX + W) / step) + 1);
  ctx.beginPath();
  ctx.moveTo(i0 * step - camX, close);
  for (let i = i0; i <= i1; i++) ctx.lineTo(i * step - camX, arr[i]);
  ctx.lineTo(i1 * step - camX, close);
  ctx.closePath();
}

function terrainEdge(ctx, arr, step, camX, dy = 0) {
  const i0 = Math.max(0, Math.floor(camX / step) - 1), i1 = Math.min(arr.length - 1, Math.ceil((camX + W) / step) + 1);
  ctx.beginPath();
  for (let i = i0; i <= i1; i++) {
    const x = i * step - camX, y = arr[i] + dy;
    i === i0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
}

function glowStroke(ctx, color, width) {
  ctx.strokeStyle = color; ctx.globalAlpha = 0.18; ctx.lineWidth = width * 5; ctx.stroke();
  ctx.globalAlpha = 0.35; ctx.lineWidth = width * 2.2; ctx.stroke();
  ctx.globalAlpha = 1; ctx.lineWidth = width; ctx.strokeStyle = '#ffffff'; ctx.stroke();
  ctx.strokeStyle = color; ctx.globalAlpha = 0.85; ctx.stroke(); ctx.globalAlpha = 1;
}

export function renderWorld(ctx, world, state, input, t) {
  const sec = SECTORS[state.sector], pal = sec.palette, terr = world.terrain, camX = world.camX;
  ctx.save();
  if (world.shake > 0) ctx.translate((Math.random() - 0.5) * world.shake, (Math.random() - 0.5) * world.shake);

  ctx.drawImage(skyLayer(state.sector), 0, 0);
  for (const s of stars) {
    const x = ((s.x - camX * s.z * 0.1) % W + W) % W;
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 2 + s.x);
    ctx.fillStyle = '#fff'; ctx.fillRect(x, s.y, s.s, s.s);
  }
  ctx.globalAlpha = 1;
  ridge(ctx, camX, 0.15, 360, 70, pal.glow + '14', 1);
  ridge(ctx, camX, 0.35, 420, 60, pal.ground + 'aa', 4);

  // Ground.
  const gg = ctx.createLinearGradient(0, 300, 0, H);
  gg.addColorStop(0, pal.ground); gg.addColorStop(1, '#000');
  ctx.fillStyle = gg;
  terrainPath(ctx, terr.floor, terr.step, camX, H + 10); ctx.fill();
  terrainEdge(ctx, terr.floor, terr.step, camX, 14); ctx.strokeStyle = pal.glow; ctx.globalAlpha = 0.18; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1;
  terrainEdge(ctx, terr.floor, terr.step, camX); glowStroke(ctx, pal.glow, 2);
  if (terr.ceil) {
    const cg = ctx.createLinearGradient(0, 0, 0, 260);
    cg.addColorStop(0, '#000'); cg.addColorStop(1, pal.ground);
    ctx.fillStyle = cg;
    terrainPath(ctx, terr.ceil, terr.step, camX, -10); ctx.fill();
    terrainEdge(ctx, terr.ceil, terr.step, camX, -14); ctx.strokeStyle = pal.glow; ctx.globalAlpha = 0.18; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1;
    terrainEdge(ctx, terr.ceil, terr.step, camX); glowStroke(ctx, pal.glow, 2);
  }

  for (const e of world.enemies) drawEnemy(ctx, e, camX, world, t, pal);

  // Player projectiles.
  ctx.globalCompositeOperation = 'lighter';
  for (const b of world.bullets) {
    const x = b.x - camX;
    ctx.fillStyle = '#7cf2ff55'; ctx.fillRect(x - 22, b.y - 3, 26, 6);
    ctx.fillStyle = '#e8ffff'; ctx.fillRect(x - 14, b.y - 1.5, 18, 3);
  }
  for (const b of world.bombs) {
    const x = b.x - camX;
    ctx.fillStyle = '#ffd04855'; ctx.beginPath(); ctx.arc(x, b.y, 10, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff3c0'; ctx.beginPath(); ctx.arc(x, b.y, 5, 0, 7); ctx.fill();
  }
  for (const s of world.shots) {
    const x = s.x - camX;
    ctx.fillStyle = '#ff305055'; ctx.beginPath(); ctx.arc(x, s.y, 11, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffd0d8'; ctx.beginPath(); ctx.arc(x, s.y, 4.5, 0, 7); ctx.fill();
  }
  // Particles.
  for (const p of world.particles.list) {
    const a = Math.max(0, p.life / p.max);
    ctx.globalAlpha = a; ctx.fillStyle = p.color;
    const sz = p.size * (0.6 + a);
    ctx.fillRect(p.x - camX - sz / 2, p.y - sz / 2, sz, sz);
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

  if (world.ship.alive) drawShip(ctx, world.ship, camX, t, state);

  ctx.restore();
  if (world.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.6, world.flash)})`; ctx.fillRect(0, 0, W, H); }
  if (!input.hideHud) drawHud(ctx, world, state, t, pal);
  if (input.touched) drawControls(ctx, input);
}

function drawShip(ctx, s, camX, t, state) {
  if (s.inv > 0 && Math.floor(t * 16) % 2) return;
  const x = s.x - camX, y = s.y;
  ctx.save(); ctx.translate(x, y); ctx.rotate(s.tilt || 0);
  // Engine flame.
  ctx.globalCompositeOperation = 'lighter';
  const fl = 18 + Math.random() * 10 + Math.max(0, s.thrust || 0) * 14;
  const fg = ctx.createLinearGradient(-14 - fl, 0, -12, 0);
  fg.addColorStop(0, 'rgba(255,80,40,0)'); fg.addColorStop(0.6, 'rgba(255,170,60,0.8)'); fg.addColorStop(1, '#fff');
  ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(-12, -5); ctx.lineTo(-14 - fl, 0); ctx.lineTo(-12, 5); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  // Hull.
  const hg = ctx.createLinearGradient(0, -12, 0, 12);
  hg.addColorStop(0, '#e9f6ff'); hg.addColorStop(0.5, '#7aa8d8'); hg.addColorStop(1, '#25324f');
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.moveTo(26, 2); ctx.lineTo(6, -6); ctx.lineTo(-6, -16); ctx.lineTo(-14, -14); ctx.lineTo(-10, -5);
  ctx.lineTo(-16, -4); ctx.lineTo(-16, 6); ctx.lineTo(-8, 8); ctx.lineTo(-12, 15); ctx.lineTo(-4, 15); ctx.lineTo(10, 7);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#7cf2ff'; ctx.lineWidth = 1.5; ctx.stroke();
  // Cockpit.
  ctx.fillStyle = '#7cf2ff'; ctx.beginPath(); ctx.ellipse(6, -2, 6, 3, -0.15, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillRect(4, -4, 3, 1.5);
  // Fuel warning light.
  if (state.fuel < 20 && Math.floor(t * 6) % 2) { ctx.fillStyle = '#ff3040'; ctx.beginPath(); ctx.arc(-8, -11, 2.5, 0, 7); ctx.fill(); }
  ctx.restore();
}

function drawEnemy(ctx, e, camX, world, t, pal) {
  const x = e.x - camX, y = e.y;
  if (x < -120 || x > W + 120) return;
  ctx.save(); ctx.translate(x, y);
  if (e.flash > 0) ctx.filter = 'brightness(3)';
  switch (e.type) {
    case 'tank': {
      ctx.fillStyle = '#16301a'; ctx.fillRect(-15, -14, 30, 30);
      const g = ctx.createLinearGradient(-15, 0, 15, 0);
      g.addColorStop(0, '#2d7a3a'); g.addColorStop(0.45, '#b6ff6a'); g.addColorStop(1, '#245c2c');
      ctx.fillStyle = g; ctx.fillRect(-14, -13, 28, 28);
      ctx.fillStyle = '#0a1a0c'; ctx.font = 'bold 9px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('FUEL', 0, 4);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(160,255,100,${0.25 + 0.15 * Math.sin(t * 4 + e.x)})`; ctx.beginPath(); ctx.arc(0, -16, 6, 0, 7); ctx.fill();
      break;
    }
    case 'rocket': {
      if (e.launched) {
        ctx.globalCompositeOperation = 'lighter';
        const fl = 16 + Math.random() * 12;
        ctx.fillStyle = 'rgba(255,150,50,0.85)'; ctx.beginPath(); ctx.moveTo(-5, 12); ctx.lineTo(0, 12 + fl); ctx.lineTo(5, 12); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        if (Math.random() < 0.6) world.particles.trail(e.x + (Math.random() - 0.5) * 4, e.y + 16, '#ff9a40');
      }
      ctx.fillStyle = '#d8dde8'; ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(6, -6); ctx.lineTo(6, 12); ctx.lineTo(-6, 12); ctx.lineTo(-6, -6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ff3d6e'; ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(6, -6); ctx.lineTo(-6, -6); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-6, 4); ctx.lineTo(-12, 13); ctx.lineTo(-6, 12); ctx.fill();
      ctx.beginPath(); ctx.moveTo(6, 4); ctx.lineTo(12, 13); ctx.lineTo(6, 12); ctx.fill();
      break;
    }
    case 'cannon': {
      const ang = Math.atan2(world.ship.y - e.y, world.ship.x - e.x);
      ctx.strokeStyle = '#9aa6c8'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(Math.cos(ang) * 22, -6 + Math.sin(ang) * 22); ctx.stroke();
      ctx.fillStyle = '#4b5578'; ctx.beginPath(); ctx.arc(0, 4, 16, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#2a3048'; ctx.fillRect(-18, 4, 36, 12);
      ctx.fillStyle = e.cd < 0.3 ? '#ff4060' : '#ffb0b8'; ctx.beginPath(); ctx.arc(0, -2, 4, 0, 7); ctx.fill();
      break;
    }
    case 'ufo': {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(120,255,170,0.15)'; ctx.beginPath(); ctx.ellipse(0, 0, 30, 14, 0, 0, 7); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#9fffd0'; ctx.beginPath(); ctx.ellipse(0, -5, 8, 7, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#3a4a5a'; ctx.beginPath(); ctx.ellipse(0, 0, 20, 7, 0, 0, 7); ctx.fill();
      for (let k = 0; k < 5; k++) {
        const a = t * 5 + k * 1.26;
        ctx.fillStyle = Math.cos(a) > 0 ? '#6dff9e' : '#1d5a3a';
        ctx.fillRect(Math.sin(a) * 15 - 1.5, -1.5, 3, 3);
      }
      break;
    }
    case 'meteor': {
      if (Math.random() < 0.7) world.particles.trail(e.x + 14, e.y - 8, '#ff8a30');
      ctx.rotate(e.spin);
      ctx.fillStyle = '#5a3a28'; ctx.beginPath();
      for (let k = 0; k < 9; k++) { const a = k / 9 * 6.283, r = 18 + ((k * 37) % 7); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#ffb547'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#3a2418'; ctx.beginPath(); ctx.arc(5, -4, 5, 0, 7); ctx.arc(-6, 6, 3, 0, 7); ctx.fill();
      break;
    }
    case 'laser': {
      ctx.fillStyle = '#3a2a4a'; ctx.fillRect(-10, -6, 20, 20);
      ctx.fillStyle = e.on ? '#ff6bff' : (e.timer < 0.35 && Math.floor(t * 20) % 2 ? '#ff6bff' : '#5a2a5a');
      ctx.fillRect(-5, -12, 10, 8);
      if (e.on) {
        const top = world.terrain.ceil ? heightAt(world.terrain.ceil, world.terrain.step, e.x) - y : -y;
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(255,90,255,0.25)'; ctx.fillRect(-9, top, 18, -top - 10);
        ctx.fillStyle = 'rgba(255,220,255,0.9)'; ctx.fillRect(-2.5, top, 5, -top - 10);
      }
      break;
    }
    case 'boss': drawBoss(ctx, e, t); break;
  }
  ctx.restore();
}

function drawBoss(ctx, e, t) {
  ctx.globalCompositeOperation = 'lighter';
  const pulse = 0.5 + 0.5 * Math.sin(t * 6);
  ctx.fillStyle = `rgba(255,40,40,${0.12 + pulse * 0.1})`; ctx.beginPath(); ctx.arc(0, 0, 110, 0, 7); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  const g = ctx.createLinearGradient(0, -80, 0, 80);
  g.addColorStop(0, '#5a5f78'); g.addColorStop(0.5, '#2a2d3e'); g.addColorStop(1, '#141622');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(-90, 0); ctx.lineTo(-40, -75); ctx.lineTo(60, -85); ctx.lineTo(95, -30); ctx.lineTo(95, 30); ctx.lineTo(60, 85); ctx.lineTo(-40, 75); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#ff4040'; ctx.lineWidth = 2; ctx.stroke();
  // Spikes.
  ctx.fillStyle = '#8a8fa8';
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(-20, s * 70); ctx.lineTo(-70, s * 105); ctx.lineTo(10, s * 78); ctx.fill(); }
  // Eye / core.
  const eg = ctx.createRadialGradient(-35, 0, 2, -35, 0, 34);
  eg.addColorStop(0, '#fff'); eg.addColorStop(0.3, '#ff6060'); eg.addColorStop(1, '#400000');
  ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(-35, 0, 30 + pulse * 3, 0, 7); ctx.fill();
  ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(-42, 0, 5, 16, 0, 0, 7); ctx.fill();
}

function drawHud(ctx, world, state, t, pal) {
  ctx.font = '600 18px "Courier New", monospace'; ctx.textBaseline = 'top';
  ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left';
  ctx.fillText('WYNIK ' + String(state.score).padStart(7, '0'), 18, 14);
  ctx.fillStyle = '#ffffffaa'; ctx.fillText('REKORD ' + String(Math.max(world.best, state.score)).padStart(7, '0'), 18, 38);
  // Lives.
  for (let i = 0; i < Math.min(state.lives, 8); i++) {
    ctx.fillStyle = '#7cf2ff'; ctx.beginPath();
    const x = W - 30 - i * 24, y = 24;
    ctx.moveTo(x + 10, y); ctx.lineTo(x - 8, y - 7); ctx.lineTo(x - 5, y); ctx.lineTo(x - 8, y + 7); ctx.closePath(); ctx.fill();
  }
  // Fuel bar.
  const fx = 300, fy = 16, fw = 300, fh = 14;
  ctx.fillStyle = '#ffffff22'; ctx.fillRect(fx, fy, fw, fh);
  const low = state.fuel < 20;
  ctx.fillStyle = low ? (Math.floor(t * 6) % 2 ? '#ff3040' : '#ff9090') : state.fuel < 45 ? '#ffd048' : '#6dff9e';
  ctx.fillRect(fx, fy, fw * state.fuel / 100, fh);
  ctx.strokeStyle = '#ffffff88'; ctx.lineWidth = 1; ctx.strokeRect(fx + 0.5, fy + 0.5, fw, fh);
  ctx.fillStyle = '#fff'; ctx.font = '600 13px "Courier New", monospace'; ctx.fillText('PALIWO', fx, fy + 18);
  // Progress.
  const sec = SECTORS[state.sector];
  ctx.textAlign = 'right'; ctx.fillStyle = pal.glow;
  ctx.fillText(`SEKTOR ${state.sector + 1}/8`, fx + fw, fy + 18);
  ctx.fillStyle = '#ffffff22'; ctx.fillRect(fx, fy + 36, fw, 3);
  ctx.fillStyle = pal.glow; ctx.fillRect(fx, fy + 36, fw * Math.min(1, world.camX / (sec.length - W)), 3);
  if (world.boss && world.boss.alive) {
    ctx.fillStyle = '#ff404033'; ctx.fillRect(W / 2 - 200, H - 26, 400, 10);
    ctx.fillStyle = '#ff4040'; ctx.fillRect(W / 2 - 200, H - 26, 400 * world.boss.hp / world.boss.maxHp, 10);
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText('ZOGGON', W / 2, H - 46);
  }
}

function drawControls(ctx, input) {
  const b = input.buttons;
  ctx.save();
  ctx.lineWidth = 2;
  const btn = (c, label, active, color) => {
    ctx.fillStyle = active ? color + '55' : '#ffffff14'; ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, 7); ctx.fill();
    ctx.strokeStyle = color + (active ? 'ff' : '88'); ctx.stroke();
    ctx.fillStyle = '#ffffffcc'; ctx.font = '700 15px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, c.x, c.y);
  };
  btn(b.fire, 'OGIEŃ', input.fire, '#7cf2ff');
  btn(b.bomb, 'BOMBA', input.bomb, '#ffd048');
  // Pause.
  ctx.fillStyle = '#ffffff33'; ctx.fillRect(b.pause.x - 8, b.pause.y - 10, 5, 20); ctx.fillRect(b.pause.x + 3, b.pause.y - 10, 5, 20);
  if (input.stick) {
    const o = input.stick.origin, p = input.stick.pos;
    ctx.strokeStyle = '#ffffff55'; ctx.beginPath(); ctx.arc(o.x, o.y, 70, 0, 7); ctx.stroke();
    const dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy), k = d > 70 ? 70 / d : 1;
    ctx.fillStyle = '#ffffff44'; ctx.beginPath(); ctx.arc(o.x + dx * k, o.y + dy * k, 28, 0, 7); ctx.fill();
  } else {
    ctx.fillStyle = '#ffffff55'; ctx.font = '600 13px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('◄ ▲ ▼ ► przesuń kciukiem', 150, H - 30);
  }
  ctx.restore();
}

export function drawCenterText(ctx, lines, t) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let y = H / 2 - (lines.length - 1) * 24;
  for (const l of lines) {
    ctx.font = l.font || '700 22px "Courier New", monospace';
    if (l.glow) { ctx.shadowColor = l.glow; ctx.shadowBlur = 24; }
    ctx.fillStyle = l.color || '#fff';
    if (l.blink && Math.floor(t * 2) % 2) { y += l.gap || 48; continue; }
    ctx.fillText(l.text, W / 2, y);
    ctx.shadowBlur = 0;
    y += l.gap || 48;
  }
  ctx.restore();
}
