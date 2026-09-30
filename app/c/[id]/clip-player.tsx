'use client';
import { useRef } from 'react';
import { clock } from '@/lib/format';

type Props = { kind: 'video' | 'audio'; src: string; start: number; end: number };

// Starts at `start`, pauses at `end`. ponytail: timeupdate fires ~4x/s, so the stop can overshoot by ~250ms.
export default function ClipPlayer({ kind, src, start, end }: Props) {
  const ref = useRef<HTMLMediaElement | null>(null);
  const armed = useRef(false);

  const media = {
    ref: (el: HTMLMediaElement | null) => { ref.current = el; },
    src,
    controls: true,
    preload: 'metadata',
    onLoadedMetadata: (e: React.SyntheticEvent<HTMLMediaElement>) => { e.currentTarget.currentTime = start / 1000; },
    // Only auto-stop when playback begins inside the clip, so seeking past it still plays freely.
    onPlay: (e: React.SyntheticEvent<HTMLMediaElement>) => { armed.current = e.currentTarget.currentTime < end / 1000; },
    onTimeUpdate: (e: React.SyntheticEvent<HTMLMediaElement>) => {
      if (armed.current && e.currentTarget.currentTime >= end / 1000) {
        armed.current = false;
        e.currentTarget.pause();
      }
    },
  };

  const replay = () => {
    const el = ref.current;
    if (!el) return;
    el.currentTime = start / 1000;
    el.play();
  };

  return (
    <div className="space-y-3">
      {kind === 'video' ? (
        <video {...media} playsInline className="aspect-video w-full rounded-xl bg-surface-2" />
      ) : (
        <audio {...media} className="w-full" />
      )}
      <button
        onClick={replay}
        className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        <span aria-hidden>▶</span> Play clip
        <span className="font-mono text-xs opacity-80">{clock(start)}–{clock(end)}</span>
      </button>
    </div>
  );
}
