const KEY = 'zoggon2026.best';
let memory = 0;
export function loadBest() {
  try {
    const v = parseInt(globalThis.localStorage?.getItem(KEY) ?? '', 10);
    if (Number.isFinite(v)) memory = Math.max(memory, v);
  } catch { /* storage unavailable: keep in memory */ }
  return memory;
}
export function saveBest(n) {
  memory = Math.max(memory, n);
  try { globalThis.localStorage?.setItem(KEY, String(memory)); } catch { /* ignore */ }
}
