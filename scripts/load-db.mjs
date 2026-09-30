// Load seed meetings (Deepgram rows + AI notes) into Postgres. Idempotent: replaces each meeting.
// Usage: node --env-file=.env.local scripts/load-db.mjs
import fs from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { toRows } from './turns.mjs';

const sql = neon(process.env.DATABASE_URL);
// Schema first (idempotent). The neon HTTP driver runs one statement per call.
for (const stmt of fs.readFileSync('db/schema.sql', 'utf8').replace(/--.*$/gm, '').split(';').map(s => s.trim()).filter(Boolean)) {
  await sql.query(stmt);
}

// Distinct, readable on light and dark backgrounds. Assigned by talk time, most talk first.
const PALETTE = ['#6366f1', '#f97316', '#10b981', '#ec4899', '#0ea5e9', '#eab308', '#8b5cf6', '#ef4444', '#14b8a6', '#a3a3a3'];
const media = fs.existsSync('seed/media.json') ? JSON.parse(fs.readFileSync('seed/media.json', 'utf8')) : {};

for (const s of JSON.parse(fs.readFileSync('seed/sources.json', 'utf8'))) {
  if (!fs.existsSync(`seed/ai/${s.id}.json`)) { console.log(`${s.id}: no AI notes yet, skipped`); continue; }
  const dg = JSON.parse(fs.readFileSync(`seed/deepgram/${s.id}.json`, 'utf8'));
  const { notes } = JSON.parse(fs.readFileSync(`seed/ai/${s.id}.json`, 'utf8'));
  const rows = toRows(dg);
  const duration = Math.round(dg.metadata.duration * 1000);
  const at = i => rows[Math.min(Math.max(i, 0), rows.length - 1)].start_ms;

  const talk = {};
  for (const r of rows) talk[r.speaker] = (talk[r.speaker] || 0) + (r.end_ms - r.start_ms);
  const speakers = Object.entries(talk).sort((a, b) => b[1] - a[1]).map(([label, talk_ms], i) => {
    const ai = notes.speakers.find(x => x.label === +label);
    return { label: +label, name: ai?.name ?? null, role: ai?.role ?? '', color: PALETTE[i % PALETTE.length], talk_ms };
  });
  // AMI video lives in Blob once uploaded; until then play the source audio.
  const m = media[s.id] ?? (s.media_url ? { media_url: s.media_url, media_kind: s.media_kind } : { media_url: s.audio_url, media_kind: 'audio' });
  const chapters = notes.chapters.map((c, i, all) => ({
    idx: i, title: c.title, summary: c.summary, start_ms: at(c.start_row),
    end_ms: i + 1 < all.length ? at(all[i + 1].start_row) : duration,
  }));

  await sql.transaction([
    sql`delete from meetings where id = ${s.id}`,
    sql`insert into meetings (id, title, recorded_at, duration_ms, media_kind, media_url, source_url, license, attribution, status, speakers)
        values (${s.id}, ${s.title}, ${s.recorded_at ?? null}, ${duration}, ${m.media_kind}, ${m.media_url}, ${s.source_url},
                ${s.license}, ${s.attribution}, 'ready', ${JSON.stringify(speakers)})`,
    sql`insert into utterances (meeting_id, idx, speaker, start_ms, end_ms, text, words)
        select ${s.id}, idx, speaker, start_ms, end_ms, text, words
        from jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) as r(idx int, speaker int, start_ms int, end_ms int, text text, words jsonb)`,
    sql`insert into chapters (meeting_id, idx, title, summary, start_ms, end_ms)
        select ${s.id}, idx, title, summary, start_ms, end_ms
        from jsonb_to_recordset(${JSON.stringify(chapters)}::jsonb) as r(idx int, title text, summary text, start_ms int, end_ms int)`,
    sql`insert into action_items (meeting_id, owner, text, due, at_ms)
        select ${s.id}, owner, text, due, at_ms
        from jsonb_to_recordset(${JSON.stringify(notes.action_items.map(a => ({ owner: a.owner_label, text: a.text, due: a.due, at_ms: at(a.row) })))}::jsonb)
          as r(owner int, text text, due text, at_ms int)`,
    sql`insert into summaries (meeting_id, template, sections) values (${s.id}, 'general',
        ${JSON.stringify(notes.summary.map(sec => ({ heading: sec.heading, bullets: sec.bullets.map(b => ({ text: b.text, at_ms: at(b.row) })) })))})`,
  ]);
  console.log(`${s.id}: ${rows.length} rows, ${chapters.length} chapters, ${notes.action_items.length} actions, ${speakers.length} speakers`);
}
