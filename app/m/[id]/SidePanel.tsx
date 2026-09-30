'use client';
import { memo, useState } from 'react';
import { speakerName, type ActionItem, type Chapter, type Highlight, type Speaker, type Summary } from '@/lib/types';
import { clock } from '@/lib/format';
import { TEMPLATES, stripRowRefs, type TemplateId } from '@/lib/templates.ts';
import { Avatar, TimeChip } from './bits';

type Props = {
  meetingId: string;
  summaries: Summary[];
  chapters: Chapter[];
  actions: ActionItem[];
  highlights: Highlight[];
  speakers: Speaker[];
  byLabel: Map<number, Speaker>;
  currentMs: number;
  onSeek: (ms: number) => void;
};
type Tab = 'summary' | 'chapters' | 'actions' | 'clips';

function SidePanel({ meetingId, summaries, chapters, actions, highlights, speakers, byLabel, currentMs, onSeek }: Props) {
  const [tab, setTab] = useState<Tab>('summary');
  const tabs: [Tab, string][] = [
    ['summary', 'Summary'],
    ['chapters', `Chapters ${chapters.length}`],
    ['actions', `Actions ${actions.length}`],
    ['clips', `Clips ${highlights.length}`],
  ];

  return (
    <section className="flex min-h-[320px] flex-1 flex-col overflow-hidden rounded-xl border border-line bg-surface">
      <div role="tablist" className="flex gap-1 border-b border-line px-2 pt-2">
        {tabs.map(([k, label]) => (
          <button
            key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`rounded-t-md px-3 py-2 text-sm ${tab === k ? 'border-b-2 border-accent font-medium text-fg' : 'text-muted hover:text-fg'}`}
          >{label}</button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 text-sm">
        {tab === 'summary' && <SummaryTab meetingId={meetingId} initial={summaries} onSeek={onSeek} />}

        {tab === 'chapters' && (
          <ol className="flex flex-col gap-1">
            {chapters.map(c => {
              const active = currentMs >= c.start_ms && currentMs < c.end_ms;
              return (
                <li key={c.idx}>
                  <button
                    onClick={() => onSeek(c.start_ms)}
                    className={`w-full rounded-lg border px-3 py-2 text-left transition ${active ? 'border-accent bg-accent-soft' : 'border-transparent hover:bg-surface-2'}`}
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-[11px] tabular-nums text-accent">{clock(c.start_ms)}</span>
                      <span className="font-medium">{c.title}</span>
                      <span className="ml-auto shrink-0 text-xs text-muted">{Math.max(1, Math.round((c.end_ms - c.start_ms) / 60000))} min</span>
                    </div>
                    <p className="mt-1 leading-relaxed text-muted">{c.summary}</p>
                  </button>
                </li>
              );
            })}
          </ol>
        )}

        {tab === 'actions' && <Actions actions={actions} speakers={speakers} byLabel={byLabel} onSeek={onSeek} />}

        {tab === 'clips' && (highlights.length ? (
          <ul className="flex flex-col gap-3">
            {highlights.map(h => (
              <li key={h.id} className="rounded-lg border border-line p-3">
                <div className="flex items-center gap-2">
                  <TimeChip ms={h.start_ms} onSeek={onSeek} />
                  <a href={`/c/${h.id}`} target="_blank" className="truncate font-medium hover:text-accent">{h.title}</a>
                  <span className="ml-auto text-xs text-muted">{Math.round((h.end_ms - h.start_ms) / 1000)}s</span>
                </div>
                <p className="mt-1.5 line-clamp-2 text-muted">“{h.quote}”</p>
              </li>
            ))}
          </ul>
        ) : <Empty>Select words in the transcript to create a shareable clip.</Empty>)}
      </div>
    </section>
  );
}

type Sections = Summary['sections'];

// Seed meetings ship every template precomputed, so switching is instant; anything missing is
// generated once by /api/summary and then cached for this page.
function SummaryTab({ meetingId, initial, onSeek }: { meetingId: string; initial: Summary[]; onSeek: (ms: number) => void }) {
  const [template, setTemplate] = useState<TemplateId>('general');
  const [cache, setCache] = useState<Record<string, Sections>>(() => Object.fromEntries(initial.map(s => [s.template, s.sections])));
  const [state, setState] = useState<'idle' | 'loading' | string>('idle');
  const sections = cache[template];

  const pick = async (t: TemplateId) => {
    setTemplate(t);
    if (cache[t]) return setState('idle');
    setState('loading');
    try {
      const res = await fetch('/api/summary', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ meeting_id: meetingId, template: t }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || res.statusText);
      setCache(c => ({ ...c, [t]: body.sections }));
      setState('idle');
    } catch (e) {
      setState(e instanceof Error ? e.message : 'Could not load this summary');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-2 text-xs text-muted">
        Template
        <select
          value={template} onChange={e => pick(e.target.value as TemplateId)}
          className="h-8 rounded-md border border-line bg-surface-2 px-2 text-sm text-fg outline-none focus:border-accent"
        >
          {TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <span className="hidden truncate sm:inline">{TEMPLATES.find(t => t.id === template)?.blurb}</span>
      </label>
      {state === 'loading' ? <Empty>Writing the {TEMPLATES.find(t => t.id === template)?.label} summary…</Empty>
        : state !== 'idle' ? <Empty>{state}</Empty>
        : !sections ? <Empty>No summary yet.</Empty>
        : (
          <div className="flex flex-col gap-5">
            {sections.map((sec, si) => (
              <div key={si}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{sec.heading}</h3>
                <ul className="flex flex-col gap-2">
                  {sec.bullets.map((b, i) => (
                    <li key={i} className="flex items-start gap-2 leading-relaxed">
                      <TimeChip ms={b.at_ms} onSeek={onSeek} />
                      <span>{stripRowRefs(b.text)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

// Grouped by owner: with eight people on a call, "who owns what" is the question.
function Actions({ actions, speakers, byLabel, onSeek }: { actions: ActionItem[]; speakers: Speaker[]; byLabel: Map<number, Speaker>; onSeek: (ms: number) => void }) {
  const [done, setDone] = useState<Set<number>>(() => new Set(actions.filter(a => a.done).map(a => a.id)));
  if (!actions.length) return <Empty>No action items were committed to in this meeting.</Empty>;
  const owners = [...speakers.map(s => s.label), null].filter(o => actions.some(a => a.owner === o));
  return (
    <div className="flex flex-col gap-5">
      {owners.map(o => {
        const s = o === null ? undefined : byLabel.get(o);
        const items = actions.filter(a => a.owner === o);
        return (
          <div key={String(o)}>
            <div className="mb-2 flex items-center gap-2">
              {s ? <Avatar speaker={s} /> : <span className="grid h-6 w-6 place-items-center rounded-full bg-surface-2 text-xs text-muted">?</span>}
              <span className="font-medium">{s ? speakerName(s) : 'Unassigned'}</span>
              {s?.role && <span className="truncate text-xs text-muted">{s.role}</span>}
              <span className="ml-auto text-xs text-muted">{items.length}</span>
            </div>
            <ul className="flex flex-col gap-1.5 pl-8">
              {items.map(a => (
                <li key={a.id} className="flex items-start gap-2">
                  <input
                    type="checkbox" checked={done.has(a.id)} aria-label="Done"
                    onChange={() => setDone(d => { const n = new Set(d); if (n.has(a.id)) n.delete(a.id); else n.add(a.id); return n; })}
                    className="mt-1 accent-[var(--accent)]"
                  />
                  <span className={`flex-1 leading-relaxed ${done.has(a.id) ? 'text-muted line-through' : ''}`}>
                    {a.text}
                    {a.due && <span className="ml-1.5 rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted">due {a.due}</span>}
                  </span>
                  <TimeChip ms={a.at_ms} onSeek={onSeek} />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="py-8 text-center text-muted">{children}</p>;

export default memo(SidePanel);
