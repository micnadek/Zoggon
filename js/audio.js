// Chiptune sound in the spirit of the C64 SID chip, generated with WebAudio.
let ctx = null, master = null, musicGain = null, sfxGain = null, noiseBuf = null;
let musicOn = true, timer = null, step = 0, nextTime = 0;

const BPM = 138, STEP_LEN = 60 / BPM / 4;
const N = n => 440 * Math.pow(2, (n - 69) / 12); // MIDI note -> Hz

// Original 4-bar loop in A minor: Am – F – C – G, 16 steps per bar.
const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
const BASS = [45, 0, 45, 57, 0, 45, 55, 0, 45, 0, 45, 57, 0, 55, 52, 0];
const LEAD = [
  76, 0, 74, 76, 0, 72, 0, 69, 0, 0, 72, 74, 0, 72, 69, 0,
  77, 0, 76, 74, 0, 72, 0, 74, 0, 0, 0, 72, 69, 0, 65, 0,
  72, 0, 74, 76, 0, 79, 0, 76, 0, 74, 0, 72, 0, 74, 76, 0,
  79, 0, 78, 79, 0, 74, 0, 71, 0, 0, 74, 0, 79, 0, 83, 0,
];
const DRUM = [1, 0, 3, 0, 2, 0, 3, 1, 1, 0, 3, 0, 2, 0, 3, 3]; // 1 kick, 2 snare, 3 hat

export const audio = {
  get state() { return ctx ? ctx.state : 'none'; },
  // Creates the AudioContext on a user gesture; resumes it only when allowed.
  unlock(resume = true) {
    try {
      if (!ctx) {
        const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
        musicGain = ctx.createGain(); musicGain.gain.value = 0.32; musicGain.connect(master);
        sfxGain = ctx.createGain(); sfxGain.gain.value = 0.6; sfxGain.connect(master);
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      if (resume && ctx.state === 'suspended') ctx.resume();
      else if (!resume && ctx.state === 'running') ctx.suspend();
    } catch { ctx = null; }
  },
  suspend() { try { ctx?.suspend(); } catch { /* ignore */ } },
  resume() { try { ctx?.resume(); } catch { /* ignore */ } },
  get musicOn() { return musicOn; },
  toggleMusic() { musicOn = !musicOn; if (musicGain) musicGain.gain.value = musicOn ? 0.32 : 0; return musicOn; },
  startMusic() {
    if (!ctx || timer) return;
    step = 0; nextTime = ctx.currentTime + 0.05;
    timer = setInterval(schedule, 25);
  },
  stopMusic() { clearInterval(timer); timer = null; },
  sfx(name) {
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    switch (name) {
      case 'shot': tone('square', 1400, 300, t, 0.07, 0.12); break;
      case 'bomb': tone('triangle', 700, 120, t, 0.25, 0.25); break;
      case 'boom': noise(t, 0.5, 1800, 0.7); tone('sine', 120, 35, t, 0.4, 0.5); break;
      case 'big': noise(t, 1.4, 900, 1); tone('sine', 90, 25, t, 1.2, 0.7); break;
      case 'hit': tone('square', 300, 200, t, 0.05, 0.12); break;
      case 'fuel': [0, 4, 7, 12].forEach((n, i) => tone('square', N(72 + n), N(72 + n), t + i * 0.05, 0.06, 0.12)); break;
      case 'life': [0, 4, 7, 12, 16, 19].forEach((n, i) => tone('square', N(76 + n), N(76 + n), t + i * 0.07, 0.08, 0.14)); break;
      case 'alarm': tone('square', 880, 880, t, 0.08, 0.08); break;
    }
  },
};

function tone(type, f0, f1, t, dur, vol, dest = sfxGain) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(dest);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise(t, dur, cutoff, vol, dest = sfxGain) {
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; f.type = 'lowpass';
  f.frequency.setValueAtTime(cutoff, t);
  f.frequency.exponentialRampToValueAtTime(80, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest);
  s.start(t); s.stop(t + dur);
}

function schedule() {
  if (!ctx) return;
  while (nextTime < ctx.currentTime + 0.12) {
    const bar = Math.floor(step / 16) % 4, s = step % 16, t = nextTime;
    // Classic C64 arpeggio: cycle chord notes very fast.
    const chord = CHORDS[bar];
    for (let k = 0; k < 3; k++) tone('square', N(chord[(s + k) % 3] + 12), N(chord[(s + k) % 3] + 12), t + k * STEP_LEN / 3, STEP_LEN / 3, 0.07, musicGain);
    if (BASS[s]) tone('sawtooth', N(BASS[s] - (bar === 1 ? 4 : bar === 2 ? 9 : bar === 3 ? -2 : 0)), N(BASS[s] - (bar === 1 ? 4 : bar === 2 ? 9 : bar === 3 ? -2 : 0)), t, STEP_LEN * 1.6, 0.22, musicGain);
    const lead = LEAD[(step % 64)];
    if (lead) leadNote(N(lead), t, STEP_LEN * 2.2);
    const d = DRUM[s];
    if (d === 1) tone('sine', 150, 40, t, 0.18, 0.7, musicGain);
    else if (d === 2) noise(t, 0.16, 5000, 0.35, musicGain);
    else if (d === 3) noise(t, 0.04, 9000, 0.12, musicGain);
    step++; nextTime += STEP_LEN;
  }
}

function leadNote(f, t, dur) {
  // Two detuned pulses + vibrato give a SID-like lead.
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.12, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  g.connect(musicGain);
  const lfo = ctx.createOscillator(), lg = ctx.createGain();
  lfo.frequency.value = 6; lg.gain.value = f * 0.012; lfo.connect(lg);
  for (const det of [-6, 6]) {
    const o = ctx.createOscillator();
    o.type = 'square'; o.frequency.value = f; o.detune.value = det;
    lg.connect(o.frequency); o.connect(g);
    o.start(t); o.stop(t + dur + 0.02);
  }
  lfo.start(t); lfo.stop(t + dur + 0.02);
}
