import { SECTORS, SCROLL_SPEED } from './sectors.js';
import { buildTerrain } from './terrain.js';
import { circleHit, hitsTerrain } from './collide.js';
import { makeShip, makeBullet, makeBomb, makeEnemy, updateEntity, POINTS, GRAVITY } from './entities.js';
import { newGame, tickFuel, addFuel, addScore, loseLife, clearSector } from './state.js';
import { loadBest, saveBest } from './storage.js';
import { createInput } from './input.js';
import { createParticles } from './particles.js';
import { audio } from './audio.js';
import { renderWorld, drawCenterText, W, H } from './render.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
let scale = 1, offX = 0, offY = 0, portrait = false;

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const vw = window.innerWidth, vh = window.innerHeight;
  portrait = vh > vw * 1.05 && matchMedia('(pointer: coarse)').matches;
  canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
  canvas.style.width = vw + 'px'; canvas.style.height = vh + 'px';
  scale = Math.min(vw / W, vh / H);
  offX = (vw - W * scale) / 2; offY = (vh - H * scale) / 2;
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offX, dpr * offY);
  ctx.imageSmoothingEnabled = true;
}
window.addEventListener('resize', resize);
resize();

const input = createInput(canvas, { keyTarget: window, toLogical: (x, y) => ({ x: (x - offX) / scale, y: (y - offY) / scale }) });

const state = newGame();
let world = null, phaseTimer = 0, paused = false, t = 0, lastLifeSfx = 0;
const debugFps = new URLSearchParams(location.search).has('fps');
let fps = 60;

function buildWorld() {
  const terrain = buildTerrain(state.sector);
  const sec = SECTORS[state.sector];
  const w = {
    terrain, camX: 0, ship: makeShip(), bullets: [], bombs: [], shots: [], enemies: [],
    pending: terrain.objects.slice(), particles: world?.particles || createParticles(),
    shake: 0, flash: 0, best: loadBest(), boss: null, exiting: false,
  };
  w.particles.clear();
  w.ship.inv = 2;
  if (sec.boss) w.bossPending = true;
  return w;
}

function startGame() {
  Object.assign(state, newGame());
  world = buildWorld();
  state.phase = 'intro'; phaseTimer = 2.2;
  audio.startMusic();
}

function explode(x, y, color, big = false) {
  world.particles.burst(x, y, '#ffffff', big ? 40 : 10, big ? 420 : 300, 0.5, 3);
  world.particles.burst(x, y, color, big ? 90 : 26, big ? 380 : 240, big ? 1.4 : 0.9, big ? 5 : 3.5);
  world.shake = Math.max(world.shake, big ? 22 : 7);
  world.flash = Math.max(world.flash, big ? 0.6 : 0.12);
  audio.sfx(big ? 'big' : 'boom');
}

const ENEMY_COLOR = { tank: '#b6ff6a', rocket: '#ff7a40', cannon: '#ff4060', ufo: '#6dff9e', meteor: '#ffb547', laser: '#ff6bff', boss: '#ff4040' };

function damage(e, amount) {
  e.hp -= amount; e.flash = 0.06;
  if (e.hp > 0) { audio.sfx('hit'); return; }
  e.alive = false;
  explode(e.x, e.y, ENEMY_COLOR[e.type], e.type === 'boss');
  if (e.type === 'boss') world.shots = [];
  if (e.type === 'tank') { addFuel(state); audio.sfx('fuel'); }
  const lives = addScore(state, POINTS[e.type]);
  if (lives) { audio.sfx('life'); lastLifeSfx = 1.5; }
}

function killShip() {
  const s = world.ship;
  if (!s.alive) return;
  s.alive = false;
  explode(s.x, s.y, '#7cf2ff', true);
  saveBest(state.score);
  loseLife(state);
  phaseTimer = 2.4;
}

function update(dt) {
  t += dt;
  world.particles.update(dt);
  world.shake = Math.max(0, world.shake - 60 * dt);
  world.flash = Math.max(0, world.flash - 2.5 * dt);
  lastLifeSfx = Math.max(0, lastLifeSfx - dt);

  if (state.phase === 'intro') { phaseTimer -= dt; if (phaseTimer <= 0) state.phase = 'play'; }
  if (state.phase === 'dead' || state.phase === 'over') {
    phaseTimer -= dt;
    stepProjectiles(dt);
    if (state.phase === 'dead' && phaseTimer <= 0) { world = buildWorld(); state.phase = 'intro'; phaseTimer = 1.8; }
    return;
  }
  if (state.phase === 'sectorClear') {
    phaseTimer -= dt;
    world.ship.x += 500 * dt; world.camX += SCROLL_SPEED * dt;
    if (Math.random() < 0.8) world.particles.trail(world.ship.x - 16, world.ship.y, '#ffa040');
    if (phaseTimer <= 0) { world = buildWorld(); state.phase = 'intro'; phaseTimer = 2.2; }
    return;
  }
  if (state.phase === 'win') { phaseTimer -= dt; return; }
  if (state.phase !== 'play' && state.phase !== 'intro') return;

  const sec = SECTORS[state.sector], s = world.ship, end = sec.length - W;
  // Camera.
  const prevCam = world.camX;
  world.camX = Math.min(end, world.camX + SCROLL_SPEED * dt);
  s.x += world.camX - prevCam;

  // Ship control.
  if (s.alive) {
    if (state.fuel > 0) {
      s.vx = input.axis.x * 300; s.vy = input.axis.y * 300;
    } else {
      s.vx *= 0.98; s.vy = Math.min(500, s.vy + GRAVITY * 0.5 * dt);
    }
    s.thrust = input.axis.x;
    s.tilt = (s.tilt || 0) + ((s.vy / 300) * 0.25 - (s.tilt || 0)) * Math.min(1, dt * 10);
    s.x += s.vx * dt; s.y += s.vy * dt;
    s.x = Math.max(world.camX + 30, Math.min(world.camX + 620, s.x));
    s.y = Math.max(20, Math.min(530, s.y));
    s.inv = Math.max(0, s.inv - dt);
    s.fireCd -= dt; s.bombCd -= dt;
    if (state.phase === 'play') {
      if (state.fuel > 0) tickFuel(state, dt);
      if (input.fire && s.fireCd <= 0) { world.bullets.push(makeBullet(s.x + 24, s.y + 2)); s.fireCd = 0.12; audio.sfx('shot'); }
      if (input.bomb && s.bombCd <= 0) { world.bombs.push(makeBomb(s.x, s.y + 10, Math.max(150, SCROLL_SPEED + s.vx * 0.5))); s.bombCd = 0.45; audio.sfx('bomb'); }
      if (state.fuel < 20 && Math.floor(t * 2) !== Math.floor((t - dt) * 2)) audio.sfx('alarm');
    }
    world.particles.trail(s.x - 16, s.y + (Math.random() - 0.5) * 4, '#ffa040');
    if (hitsTerrain(s.x, s.y, s.r * 0.75, world.terrain)) killShip();
  }

  // Activate enemies as they come into view.
  while (world.pending.length && world.pending[0].x < world.camX + W + 120) world.enemies.push(makeEnemy(world.pending.shift()));
  if (world.bossPending && world.camX >= end) {
    world.bossPending = false;
    world.boss = makeEnemy({ type: 'boss', x: world.camX + W - 130, y: 220 });
    world.enemies.push(world.boss);
  }

  const spawn = sh => world.shots.push(sh);
  for (const e of world.enemies) {
    updateEntity(e, dt, s, spawn);
    if (e.flash) e.flash -= dt;
    if (e.type === 'boss') e.x = world.camX + W - 130;
    if (e.x < world.camX - 150 || e.y < -80 || e.y > H + 80) e.alive = false;
    if (e.type === 'rocket' && e.launched && world.terrain.ceil && hitsTerrain(e.x, e.y - 14, 2, world.terrain)) { e.alive = false; explode(e.x, e.y, ENEMY_COLOR.rocket); }
    if (e.type === 'meteor' && hitsTerrain(e.x, e.y, e.r * 0.6, world.terrain)) { e.alive = false; explode(e.x, e.y, ENEMY_COLOR.meteor); }
    if (!s.alive || s.inv > 0 || !e.alive) continue;
    if (e.type === 'laser') {
      if (e.on && Math.abs(s.x - e.x) < 10 + s.r * 0.6) {
        const top = world.terrain.ceil ? 0 : -Infinity;
        if (s.y < e.y && s.y > top) killShip();
      }
    } else if (circleHit({ x: s.x, y: s.y, r: s.r * 0.7 }, e)) { if (e.type !== 'boss') damage(e, 99); killShip(); }
  }
  stepProjectiles(dt);
  world.enemies = world.enemies.filter(e => e.alive);

  // Sector finished?
  if (state.phase === 'play' && s.alive) {
    const bossDone = SECTORS[state.sector].boss ? (world.boss && !world.boss.alive) : true;
    if (world.camX >= end && bossDone) {
      if (!world.exitTimer) world.exitTimer = SECTORS[state.sector].boss ? 2.5 : 0.01;
      world.exitTimer -= dt;
      if (world.exitTimer <= 0) {
        addScore(state, 1000 + Math.round(state.fuel) * 10);
        saveBest(state.score);
        clearSector(state);
        phaseTimer = state.phase === 'win' ? 999 : 2.6;
      }
    }
  }
}

function stepProjectiles(dt) {
  const s = world.ship, terr = world.terrain;
  for (const b of world.bullets) {
    updateEntity(b, dt, s);
    if (b.x > world.camX + W + 40) b.alive = false;
    else if (hitsTerrain(b.x, b.y, 2, terr)) { b.alive = false; world.particles.burst(b.x, b.y, '#7cf2ff', 5, 150, 0.3, 2); }
    else for (const e of world.enemies) if (e.alive && e.type !== 'laser' && circleHit(b, e)) { b.alive = false; damage(e, 1); break; }
  }
  for (const b of world.bombs) {
    updateEntity(b, dt, s);
    if (b.y > H + 40) b.alive = false;
    let hit = null;
    for (const e of world.enemies) if (e.alive && circleHit({ x: b.x, y: b.y, r: b.r + 6 }, e)) { hit = e; break; }
    if (hit) { b.alive = false; damage(hit, 3); }
    else if (hitsTerrain(b.x, b.y, 3, terr)) {
      b.alive = false; explode(b.x, b.y, '#ffd048');
      for (const e of world.enemies) if (e.alive && Math.hypot(e.x - b.x, e.y - b.y) < 45 + e.r && e.type !== 'boss') damage(e, 3);
    }
  }
  for (const sh of world.shots) {
    updateEntity(sh, dt, s);
    if (sh.x < world.camX - 40 || sh.x > world.camX + W + 40 || sh.y < -40 || sh.y > H + 40 || hitsTerrain(sh.x, sh.y, 2, terr)) sh.alive = false;
    else if (s.alive && s.inv <= 0 && circleHit(sh, { x: s.x, y: s.y, r: s.r * 0.6 })) { sh.alive = false; killShip(); }
  }
  world.bullets = world.bullets.filter(b => b.alive);
  world.bombs = world.bombs.filter(b => b.alive);
  world.shots = world.shots.filter(b => b.alive);
}

// ---------- Screens ----------
function drawTitle() {
  ctx.fillStyle = '#05030f'; ctx.fillRect(-offX / scale, -offY / scale, W + 2 * offX / scale, H + 2 * offY / scale);
  if (world) renderWorld(ctx, world, state, { touched: false, hideHud: true, buttons: input.buttons }, t);
  drawCenterText(ctx, [
    { text: 'ZOGGON', font: '900 84px "Courier New", monospace', color: '#7cf2ff', glow: '#7cf2ff', gap: 70 },
    { text: '2 0 2 6', font: '700 26px "Courier New", monospace', color: '#ff6bff', glow: '#ff6bff', gap: 60 },
    { text: 'REKORD ' + String(world ? world.best : 0).padStart(7, '0'), color: '#ffd048', gap: 56 },
    { text: 'DOTKNIJ, ABY ZACZĄĆ', blink: true, gap: 44 },
    { text: 'na podstawie gry Gundolfa Kiefera (C64, 1989)', font: '14px system-ui, sans-serif', color: '#ffffff88' },
  ], t);
}

function frame() {
  // Letterbox background.
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.restore();
  if (portrait) {
    drawCenterText(ctx, [{ text: '⟳', font: '64px system-ui', gap: 80 }, { text: 'OBRÓĆ TELEFON POZIOMO', color: '#7cf2ff' }], t);
    return;
  }
  if (state.phase === 'title') { drawTitle(); return; }
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
  renderWorld(ctx, world, state, input, t);
  const sec = SECTORS[state.sector];
  if (state.phase === 'intro') drawCenterText(ctx, [{ text: `SEKTOR ${state.sector + 1}`, font: '900 44px "Courier New", monospace', color: sec.palette.glow, glow: sec.palette.glow, gap: 56 }, { text: sec.name }, ...(sec.boss ? [{ text: 'NA KOŃCU CZEKA ZOGGON', color: '#ff4040' }] : [])], t);
  if (state.phase === 'sectorClear') drawCenterText(ctx, [{ text: 'SEKTOR ZALICZONY', font: '900 40px "Courier New", monospace', color: '#6dff9e', glow: '#6dff9e', gap: 56 }, { text: 'BONUS ZA PALIWO' }], t);
  if (state.phase === 'over' && phaseTimer < 0.8) drawCenterText(ctx, [{ text: 'KONIEC GRY', font: '900 52px "Courier New", monospace', color: '#ff4060', glow: '#ff4060', gap: 64 }, { text: 'WYNIK ' + state.score, gap: 50 }, { text: 'DOTKNIJ, ABY ZAGRAĆ PONOWNIE', blink: true }], t);
  if (state.phase === 'win') drawCenterText(ctx, [{ text: 'ZOGGON POKONANY!', font: '900 46px "Courier New", monospace', color: '#ffd048', glow: '#ffd048', gap: 60 }, { text: 'WYNIK ' + state.score, gap: 50 }, { text: 'DOTKNIJ, ABY ZAGRAĆ PONOWNIE', blink: true }], t);
  if (lastLifeSfx > 0) { ctx.fillStyle = '#6dff9e'; ctx.font = '700 22px "Courier New", monospace'; ctx.textAlign = 'center'; ctx.fillText('+1 ŻYCIE', W / 2, 120); }
  if (paused) drawCenterText(ctx, [{ text: 'PAUZA', font: '900 52px "Courier New", monospace', glow: '#7cf2ff', gap: 64 }, { text: 'DOTKNIJ, ABY GRAĆ DALEJ', blink: true, gap: 44 }, { text: '♪ MUZYKA: ' + (audio.musicOn ? 'WŁ.' : 'WYŁ.') + '  (dotknij tutaj lub M)', font: '600 17px system-ui', color: '#ffd048' }], t);
  if (debugFps) { ctx.fillStyle = '#0f0'; ctx.font = '12px monospace'; ctx.textAlign = 'left'; ctx.fillText(fps.toFixed(0) + ' fps', 8, H - 16); }
  ctx.restore();
}

// ---------- Loop ----------
const STEP = 1 / 60;
let acc = 0, last = performance.now();
function loop(now) {
  let dt = (now - last) / 1000; last = now;
  dt = Math.min(dt, 0.1);
  fps = fps * 0.95 + (1 / Math.max(dt, 0.001)) * 0.05;
  if (input.consumePause() && world && ['play', 'intro'].includes(state.phase)) setPaused(!paused);
  if (portrait && world && ['play', 'intro'].includes(state.phase)) setPaused(true);
  if (!paused && state.phase !== 'title') {
    acc += dt;
    while (acc >= STEP) { update(STEP); acc -= STEP; }
  } else { t += dt; acc = 0; }
  frame();
  requestAnimationFrame(loop);
}

function setPaused(p) {
  if (paused === p) return;
  paused = p;
  input.reset();
  p ? audio.suspend() : audio.resume();
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (world && ['play', 'intro'].includes(state.phase)) setPaused(true); else audio.suspend(); }
  else if (!paused) audio.resume();
});

const unlockAudio = () => audio.unlock(!paused && !portrait);
canvas.addEventListener('pointerup', unlockAudio);
canvas.addEventListener('pointerdown', e => {
  if (portrait) { unlockAudio(); return; }
  if (state.phase === 'title') { audio.unlock(true); startGame(); return; }
  unlockAudio();
  if (paused) {
    input.consumePause();
    const y = (e.clientY - offY) / scale;
    if (y > H / 2 + 70) audio.toggleMusic(); else setPaused(false);
    return;
  }
  if ((state.phase === 'over' && phaseTimer < 0.8) || (state.phase === 'win' && phaseTimer < 997)) { state.phase = 'title'; world.best = loadBest(); audio.stopMusic(); }
});
window.addEventListener('keydown', e => {
  unlockAudio();
  if (e.code === 'KeyM') audio.toggleMusic();
  if (state.phase === 'title' && (e.code === 'Space' || e.code === 'Enter')) { startGame(); return; }
  if (paused && (e.code === 'Space' || e.code === 'Enter')) { input.consumePause(); setPaused(false); }
  if (((state.phase === 'over' && phaseTimer < 0.8) || (state.phase === 'win' && phaseTimer < 997)) && e.code === 'Enter') { state.phase = 'title'; world.best = loadBest(); audio.stopMusic(); }
});

// Title backdrop: an idle sector 1 scrolling behind the logo.
world = buildWorld();
requestAnimationFrame(t0 => { last = t0; requestAnimationFrame(loop); });

// Title screen scroll animation.
setInterval(() => { if (state.phase === 'title' && world) world.camX = (world.camX + 2) % 12000; }, 16);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
window.__zoggon = { state, get world() { return world; }, input, audioState: () => audio.state };
