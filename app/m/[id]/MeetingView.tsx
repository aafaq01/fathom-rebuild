'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MeetingData } from '@/lib/db';
import { speakerName, type Highlight, type Speaker } from '@/lib/types';
import { clock, minutes } from '@/lib/format';
import { applyNames, useSpeakerNames } from '@/lib/names';
import Timeline from './Timeline';
import Transcript from './Transcript';
import SidePanel from './SidePanel';
import { Avatar, askRename } from './bits';

export default function MeetingView({ data, initialMs }: { data: MeetingData; initialMs: number }) {
  const { meeting, rows, chapters, actions, summaries } = data;
  const { names, rename } = useSpeakerNames(meeting.id);
  // Per-browser renames applied once here, so every child (timeline, chips, transcript, owners) follows.
  const speakers = useMemo(() => applyNames(meeting.speakers, names), [meeting.speakers, names]); // sorted by talk time at seed
  const duration = meeting.duration_ms;
  const byLabel = useMemo(() => new Map(speakers.map(s => [s.label, s])), [speakers]);
  const onRename = useCallback((s: Speaker) => askRename(s, rename), [rename]);

  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  // A ?t= deep link shows the right line even before the media has loaded.
  const [currentIdx, setCurrentIdx] = useState(() => (initialMs ? rows.findLastIndex(r => r.start_ms <= initialMs) : -1));
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState('');
  const [highlights, setHighlights] = useState<Highlight[]>(data.highlights);
  const [toast, setToast] = useState<{ id: string } | { error: string } | null>(null);

  // Last row starting at or before ms.
  const rowAt = useCallback((ms: number) => {
    let lo = 0, hi = rows.length - 1, ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (rows[mid].start_ms <= ms) { ans = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return ans;
  }, [rows]);

  // Playhead + clock are written straight to the DOM every frame; React state only changes
  // when the current transcript row changes, so an 80-minute transcript isn't re-rendered at 60fps.
  useEffect(() => {
    const m = mediaRef.current;
    if (!m) return;
    let raf = 0;
    const paint = () => {
      const ms = m.currentTime * 1000;
      if (playheadRef.current) playheadRef.current.style.left = `${Math.min(100, (ms / duration) * 100)}%`;
      if (clockRef.current) clockRef.current.textContent = clock(ms);
      setCurrentIdx(rowAt(ms));
    };
    const loop = () => { paint(); if (!m.paused) raf = requestAnimationFrame(loop); };
    const onPlay = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); };
    const onMeta = () => { if (initialMs) m.currentTime = initialMs / 1000; paint(); };
    m.addEventListener('play', onPlay);
    m.addEventListener('seeked', paint);
    m.addEventListener('timeupdate', paint);
    m.addEventListener('loadedmetadata', onMeta);
    if (m.readyState >= 1) onMeta();
    return () => {
      cancelAnimationFrame(raf);
      m.removeEventListener('play', onPlay);
      m.removeEventListener('seeked', paint);
      m.removeEventListener('timeupdate', paint);
      m.removeEventListener('loadedmetadata', onMeta);
    };
  }, [duration, rowAt, initialMs]);


  const seek = useCallback((ms: number) => {
    const m = mediaRef.current;
    if (!m) return;
    m.currentTime = Math.max(0, ms) / 1000;
    setCurrentIdx(rowAt(ms));
    m.play().catch(() => {});
  }, [rowAt]);

  const q = query.trim().toLowerCase();
  const hits = useMemo(
    () => (q.length < 2 ? [] : rows.filter(r => !hidden.has(r.speaker) && r.text.toLowerCase().includes(q))),
    [rows, q, hidden],
  );

  const toggleSpeaker = useCallback((label: number | null) => {
    setHidden(prev => {
      if (label === null) return new Set();
      const next = new Set(prev);
      // Clicking a speaker while all are shown isolates them; otherwise toggle.
      if (prev.size === 0) { speakers.forEach(s => s.label !== label && next.add(s.label)); return next; }
      if (next.has(label)) next.delete(label); else next.add(label);
      return next.size === speakers.length ? new Set() : next;
    });
  }, [speakers]);

  const createClip = useCallback(async (start_ms: number, end_ms: number) => {
    try {
      const res = await fetch('/api/highlights', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ meeting_id: meeting.id, start_ms, end_ms }),
      });
      if (!res.ok) throw new Error((await res.text()) || res.statusText);
      const { id, title, why } = await res.json();
      const r = rows.filter(x => x.end_ms > start_ms && x.start_ms < end_ms);
      setHighlights(h => [...h, { id, start_ms, end_ms, title, quote: r.map(x => x.text).join(' '), why, created_at: new Date().toISOString() }]
        .sort((a, b) => a.start_ms - b.start_ms));
      setToast({ id });
    } catch (e) {
      setToast({ error: e instanceof Error ? e.message : 'Could not create clip' });
    }
  }, [meeting.id, rows]);

  const currentMs = currentIdx >= 0 ? rows[currentIdx].start_ms : 0;
  const currentChapter = chapters.find(c => currentMs >= c.start_ms && currentMs < c.end_ms);
  const currentSpeaker = currentIdx >= 0 ? byLabel.get(rows[currentIdx].speaker) : undefined;
  const date = meeting.recorded_at
    ? new Date(meeting.recorded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    : null;

  return (
    <main className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 px-4 py-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{meeting.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {[date, minutes(duration), `${speakers.length} speakers`, `${actions.length} action items`].filter(Boolean).join(' · ')}
            {meeting.source_url && (
              <> · <a href={meeting.source_url} target="_blank" rel="noreferrer" className="underline decoration-line underline-offset-2 hover:text-fg">{meeting.license}</a></>
            )}
          </p>
        </div>
      </div>

      <Timeline
        duration={duration} rows={rows} speakers={speakers} chapters={chapters} actions={actions}
        highlights={highlights} hits={hits} hidden={hidden} playheadRef={playheadRef}
        onSeek={seek} onToggleSpeaker={toggleSpeaker} byLabel={byLabel} onRename={onRename}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="flex min-h-0 flex-col gap-4 lg:sticky lg:top-[4.5rem] lg:h-[calc(100vh-5.5rem)] lg:self-start">
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            {meeting.media_kind === 'video' ? (
              <video ref={el => { mediaRef.current = el; }} src={meeting.media_url} controls playsInline preload="metadata" className="aspect-video w-full bg-black" />
            ) : (
              <div className="flex flex-col gap-3 p-4">
                <div className="flex items-center gap-3">
                  {currentSpeaker ? <Avatar speaker={currentSpeaker} size={40} /> : <div className="h-10 w-10 rounded-full bg-surface-2" />}
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-wide text-muted">Now speaking</div>
                    <div className="truncate font-medium">{currentSpeaker ? speakerName(currentSpeaker) : 'Press play'}</div>
                  </div>
                </div>
                <audio ref={el => { mediaRef.current = el; }} src={meeting.media_url} controls preload="metadata" className="w-full" />
              </div>
            )}
            <div className="flex items-center gap-2 border-t border-line px-3 py-2 text-sm">
              <span ref={clockRef} className="font-mono tabular-nums text-muted">{clock(initialMs)}</span>
              <span className="text-muted">/ {clock(duration)}</span>
              {currentChapter && <span className="ml-2 truncate text-muted">· {currentChapter.title}</span>}
            </div>
          </div>
          <SidePanel
            meetingId={meeting.id} summaries={summaries} chapters={chapters} actions={actions} highlights={highlights}
            speakers={speakers} byLabel={byLabel} currentMs={currentMs} onSeek={seek} onRename={onRename}
          />
        </div>

        <Transcript
          rows={rows} chapters={chapters} actions={actions} speakers={speakers} byLabel={byLabel}
          currentIdx={currentIdx} hidden={hidden} query={query} setQuery={setQuery} hits={hits}
          onSeek={seek} onToggleSpeaker={toggleSpeaker} onCreateClip={createClip} rowAt={rowAt} onRename={onRename}
        />
      </div>

      {toast && (
        <div role="status" className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm shadow-lg">
          {'id' in toast ? (
            <>
              <span>Clip created</span>
              <button
                className="rounded-md bg-accent-soft px-2 py-1 font-medium text-accent"
                onClick={() => navigator.clipboard.writeText(`${location.origin}/c/${toast.id}`)}
              >Copy link</button>
              <a href={`/c/${toast.id}`} target="_blank" className="font-medium text-accent">Open</a>
            </>
          ) : <span className="text-red-500">{toast.error}</span>}
          <button aria-label="Dismiss" className="text-muted hover:text-fg" onClick={() => setToast(null)}>✕</button>
        </div>
      )}
    </main>
  );
}
