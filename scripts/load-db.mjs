// Load seed meetings (Deepgram rows + AI notes) into Postgres. Idempotent: replaces each meeting.
// Note: replacing a meeting cascades to its highlights; use scripts/seed-templates.mjs for summaries only.
// Usage: node --env-file=.env.local scripts/load-db.mjs
import fs from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { toRows } from '../lib/rows.ts';
import { buildContent, contentQueries } from '../lib/store.ts';

const sql = neon(process.env.DATABASE_URL);
// Schema first (idempotent). The neon HTTP driver runs one statement per call.
for (const stmt of fs.readFileSync('db/schema.sql', 'utf8').replace(/--.*$/gm, '').split(';').map(s => s.trim()).filter(Boolean)) {
  await sql.query(stmt);
}

const media = fs.existsSync('seed/media.json') ? JSON.parse(fs.readFileSync('seed/media.json', 'utf8')) : {};

for (const s of JSON.parse(fs.readFileSync('seed/sources.json', 'utf8'))) {
  if (!fs.existsSync(`seed/ai/${s.id}.json`)) { console.log(`${s.id}: no AI notes yet, skipped`); continue; }
  const dg = JSON.parse(fs.readFileSync(`seed/deepgram/${s.id}.json`, 'utf8'));
  const { notes } = JSON.parse(fs.readFileSync(`seed/ai/${s.id}.json`, 'utf8'));
  const rows = toRows(dg);
  const duration = Math.round(dg.metadata.duration * 1000);
  const c = buildContent(rows, notes, duration);
  // Sources without a browser-playable video play their audio.
  const m = media[s.id] ?? (s.media_url ? { media_url: s.media_url, media_kind: s.media_kind } : { media_url: s.audio_url, media_kind: 'audio' });

  await sql.transaction([
    sql`delete from meetings where id = ${s.id}`,
    sql`insert into meetings (id, title, recorded_at, duration_ms, media_kind, media_url, source_url, license, attribution, status, speakers)
        values (${s.id}, ${s.title}, ${s.recorded_at ?? null}, ${duration}, ${m.media_kind}, ${m.media_url}, ${s.source_url},
                ${s.license}, ${s.attribution}, 'ready', ${JSON.stringify(c.speakers)})`,
    ...contentQueries(sql, s.id, rows, c),
  ]);
  console.log(`${s.id}: ${rows.length} rows, ${c.chapters.length} chapters, ${c.actions.length} actions, ${c.speakers.length} speakers`);
}
