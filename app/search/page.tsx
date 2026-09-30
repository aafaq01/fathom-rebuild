import Link from 'next/link';
import { sql } from '@/lib/db';
import { clock } from '@/lib/format';
import { speakerName, type Speaker } from '@/lib/types';

type Hit = { meeting_id: string; idx: number; title: string; speakers: Speaker[]; speaker: number; start_ms: number; snippet: string; total: number };

// ts_headline wraps matches in \u0001...\u0002; odd split parts are matches. No HTML is ever injected.
const highlight = (s: string) => s.split(/[\u0001\u0002]/).map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p));

export default async function Search({ searchParams }: PageProps<'/search'>) {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? '';

  const hits = q
    ? ((await sql`
        with q as (select websearch_to_tsquery('english', ${q}) as query),
        top as (
          select u.meeting_id, u.idx, ts_rank(u.tsv, q.query) as rank,
                 count(*) over (partition by u.meeting_id)::int as total
          from utterances u join meetings m on m.id = u.meeting_id, q
          where m.status = 'ready' and u.tsv @@ q.query
          order by rank desc
          limit 50
        )
        select t.meeting_id, t.idx, m.title, m.speakers, u.speaker, u.start_ms, t.total,
               ts_headline('english', u.text, q.query, ${'StartSel="\u0001",StopSel="\u0002",MaxWords=30,MinWords=12'}) as snippet
        from top t
        join utterances u on u.meeting_id = t.meeting_id and u.idx = t.idx
        join meetings m on m.id = t.meeting_id, q
        order by t.rank desc`) as Hit[])
    : [];

  // Group by meeting, best-ranked meeting first; rows in transcript order within a meeting.
  const groups = new Map<string, Hit[]>();
  for (const h of hits) groups.set(h.meeting_id, [...(groups.get(h.meeting_id) ?? []), h]);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <form action="/search" className="flex gap-2">
        <input
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Search every transcript…"
          aria-label="Search every transcript"
          className="h-11 flex-1 rounded-lg border border-line bg-surface px-4 outline-none focus:border-accent"
        />
        <button className="h-11 rounded-lg bg-accent px-5 text-sm font-medium text-white hover:opacity-90">Search</button>
      </form>

      {!q ? (
        <p className="mt-8 text-muted">
          Search what anyone said in any meeting. Try a phrase in quotes like <span className="text-fg">&quot;remote control&quot;</span>,
          or <span className="text-fg">budget -marketing</span> to exclude a word.
        </p>
      ) : hits.length === 0 ? (
        <p className="mt-8 text-muted">
          No matches for <span className="text-fg">&ldquo;{q}&rdquo;</span>.
        </p>
      ) : (
        <div className="mt-8 space-y-6">
          {[...groups].map(([id, rows]) => (
            <section key={id} className="overflow-hidden rounded-xl border border-line bg-surface">
              <header className="flex items-baseline justify-between gap-4 border-b border-line bg-surface-2 px-4 py-3">
                <Link href={`/m/${id}`} className="font-medium hover:text-accent">{rows[0].title}</Link>
                <span className="shrink-0 text-xs text-muted">
                  {rows[0].total} {rows[0].total === 1 ? 'match' : 'matches'}
                </span>
              </header>
              <ul className="divide-y divide-line">
                {rows.sort((a, b) => a.start_ms - b.start_ms).map(r => {
                  const s = r.speakers.find(s => s.label === r.speaker);
                  return (
                    <li key={r.idx}>
                      <Link href={`/m/${id}?t=${r.start_ms}`} className="block px-4 py-3 hover:bg-accent-soft">
                        <div className="flex items-center gap-2 text-xs text-muted">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s?.color }} />
                          <span className="font-medium text-fg">{speakerName(s, r.speaker)}</span>
                          <span className="font-mono">{clock(r.start_ms)}</span>
                        </div>
                        <p className="mt-1 text-sm leading-relaxed">{highlight(r.snippet)}</p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
