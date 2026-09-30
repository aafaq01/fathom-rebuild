// AI notes for each seed meeting (lib/notes.ts: Claude Sonnet 5, structured output), saved to seed/ai/<id>.json.
// Usage: node --env-file=.env.local scripts/seed-ai.mjs [id ...]   (skips ids already saved)
import fs from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import { toRows } from '../lib/rows.ts';
import { generateNotes } from '../lib/notes.ts';

const client = new Anthropic();
const sources = JSON.parse(fs.readFileSync('seed/sources.json', 'utf8'));
const ids = process.argv.slice(2);
fs.mkdirSync('seed/ai', { recursive: true });

const todo = sources.filter(s => (!ids.length || ids.includes(s.id)) && !fs.existsSync(`seed/ai/${s.id}.json`));
const results = await Promise.all(todo.map(async s => {
  const rows = toRows(JSON.parse(fs.readFileSync(`seed/deepgram/${s.id}.json`, 'utf8')));
  const t0 = Date.now();
  const { notes, model, usage: u } = await generateNotes(client, s.title, rows);
  const cost = (u.input_tokens * 2 + u.output_tokens * 10) / 1e6;
  fs.writeFileSync(`seed/ai/${s.id}.json`, JSON.stringify({ model, usage: u, notes }, null, 2));
  console.log(`${s.id}: ${((Date.now() - t0) / 1000).toFixed(0)}s, in ${u.input_tokens}, out ${u.output_tokens}, $${cost.toFixed(3)}`);
  return cost;
}));
console.log(`total $${results.reduce((a, b) => a + b, 0).toFixed(3)}`);
