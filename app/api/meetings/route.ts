import { after } from 'next/server';
import { randomInt } from 'node:crypto';
import { sql } from '@/lib/db';
import { processMeeting } from '@/lib/pipeline';

export const maxDuration = 300; // Deepgram + Claude run in after(); an hour-long file takes ~2 min

// Create a meeting from an uploaded recording and process it in the background.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 120) : '';
  const url = typeof body?.url === 'string' ? body.url : '';
  const kind = body?.kind === 'audio' ? 'audio' : 'video';
  // Only our own Blob store: never make Deepgram fetch arbitrary URLs on our key.
  let host = '';
  try { host = new URL(url).hostname; } catch {}
  if (!title || !host.endsWith('.blob.vercel-storage.com')) {
    return Response.json({ error: 'A title and an uploaded recording are required' }, { status: 400 });
  }
  // Public endpoint: cap processing spend. ponytail: global hourly cap, per-IP limits if it ever sees real traffic
  const [{ recent }] = (await sql`select count(*)::int as recent from meetings where created_at > now() - interval '1 hour'`) as { recent: number }[];
  if (recent >= 10) return Response.json({ error: 'Too many uploads right now, try again later' }, { status: 429 });

  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'meeting';
  const id = `${slug}-${Array.from({ length: 5 }, () => randomInt(36).toString(36)).join('')}`;
  await sql`insert into meetings (id, title, recorded_at, media_kind, media_url, license, attribution, status)
            values (${id}, ${title}, now(), ${kind}, ${url}, 'Uploaded', 'Uploaded recording', 'processing')`;
  after(() => processMeeting(id, title, url));
  return Response.json({ id });
}
