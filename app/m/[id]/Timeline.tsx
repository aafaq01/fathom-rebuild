'use client';
import { memo, useRef, useState, type RefObject } from 'react';
import { speakerName, type ActionItem, type Chapter, type Highlight, type Row, type Speaker } from '@/lib/types';
import { clock } from '@/lib/format';

type Props = {
  duration: number;
  rows: Row[];
  speakers: Speaker[];
  chapters: Chapter[];
  actions: ActionItem[];
  highlights: Highlight[];
  hits: Row[];
  hidden: Set<number>;
  playheadRef: RefObject<HTMLDivElement | null>;
  onSeek: (ms: number) => void;
  onToggleSpeaker: (label: number | null) => void;
  byLabel: Map<number, Speaker>;
};

const LABEL_W = 132; // px, label column; tracks start after it (+ 12px gap)

function Timeline({ duration, rows, speakers, chapters, actions, highlights, hits, hidden, playheadRef, onSeek, onToggleSpeaker, byLabel }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const pct = (ms: number) => `${(ms / duration) * 100}%`;
  const total = speakers.reduce((a, s) => a + s.talk_ms, 0) || 1;

  const msAt = (clientX: number) => {
    const r = overlayRef.current!.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * duration;
  };
  const track = 'relative rounded bg-surface-2 cursor-pointer';

  return (
    <section className="rounded-xl border border-line bg-surface p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="font-medium text-fg">Timeline</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rotate-45 bg-orange-500" /> action item</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-1 rounded-sm bg-accent" /> clip</span>
        {hits.length > 0 && <span className="flex items-center gap-1"><span className="h-2.5 w-0.5 bg-yellow-500" /> {hits.length} search hits</span>}
        <span className="ml-auto hidden sm:inline">Click anywhere to jump · click a name to filter</span>
      </div>

      <div
        className="relative grid gap-x-3 gap-y-1 text-xs"
        style={{ gridTemplateColumns: `${LABEL_W}px minmax(0,1fr)` }}
        onMouseMove={e => { if (overlayRef.current) { const r = overlayRef.current.getBoundingClientRect(); setHover(e.clientX >= r.left ? msAt(e.clientX) : null); } }}
        onMouseLeave={() => setHover(null)}
      >
        <div className="self-center text-muted">Chapters</div>
        <div className={`${track} h-6`} onClick={e => onSeek(msAt(e.clientX))}>
          {chapters.map((c, i) => (
            <button
              key={c.idx}
              title={`${clock(c.start_ms)} ${c.title}\n${c.summary}`}
              onClick={e => { e.stopPropagation(); onSeek(c.start_ms); }}
              className={`absolute inset-y-0 overflow-hidden truncate border-r-2 border-surface px-1.5 text-left text-[11px] leading-6 hover:brightness-95 ${i % 2 ? 'bg-accent-soft' : 'bg-accent-soft/60'}`}
              style={{ left: pct(c.start_ms), width: pct(c.end_ms - c.start_ms) }}
            >
              {c.title}
            </button>
          ))}
        </div>

        <div className="self-center text-muted">Markers</div>
        <div className={`${track} h-5`} onClick={e => onSeek(msAt(e.clientX))}>
          {hits.map(h => (
            <span key={`h${h.idx}`} className="pointer-events-none absolute inset-y-0 w-0.5 bg-yellow-500" style={{ left: pct(h.start_ms) }} />
          ))}
          {highlights.map(h => (
            <button
              key={h.id} title={`Clip: ${h.title}`}
              onClick={e => { e.stopPropagation(); onSeek(h.start_ms); }}
              className="absolute inset-y-0.5 min-w-1 rounded-sm bg-accent"
              style={{ left: pct(h.start_ms), width: pct(h.end_ms - h.start_ms) }}
            />
          ))}
          {actions.map(a => (
            <button
              key={a.id}
              title={`Action${a.owner !== null ? ` (${speakerName(byLabel.get(a.owner), a.owner)})` : ''}: ${a.text}`}
              onClick={e => { e.stopPropagation(); onSeek(a.at_ms); }}
              className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-orange-500 ring-2 ring-surface hover:scale-125"
              style={{ left: pct(a.at_ms) }}
            />
          ))}
        </div>

        {speakers.map(s => {
          const off = hidden.has(s.label);
          return (
            <Lane key={s.label} speaker={s} share={s.talk_ms / total} off={off} onToggle={() => onToggleSpeaker(s.label)}>
              <div className={`${track} h-4 ${off ? 'opacity-30' : ''}`} onClick={e => onSeek(msAt(e.clientX))}>
                {rows.filter(r => r.speaker === s.label).map(r => (
                  <span
                    key={r.idx}
                    className="pointer-events-none absolute inset-y-0.5 rounded-[2px]"
                    style={{ left: pct(r.start_ms), width: `max(2px, ${pct(r.end_ms - r.start_ms)})`, backgroundColor: s.color }}
                  />
                ))}
              </div>
            </Lane>
          );
        })}

        {/* Playhead + hover line span every track. Positioned over the track column only. */}
        <div ref={overlayRef} className="pointer-events-none absolute inset-y-0 right-0" style={{ left: LABEL_W + 12 }}>
          <div ref={playheadRef} className="absolute inset-y-[-4px] w-0.5 -translate-x-1/2 rounded bg-fg" style={{ left: 0 }} />
          {hover !== null && (
            <>
              <div className="absolute inset-y-0 w-px bg-muted/50" style={{ left: pct(hover) }} />
              <div className="absolute -top-5 -translate-x-1/2 rounded bg-fg px-1 font-mono text-[10px] text-bg" style={{ left: pct(hover) }}>{clock(hover)}</div>
            </>
          )}
        </div>
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-muted" style={{ marginLeft: LABEL_W + 12 }}>
        {[0, 0.25, 0.5, 0.75, 1].map(f => <span key={f} className={f === 0.25 || f === 0.75 ? 'hidden sm:inline' : ''}>{clock(f * duration)}</span>)}
      </div>
    </section>
  );
}

function Lane({ speaker, share, off, onToggle, children }: { speaker: Speaker; share: number; off: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <>
      <button onClick={onToggle} title={`${speakerName(speaker)}${speaker.role ? ` · ${speaker.role}` : ''} — click to filter`} className={`flex min-w-0 items-center gap-1.5 text-left ${off ? 'opacity-40' : ''}`}>
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: speaker.color }} />
        <span className="truncate">{speakerName(speaker)}</span>
        <span className="ml-auto shrink-0 tabular-nums text-muted">{Math.round(share * 100)}%</span>
      </button>
      {children}
    </>
  );
}

export default memo(Timeline);
