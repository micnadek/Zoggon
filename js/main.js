import { SECTORS, SCROLL_SPEED } from './sectors.js';
import { buildTerrain } from './terrain.js';
import { circleHit, hitsTerrain } from './collide.js';
import { makeShip, makeBullet, makeBomb, makeEnemy, updateEntity, POINTS, GRAVITY } from './entities.js';
import { newGame, tickFuel, addFuel, addScore, loseLife, clearSector } from './state.js';
import { loadBest, saveBest, loadVehicle, saveVehicle, VEHICLES } from './storage.js';
import { createInput } from './input.js';
import { createParticles } from './particles.js';
import { audio } from './audio.js';
import { renderWorld, drawCenterText, drawVehicle, drawButton, W, H } from './render.js';

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
let world = null, phaseTimer = 0, paused = false, t = 0, lastLifeSfx = 0, vehicle = loadVehicle();
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
  w.ship.vehicle = vehicle;
  w.fighterTimer = 4;
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

const ENEMY_COLOR = { fighter: '#ff4060', tank: '#b6ff6a', rocket: '#ff7a40', cannon: '#ff4060', ufo: '#6dff9e', meteor: '#ffb547', laser: '#ff6bff', boss: '#ff4040' };

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
    if (Math.random() < 0.35) world.particles.trail(world.ship.x - 10, world.ship.y - 10, '#8899aa');
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
    s.tilt = (s.tilt || 0) + ((s.vx / 300) * 0.22 + (s.vy / 300) * 0.06 - (s.tilt || 0)) * Math.min(1, dt * 8);
    s.x += s.vx * dt; s.y += s.vy * dt;
    s.x = Math.max(world.camX + 30, Math.min(world.camX + 620, s.x));
    s.y = Math.max(20, Math.min(530, s.y));
    s.inv = Math.max(0, s.inv - dt);
    s.fireCd -= dt; s.bombCd -= dt;
    if (state.phase === 'play') {
      if (state.fuel > 0) tickFuel(state, dt);
      if (input.fire && s.fireCd <= 0) { world.bullets.push(makeBullet(s.x + 28, s.y + 5)); s.fireCd = 0.12; audio.sfx('shot'); }
      if (input.bomb && s.bombCd <= 0) { world.bombs.push(makeBomb(s.x, s.y + 10, Math.max(150, SCROLL_SPEED + s.vx * 0.5))); s.bombCd = 0.45; audio.sfx('bomb'); }
      if (state.fuel < 20 && Math.floor(t * 2) !== Math.floor((t - dt) * 2)) audio.sfx('alarm');
    }
    if (Math.random() < 0.35) world.particles.trail(s.x - 10, s.y - 10, '#8899aa');
    if (hitsTerrain(s.x, s.y, s.r * 0.75, world.terrain)) killShip();
  }

  // Activate enemies as they come into view.
  while (world.pending.length && world.pending[0].x < world.camX + W + 120) world.enemies.push(makeEnemy(world.pending.shift()));
  if (world.bossPending && world.camX >= end) {
    world.bossPending = false;
    world.boss = makeEnemy({ type: 'boss', x: world.camX + W - 130, y: 220 });
    world.enemies.push(world.boss);
  }

  // Fighters come from the right at the ship's altitude; camping high or far right brings them sooner.
  if (state.phase === 'play' && s.alive && world.camX < end) {
    const camping = s.y < 170 || s.x - world.camX > 480;
    world.fighterTimer -= dt * (camping ? 3 : 1);
    if (world.fighterTimer <= 0) {
      world.fighterTimer = Math.max(3, 8 - state.sector * 0.6);
      world.enemies.push(makeEnemy({ type: 'fighter', x: world.camX + W + 40, y: s.y }));
    }
  }

  const spawn = sh => world.shots.push(sh);
  for (const e of world.enemies) {
    updateEntity(e, dt, s, spawn);
    if (e.flash) e.flash -= dt;
    if (e.type === 'boss') e.x = world.camX + W - 130;
    if (e.x < world.camX - 150 || e.y < -80 || e.y > H + 80) e.alive = false;
    if (e.type === 'rocket' && e.launched && world.terrain.ceil && hitsTerrain(e.x, e.y - 14, 2, world.terrain)) { e.alive = false; explode(e.x, e.y, ENEMY_COLOR.rocket); }
    if (e.type === 'fighter' && hitsTerrain(e.x, e.y, e.r * 0.6, world.terrain)) { e.alive = false; explode(e.x, e.y, ENEMY_COLOR.fighter); }
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
const VEHICLE_NAMES = { heli: 'HELIKOPTER', plane: 'SAMOLOT', car: 'LATAJĄCE AUTO' };
const titleCards = VEHICLES.map((v, i) => ({ v, x: W / 2 + (i - 1) * 230, y: 300, w: 200, h: 150 }));
const startBtn = { x: W / 2, y: 452, w: 280, h: 58 };
const pauseBtns = {
  resume: { x: W / 2, y: 255, w: 320, h: 56 },
  music: { x: W / 2, y: 325, w: 320, h: 56 },
  menu: { x: W / 2, y: 395, w: 320, h: 56 },
};
const inRect = (b, p) => Math.abs(p.x - b.x) <= b.w / 2 && Math.abs(p.y - b.y) <= b.h / 2;
const toLogical = e => ({ x: (e.clientX - offX) / scale, y: (e.clientY - offY) / scale });

function drawTitle() {
  ctx.fillStyle = '#05030f'; ctx.fillRect(-offX / scale, -offY / scale, W + 2 * offX / scale, H + 2 * offY / scale);
  if (world) renderWorld(ctx, world, state, { touched: false, hideHud: true, buttons: input.buttons }, t);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = '#7cf2ff'; ctx.shadowBlur = 20;
  ctx.font = '900 76px "Courier New", monospace'; ctx.fillStyle = '#7cf2ff'; ctx.fillText('ZOGGON', W / 2, 78);
  ctx.shadowColor = '#ff6bff';
  ctx.font = '700 24px "Courier New", monospace'; ctx.fillStyle = '#ff6bff'; ctx.fillText('2 0 2 6', W / 2, 128);
  ctx.shadowBlur = 0;
  ctx.font = '700 18px "Courier New", monospace'; ctx.fillStyle = '#ffd048';
  ctx.fillText('REKORD ' + String(world ? world.best : 0).padStart(7, '0') + '   ·   WYBIERZ POJAZD', W / 2, 186);
  for (const c of titleCards) {
    const sel = c.v === vehicle;
    ctx.fillStyle = sel ? 'rgba(124,242,255,0.18)' : 'rgba(10,10,30,0.65)';
    ctx.strokeStyle = sel ? '#7cf2ff' : '#ffffff44'; ctx.lineWidth = sel ? 3 : 1.5;
    ctx.beginPath(); ctx.roundRect(c.x - c.w / 2, c.y - c.h / 2, c.w, c.h, 14); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.translate(c.x, c.y - 12 + Math.sin(t * 3 + c.x) * 3); ctx.scale(2, 2);
    drawVehicle(ctx, c.v, t, sel ? 0.6 : 0);
    ctx.restore();
    ctx.font = '700 16px "Courier New", monospace'; ctx.fillStyle = sel ? '#ffffff' : '#ffffffaa';
    ctx.fillText(VEHICLE_NAMES[c.v], c.x, c.y + 56);
  }
  drawButton(ctx, startBtn, '▶  START', '#6dff9e', Math.floor(t * 2) % 2 === 0);
  ctx.font = '13px system-ui, sans-serif'; ctx.fillStyle = '#ffffff77';
  ctx.fillText('na podstawie gry Gundolfa Kiefera (C64, 1989)', W / 2, 515);
  ctx.restore();
}

function drawPauseMenu() {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = '#7cf2ff'; ctx.shadowBlur = 16;
  ctx.font = '900 52px "Courier New", monospace'; ctx.fillStyle = '#fff'; ctx.fillText('PAUZA', W / 2, 165);
  ctx.restore();
  drawButton(ctx, pauseBtns.resume, '▶  GRAJ DALEJ', '#6dff9e');
  drawButton(ctx, pauseBtns.music, '♪  MUZYKA: ' + (audio.musicOn ? 'WŁ.' : 'WYŁ.'), '#ffd048');
  drawButton(ctx, pauseBtns.menu, '⌂  MENU', '#ff6bff');
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
  if (state.phase === 'over' && phaseTimer < 0.8) drawCenterText(ctx, [{ text: 'KONIEC GRY', font: '900 52px "Courier New", monospace', color: '#ff4060', glow: '#ff4060', gap: 64 }, { text: 'WYNIK ' + state.score, gap: 50 }, { text: 'DOTKNIJ, ABY WRÓCIĆ DO MENU', blink: true }], t);
  if (state.phase === 'win') drawCenterText(ctx, [{ text: 'ZOGGON POKONANY!', font: '900 46px "Courier New", monospace', color: '#ffd048', glow: '#ffd048', gap: 60 }, { text: 'WYNIK ' + state.score, gap: 50 }, { text: 'DOTKNIJ, ABY WRÓCIĆ DO MENU', blink: true }], t);
  if (lastLifeSfx > 0) { ctx.fillStyle = '#6dff9e'; ctx.font = '700 22px "Courier New", monospace'; ctx.textAlign = 'center'; ctx.fillText('+1 ŻYCIE', W / 2, 120); }
  if (paused) drawPauseMenu();
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

function goToTitle() {
  setPaused(false);
  audio.stopMusic();
  Object.assign(state, newGame());
  world = buildWorld();
  world.best = loadBest();
}

function chooseVehicle(v) { vehicle = v; saveVehicle(v); if (world) world.ship.vehicle = v; }
const canReturn = () => (state.phase === 'over' && phaseTimer < 0.8) || (state.phase === 'win' && phaseTimer < 997);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (world && ['play', 'intro'].includes(state.phase)) setPaused(true); else audio.suspend(); }
  else if (!paused) audio.resume();
});

const unlockAudio = () => audio.unlock(!paused && !portrait);
canvas.addEventListener('pointerup', unlockAudio);
canvas.addEventListener('pointerdown', e => {
  if (portrait) { unlockAudio(); return; }
  const p = toLogical(e);
  if (state.phase === 'title') {
    audio.unlock(true);
    const card = titleCards.find(c => inRect(c, p));
    if (card) { chooseVehicle(card.v); return; }
    if (inRect(startBtn, p)) { input.reset(); startGame(); }
    return;
  }
  unlockAudio();
  if (paused) {
    input.consumePause();
    if (inRect(pauseBtns.music, p)) audio.toggleMusic();
    else if (inRect(pauseBtns.menu, p)) goToTitle();
    else if (inRect(pauseBtns.resume, p) || Math.hypot(p.x - input.buttons.pause.x, p.y - input.buttons.pause.y) < input.buttons.pause.r * 1.25) setPaused(false);
    return;
  }
  if (canReturn()) goToTitle();
});
window.addEventListener('keydown', e => {
  unlockAudio();
  if (e.code === 'KeyM') audio.toggleMusic();
  if (state.phase === 'title') {
    const i = VEHICLES.indexOf(vehicle);
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') chooseVehicle(VEHICLES[(i + 2) % 3]);
    if (e.code === 'ArrowRight' || e.code === 'KeyD') chooseVehicle(VEHICLES[(i + 1) % 3]);
    if (e.code === 'Space' || e.code === 'Enter') { input.reset(); startGame(); }
    return;
  }
  if (paused && (e.code === 'Space' || e.code === 'Enter')) { input.consumePause(); setPaused(false); }
  if (paused && e.code === 'KeyQ') goToTitle();
  if (canReturn() && (e.code === 'Enter' || e.code === 'Space')) goToTitle();
});

// Title backdrop: an idle sector 1 scrolling behind the logo.
world = buildWorld();
requestAnimationFrame(t0 => { last = t0; requestAnimationFrame(loop); });

// Title screen scroll animation.
setInterval(() => { if (state.phase === 'title' && world) world.camX = (world.camX + 2) % 12000; }, 16);

if ('serviceWorker' in navigator && location.protocol === 'https:' && location.hostname !== 'appassets.androidplatform.net') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
window.__zoggon = {
  state, get world() { return world; }, input, audioState: () => audio.state,
  get paused() { return paused; },
  // Test hook: advance the simulation instantly by `seconds`.
  step(seconds) { for (let i = 0; i < Math.round(seconds / STEP); i++) update(STEP); },
};
