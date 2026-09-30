'use client';
import { speakerName, type Speaker } from '@/lib/types';
import { clock, initials } from '@/lib/format';

// Named speakers get their color; unnamed ones a neutral "S7" chip so digits don't read as data.
export function Avatar({ speaker, size = 24 }: { speaker: Speaker; size?: number }) {
  const name = speakerName(speaker);
  return (
    <span
      title={name}
      className={`grid shrink-0 place-items-center rounded-full font-semibold ${speaker.name ? 'text-white' : 'bg-surface-2 text-muted ring-1 ring-line'}`}
      style={{ backgroundColor: speaker.name ? speaker.color : undefined, width: size, height: size, fontSize: size * 0.38 }}
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

// Native prompt: accessible, zero UI code. Empty input resets to the AI-suggested name.
export function askRename(speaker: Speaker, rename: (label: number, name: string) => void) {
  const v = window.prompt(`Rename ${speakerName(speaker)}\n(Saved in this browser only. Leave empty to reset.)`, speaker.name ?? '');
  if (v !== null) rename(speaker.label, v);
}

export function PencilButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(); }}
      aria-label={label} title={label}
      className="shrink-0 rounded px-1 text-muted opacity-0 transition-opacity hover:text-fg focus:opacity-100 group-hover/name:opacity-100"
    >✎</button>
  );
}
