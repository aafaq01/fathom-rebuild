// Rows + AI notes -> database rows. Shared by scripts/load-db.mjs (seed) and the upload pipeline.
import type { NeonQueryFunction } from '@neondatabase/serverless';
import type { SeedRow } from './rows.ts';
import type { MeetingNotes } from './notes.ts';

// Distinct, readable on light and dark backgrounds. Assigned by talk time, most talk first.
const PALETTE = ['#6366f1', '#f97316', '#10b981', '#ec4899', '#0ea5e9', '#eab308', '#8b5cf6', '#ef4444', '#14b8a6', '#a3a3a3'];

export function buildContent(rows: SeedRow[], notes: MeetingNotes, durationMs: number) {
  const at = (i: number) => rows[Math.min(Math.max(i, 0), rows.length - 1)]?.start_ms ?? 0;
  const talk: Record<number, number> = {};
  for (const r of rows) talk[r.speaker] = (talk[r.speaker] || 0) + (r.end_ms - r.start_ms);
  const speakers = Object.entries(talk).sort((a, b) => b[1] - a[1]).map(([label, talk_ms], i) => {
    const ai = notes.speakers.find(x => x.label === +label);
    return { label: +label, name: ai?.name ?? null, role: ai?.role ?? '', color: PALETTE[i % PALETTE.length], talk_ms };
  });
  const chapters = notes.chapters.map((c, i, all) => ({
    idx: i, title: c.title, summary: c.summary, start_ms: at(c.start_row),
    end_ms: i + 1 < all.length ? at(all[i + 1].start_row) : durationMs,
  }));
  const actions = notes.action_items.map(a => ({ owner: a.owner_label, text: a.text, due: a.due, at_ms: at(a.row) }));
  const summary = notes.summary.map(sec => ({ heading: sec.heading, bullets: sec.bullets.map(b => ({ text: b.text, at_ms: at(b.row) })) }));
  return { speakers, chapters, actions, summary };
}

// Inserts for everything under a meeting row. Run inside sql.transaction([...]) with the meeting insert/update.
export function contentQueries(sql: NeonQueryFunction<false, false>, id: string, rows: SeedRow[], c: ReturnType<typeof buildContent>) {
  return [
    sql`insert into utterances (meeting_id, idx, speaker, start_ms, end_ms, text, words)
        select ${id}, idx, speaker, start_ms, end_ms, text, words
        from jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) as r(idx int, speaker int, start_ms int, end_ms int, text text, words jsonb)`,
    sql`insert into chapters (meeting_id, idx, title, summary, start_ms, end_ms)
        select ${id}, idx, title, summary, start_ms, end_ms
        from jsonb_to_recordset(${JSON.stringify(c.chapters)}::jsonb) as r(idx int, title text, summary text, start_ms int, end_ms int)`,
    sql`insert into action_items (meeting_id, owner, text, due, at_ms)
        select ${id}, owner, text, due, at_ms
        from jsonb_to_recordset(${JSON.stringify(c.actions)}::jsonb) as r(owner int, text text, due text, at_ms int)`,
    sql`insert into summaries (meeting_id, template, sections) values (${id}, 'general', ${JSON.stringify(c.summary)})`,
  ];
}
