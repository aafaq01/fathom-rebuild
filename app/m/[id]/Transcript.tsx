'use client';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { speakerName, type ActionItem, type Chapter, type Row, type Speaker } from '@/lib/types';
import { clock } from '@/lib/format';

type Props = {
  rows: Row[];
  chapters: Chapter[];
  actions: ActionItem[];
  speakers: Speaker[];
  byLabel: Map<number, Speaker>;
  currentIdx: number;
  hidden: Set<number>;
  query: string;
  setQuery: (q: string) => void;
  hits: Row[];
  onSeek: (ms: number) => void;
  onToggleSpeaker: (label: number | null) => void;
  onCreateClip: (start_ms: number, end_ms: number) => void;
  rowAt: (ms: number) => number;
};

export default function Transcript({ rows, chapters, actions, speakers, byLabel, currentIdx, hidden, query, setQuery, hits, onSeek, onToggleSpeaker, onCreateClip, rowAt }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const [follow, setFollow] = useState(true);
  const [hitPos, setHitPos] = useState(0);
  const [pending, setPending] = useState<{ start: number; end: number; x: number; y: number } | null>(null);

  // Chapter headers and action badges are anchored to the row they fall in.
  const chapterAt = useMemo(() => new Map(chapters.map(c => [rowAt(c.start_ms), c])), [chapters, rowAt]);
  const actionsAt = useMemo(() => {
    const m = new Map<number, ActionItem[]>();
    for (const a of actions) { const i = rowAt(a.at_ms); m.set(i, [...(m.get(i) ?? []), a]); }
    return m;
  }, [actions, rowAt]);
  const terms = useMemo(() => query.trim().toLowerCase().split(/\s+/).filter(t => t.length > 1), [query]);
  const hitSet = useMemo(() => new Set(hits.map(h => h.idx)), [hits]);
  const activeHit = hits.length ? hits[Math.min(hitPos, hits.length - 1)].idx : -1;

  const scrollTo = (idx: number, smooth = true) => {
    const list = listRef.current;
    const el = list?.querySelector<HTMLElement>(`[data-row="${idx}"]`);
    if (list && el) list.scrollTo({ top: el.offsetTop - list.clientHeight / 3, behavior: smooth ? 'smooth' : 'auto' });
  };

  useEffect(() => { if (follow && currentIdx >= 0) scrollTo(currentIdx); }, [currentIdx, follow]);
  useEffect(() => { setHitPos(0); }, [query]);
  useEffect(() => { if (activeHit >= 0) { setFollow(false); scrollTo(activeHit); } }, [activeHit]);

  const step = (d: number) => hits.length && setHitPos(p => (p + d + hits.length) % hits.length);

  // Selecting words maps to exact word timings via data-s / data-e on each word span.
  const onMouseUp = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !listRef.current) return setPending(null);
    const word = (n: Node | null) => (n?.nodeType === 3 ? n.parentElement : (n as Element | null))?.closest<HTMLElement>('[data-s]');
    const a = word(sel.anchorNode), b = word(sel.focusNode);
    if (!a || !b || !listRef.current.contains(a) || !listRef.current.contains(b)) return setPending(null);
    const start = Math.min(+a.dataset.s!, +b.dataset.s!);
    const end = Math.max(+a.dataset.e!, +b.dataset.e!);
    const r = sel.getRangeAt(0).getBoundingClientRect();
    setFollow(false); // don't scroll the selection out from under the button
    setPending({ start, end, x: r.left + r.width / 2, y: r.top });
  };

  let prevSpeaker = -1;
  const total = speakers.reduce((a, s) => a + s.talk_ms, 0) || 1;

  return (
    <section className="flex min-h-[70vh] flex-col overflow-hidden rounded-xl border border-line bg-surface lg:sticky lg:top-[4.5rem] lg:h-[calc(100vh-5.5rem)] lg:min-h-0">
      <div className="flex flex-col gap-2 border-b border-line p-3">
        <div className="flex items-center gap-2">
          <input
            type="search" value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') step(e.shiftKey ? -1 : 1); }}
            placeholder="Search this meeting…" aria-label="Search this meeting"
            className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-3 text-sm outline-none focus:border-accent"
          />
          {terms.length > 0 && (
            <div className="flex shrink-0 items-center gap-1 text-xs text-muted">
              <span className="tabular-nums">{hits.length ? `${Math.min(hitPos, hits.length - 1) + 1}/${hits.length}` : '0 hits'}</span>
              <button aria-label="Previous hit" onClick={() => step(-1)} className="rounded px-1.5 py-1 hover:bg-surface-2">↑</button>
              <button aria-label="Next hit" onClick={() => step(1)} className="rounded px-1.5 py-1 hover:bg-surface-2">↓</button>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Chip on={hidden.size === 0} onClick={() => onToggleSpeaker(null)}>Everyone</Chip>
          {speakers.map(s => (
            <Chip key={s.label} on={hidden.size > 0 && !hidden.has(s.label)} onClick={() => onToggleSpeaker(s.label)} title={s.role}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
              {speakerName(s)}
              <span className="tabular-nums text-muted">{Math.round((s.talk_ms / total) * 100)}%</span>
            </Chip>
          ))}
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={listRef} onMouseUp={onMouseUp}
          onWheel={() => { setFollow(false); setPending(null); }} onTouchMove={() => { setFollow(false); setPending(null); }}
          className="absolute inset-0 overflow-y-auto px-2 py-2"
        >
          {rows.map(r => {
            if (hidden.has(r.speaker)) return null;
            const chapter = chapterAt.get(r.idx);
            const showName = r.speaker !== prevSpeaker || !!chapter;
            prevSpeaker = r.speaker;
            return (
              <div key={r.idx}>
                {chapter && (
                  <div className="mx-2 mb-1 mt-4 flex items-center gap-2 text-xs first:mt-1">
                    <span className="font-semibold uppercase tracking-wide text-accent">{chapter.title}</span>
                    <span className="h-px flex-1 bg-line" />
                  </div>
                )}
                <RowView
                  row={r} speaker={byLabel.get(r.speaker)} showName={showName}
                  active={r.idx === currentIdx} hit={hitSet.has(r.idx)} activeHit={r.idx === activeHit}
                  terms={hitSet.has(r.idx) ? terms : NONE} onSeek={onSeek}
                />
                {actionsAt.get(r.idx)?.map(a => (
                  <button key={a.id} onClick={() => onSeek(a.at_ms)} className="mb-1 ml-[60px] flex items-center gap-1.5 rounded-md bg-orange-500/10 px-2 py-1 text-left text-xs text-orange-700 dark:text-orange-300">
                    <span className="h-2 w-2 rotate-45 bg-orange-500" />
                    <span className="font-medium">Action{a.owner !== null ? ` · ${speakerName(byLabel.get(a.owner), a.owner)}` : ''}:</span> {a.text}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
        {!follow && (
          <button
            onClick={() => { setFollow(true); if (currentIdx >= 0) scrollTo(currentIdx); }}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-fg px-3 py-1.5 text-xs font-medium text-bg shadow-lg"
          >Resume auto-scroll</button>
        )}
      </div>

      {pending && (
        <button
          onMouseDown={e => e.preventDefault()}
          onClick={() => { onCreateClip(pending.start, pending.end); setPending(null); window.getSelection()?.removeAllRanges(); }}
          className="fixed z-50 -translate-x-1/2 -translate-y-full rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white shadow-lg"
          style={{ left: pending.x, top: pending.y - 6 }}
        >
          ✂ Create clip · {clock(pending.start)}–{clock(pending.end)}
        </button>
      )}
    </section>
  );
}

const NONE: string[] = [];

const RowView = memo(function RowView({ row, speaker, showName, active, hit, activeHit, terms, onSeek }: {
  row: Row; speaker: Speaker | undefined; showName: boolean; active: boolean; hit: boolean; activeHit: boolean; terms: string[]; onSeek: (ms: number) => void;
}) {
  const matches = (w: string) => { const n = w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, ''); return n && terms.some(t => n.includes(t) || t.includes(n) && n.length > 2); };
  return (
    <div
      data-row={row.idx}
      onClick={() => { if (window.getSelection()?.isCollapsed !== false) onSeek(row.start_ms); }}
      className={`group grid cursor-pointer grid-cols-[52px_minmax(0,1fr)] gap-2 rounded-lg border-l-2 px-2 py-1 text-sm leading-relaxed transition-colors ${
        active ? 'bg-accent-soft' : 'border-transparent hover:bg-surface-2'} ${activeHit ? 'ring-2 ring-yellow-500/60' : ''}`}
      style={active ? { borderColor: speaker?.color } : undefined}
    >
      <span className={`pt-px font-mono text-[11px] tabular-nums ${active ? 'text-accent' : 'text-muted'}`}>{clock(row.start_ms)}</span>
      <div className="min-w-0">
        {(showName || active) && (
          <div className="text-xs font-semibold" style={{ color: speaker?.color }}>
            {speakerName(speaker, row.speaker)}
            {speaker?.role && <span className="ml-1.5 font-normal text-muted">{speaker.role}</span>}
          </div>
        )}
        <p className={hit || active ? '' : 'text-fg/90'}>
          {row.words.map(([s, e, w], i) => (
            <span key={i} data-s={s} data-e={e}>{terms.length && matches(w) ? <mark>{w}</mark> : w}{' '}</span>
          ))}
        </p>
      </div>
    </div>
  );
});

function Chip({ on, onClick, title, children }: { on: boolean; onClick: () => void; title?: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick} title={title} aria-pressed={on}
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${on ? 'border-accent bg-accent-soft text-fg' : 'border-line text-muted hover:text-fg'}`}
    >{children}</button>
  );
}
