'use client';
import { speakerName, type Speaker } from '@/lib/types';
import { clock, initials } from '@/lib/format';

export function Avatar({ speaker, size = 24 }: { speaker: Speaker; size?: number }) {
  const name = speakerName(speaker);
  return (
    <span
      title={name}
      className="grid shrink-0 place-items-center rounded-full font-semibold text-white"
      style={{ backgroundColor: speaker.color, width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials(name)}
    </span>
  );
}

export function TimeChip({ ms, onSeek }: { ms: number; onSeek: (ms: number) => void }) {
  return (
    <button
      onClick={() => onSeek(ms)}
      className="shrink-0 rounded-md bg-accent-soft px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-accent hover:brightness-95"
      aria-label={`Jump to ${clock(ms)}`}
    >
      {clock(ms)}
    </button>
  );
}
