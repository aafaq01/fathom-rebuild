// Precompute the non-General summary templates for every seed meeting (Claude Sonnet 5) and upsert
// them into `summaries`. Saved to seed/ai/templates/<id>.json so re-runs don't re-spend.
// Meetings run in parallel; templates within a meeting run in sequence so they share the transcript cache.
// Usage: node --env-file=.env.local scripts/seed-templates.mjs
import fs from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import { neon } from '@neondatabase/serverless';
import { toRows } from './turns.mjs';
import { summarize, withTimes } from '../lib/summarize.ts';
import { TEMPLATES } from '../lib/templates.ts';

const client = new Anthropic();
const sql = neon(process.env.DATABASE_URL);
fs.mkdirSync('seed/ai/templates', { recursive: true });
// Sonnet 5: $2/M input, $10/M output, cache writes 1.25x, cache reads 0.1x.
const cost = u => (u.input_tokens * 2 + (u.cache_creation_input_tokens ?? 0) * 2.5 + (u.cache_read_input_tokens ?? 0) * 0.2 + u.output_tokens * 10) / 1e6;

// This machine's network drops DNS now and then; retry DB writes instead of losing the run.
const retry = async (fn, n = 3) => { for (let i = 1; ; i++) { try { return await fn(); } catch (e) { if (i >= n) throw e; await new Promise(r => setTimeout(r, 2000 * i)); } } };

const sources = JSON.parse(fs.readFileSync('seed/sources.json', 'utf8'));
// allSettled: one meeting failing must not abort the others mid-generation (saved templates are never re-bought).
const results = await Promise.allSettled(sources.map(async s => {
  const file = `seed/ai/templates/${s.id}.json`;
  const saved = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  const rows = toRows(JSON.parse(fs.readFileSync(`seed/deepgram/${s.id}.json`, 'utf8')));
  const { notes } = JSON.parse(fs.readFileSync(`seed/ai/${s.id}.json`, 'utf8'));
  let spent = 0;
  for (const t of TEMPLATES.filter(t => t.id !== 'general' && !saved[t.id])) {
    const { sections, usage } = await summarize(client, s.title, rows, notes.speakers, t.id);
    saved[t.id] = sections;
    fs.writeFileSync(file, JSON.stringify(saved, null, 2));
    spent += cost(usage);
    console.log(`${s.id} ${t.id}: in ${usage.input_tokens}+${usage.cache_creation_input_tokens ?? 0}w+${usage.cache_read_input_tokens ?? 0}r, out ${usage.output_tokens}, $${cost(usage).toFixed(3)}`);
  }
  for (const [template, sections] of Object.entries(saved)) {
    await retry(() => sql`insert into summaries (meeting_id, template, sections) values (${s.id}, ${template}, ${JSON.stringify(withTimes(sections, rows))})
              on conflict (meeting_id, template) do update set sections = excluded.sections`);
  }
  return spent;
}));
results.forEach((r, i) => r.status === 'rejected' && console.error(`${sources[i].id} FAILED:`, r.reason?.message ?? r.reason));
console.log(`total $${results.reduce((a, r) => a + (r.value ?? 0), 0).toFixed(3)}`);
