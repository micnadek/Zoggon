const DEAD = 0.15;

export function stickAxis(origin, point, radius = 70) {
  let x = (point.x - origin.x) / radius, y = (point.y - origin.y) / radius;
  const len = Math.hypot(x, y);
  if (len < DEAD) return { x: 0, y: 0 };
  if (len > 1) { x /= len; y /= len; }
  return { x, y };
}

export function createInput(target, { keyTarget = globalThis.window, toLogical } = {}) {
  const keys = new Set();
  const pointers = new Map(); // pointerId -> {role, origin?, pos}
  const input = {
    axis: { x: 0, y: 0 }, fire: false, bomb: false, pausePressed: false, touched: false,
    stick: null, // {origin, pos} for drawing
    buttons: { fire: { x: 0, y: 0, r: 0 }, bomb: { x: 0, y: 0, r: 0 }, pause: { x: 0, y: 0, r: 0 } },
    width: 960, height: 540,
    layout(w, h) {
      this.width = w; this.height = h;
      this.buttons.fire = { x: w - 105, y: h - 105, r: 68 };
      this.buttons.bomb = { x: w - 245, y: h - 70, r: 50 };
      this.buttons.pause = { x: w - 42, y: 78, r: 28 };
    },
    consumePause() { const p = this.pausePressed; this.pausePressed = false; return p; },
  };
  input.layout(960, 540);

  const near = (b, p) => Math.hypot(b.x - p.x, b.y - p.y) < b.r * 1.25;

  function recompute() {
    let ax = 0, ay = 0, fire = false, bomb = false, stick = null;
    for (const p of pointers.values()) {
      if (p.role === 'stick') { const a = stickAxis(p.origin, p.pos); ax = a.x; ay = a.y; stick = p; }
      else if (p.role === 'fire') fire = true;
      else if (p.role === 'bomb') bomb = true;
    }
    if (!stick) {
      ax = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
      ay = (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0);
    }
    input.axis = { x: ax, y: ay };
    input.stick = stick;
    input.fire = fire || keys.has('KeyZ') || keys.has('Space');
    input.bomb = bomb || keys.has('KeyX');
  }

  const logical = e => (toLogical ? toLogical(e.clientX, e.clientY) : { x: e.clientX, y: e.clientY });

  target.addEventListener('pointerdown', e => {
    e.preventDefault?.();
    input.touched = true;
    const pos = logical(e);
    let role;
    if (near(input.buttons.pause, pos)) { input.pausePressed = true; return; }
    if (pos.x < input.width / 2) role = 'stick';
    else role = near(input.buttons.bomb, pos) ? 'bomb' : 'fire';
    pointers.set(e.pointerId, { role, origin: pos, pos });
    recompute();
  });
  target.addEventListener('pointermove', e => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    p.pos = logical(e);
    recompute();
  });
  const up = e => { if (pointers.delete(e.pointerId)) recompute(); };
  target.addEventListener('pointerup', up);
  target.addEventListener('pointercancel', up);

  keyTarget?.addEventListener('keydown', e => {
    if (e.code === 'KeyP' || e.code === 'Escape') input.pausePressed = true;
    if (e.code?.startsWith('Arrow') || e.code === 'Space') e.preventDefault?.();
    keys.add(e.code); recompute();
  });
  keyTarget?.addEventListener('keyup', e => { keys.delete(e.code); recompute(); });
  keyTarget?.addEventListener('blur', () => { keys.clear(); pointers.clear(); recompute(); });
  input.reset = () => { keys.clear(); pointers.clear(); recompute(); };
  return input;
}
