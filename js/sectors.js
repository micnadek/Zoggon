// Scroll speed is 150 px/s, so 18000 px ≈ 120 s per sector.
export const SCROLL_SPEED = 150;
const S = (id, name, palette, cave, spawns, extra = {}) =>
  ({ id, name, length: 18000, palette, cave, spawns, ...extra });

export const SECTORS = [
  S(1, 'GÓRY KRYSZTAŁOWE', { sky: ['#0b0630', '#3a1260'], ground: '#1a0f3a', glow: '#7cf2ff' }, false,
    { tank: 1, rocket: 0.6, cannon: 0, ufo: 0, meteor: 0, laser: 0 }),
  S(2, 'POLE RAKIETOWE', { sky: ['#1a0010', '#5a1030'], ground: '#2a0a18', glow: '#ff5ea8' }, false,
    { tank: 1, rocket: 1.6, cannon: 0.3, ufo: 0, meteor: 0, laser: 0 }),
  S(3, 'ROJ SPODKÓW', { sky: ['#00150f', '#0a4a3a'], ground: '#06261d', glow: '#6dff9e' }, false,
    { tank: 1, rocket: 0.8, cannon: 0.4, ufo: 1.4, meteor: 0, laser: 0 }),
  S(4, 'JASKINIA ECHA', { sky: ['#050510', '#141432'], ground: '#1b1b3d', glow: '#b48cff' }, true,
    { tank: 1, rocket: 0.6, cannon: 0.8, ufo: 0.5, meteor: 0, laser: 0 }),
  S(5, 'DESZCZ METEORÓW', { sky: ['#1a0a00', '#5a2a05'], ground: '#2c1505', glow: '#ffb547' }, false,
    { tank: 1, rocket: 0.8, cannon: 0.6, ufo: 0.6, meteor: 1.6, laser: 0 }),
  S(6, 'BAZA ZOGGONA', { sky: ['#000d1f', '#06325e'], ground: '#0a1d33', glow: '#4fb8ff' }, false,
    { tank: 1.1, rocket: 1.4, cannon: 1.2, ufo: 0.8, meteor: 0.4, laser: 0 }),
  S(7, 'LABIRYNT', { sky: ['#140014', '#3d0a3d'], ground: '#250a25', glow: '#ff6bff' }, true,
    { tank: 1.2, rocket: 0.8, cannon: 1, ufo: 0.8, meteor: 0, laser: 1.2 }),
  S(8, 'TWIERDZA ZOGGONA', { sky: ['#1a0000', '#4a0505'], ground: '#2a0606', glow: '#ff4040' }, false,
    { tank: 1.2, rocket: 1.6, cannon: 1.4, ufo: 1, meteor: 0.8, laser: 0.6 }, { boss: true }),
];
