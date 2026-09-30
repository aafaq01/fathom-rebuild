// Server-only: the "capture layer" for uploads. Recording URL -> Deepgram -> Claude -> Postgres,
// the same steps the seed scripts run, marking the meeting ready (or failed) at the end.
import Anthropic from '@anthropic-ai/sdk';
import { sql } from './db';
import { toRows, type Deepgram } from './rows.ts';
import { generateNotes } from './notes.ts';
import { buildContent, contentQueries } from './store.ts';

async function transcribe(url: string): Promise<Deepgram> {
  const params = new URLSearchParams({ model: 'nova-3', diarize: 'true', utterances: 'true', smart_format: 'true', punctuate: 'true' });
  const res = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
    method: 'POST',
    headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) throw new Error(`Transcription failed (${res.status})`);
  return res.json();
}

export async function processMeeting(id: string, title: string, url: string) {
  try {
    const dg = await transcribe(url);
    const rows = toRows(dg);
    if (!rows.length) throw new Error('No speech found in this recording');
    const duration = Math.round(dg.metadata.duration * 1000);
    const { notes } = await generateNotes(new Anthropic(), title, rows);
    const c = buildContent(rows, notes, duration);
    await sql.transaction([
      ...contentQueries(sql, id, rows, c),
      sql`update meetings set status = 'ready', duration_ms = ${duration}, speakers = ${JSON.stringify(c.speakers)} where id = ${id}`,
    ]);
  } catch (err) {
    console.error('processing failed', id, err);
    const message = err instanceof Error ? err.message : 'Processing failed';
    await sql`update meetings set status = 'failed', error = ${message.slice(0, 300)} where id = ${id}`;
  }
}
