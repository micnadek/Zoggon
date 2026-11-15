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

export const VEHICLES = ['heli', 'plane', 'car'];
const VKEY = 'zoggon2026.vehicle';
let vehicleMem = 'heli';
export function loadVehicle() {
  try {
    const v = globalThis.localStorage?.getItem(VKEY);
    if (VEHICLES.includes(v)) vehicleMem = v;
  } catch { /* ignore */ }
  return vehicleMem;
}
export function saveVehicle(v) {
  if (!VEHICLES.includes(v)) return;
  vehicleMem = v;
  try { globalThis.localStorage?.setItem(VKEY, v); } catch { /* ignore */ }
}
