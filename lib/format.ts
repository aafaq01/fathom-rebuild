export function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export const minutes = (ms: number) => `${Math.round(ms / 60000)} min`;

// Unnamed speakers get a neutral "S7", not a bare digit.
export const initials = (name: string) =>
  name.startsWith('Speaker ') ? `S${name.slice(8)}` : name.split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase();
