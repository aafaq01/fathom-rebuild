import Anthropic from '@anthropic-ai/sdk';
import { sql } from '@/lib/db';
import { summarize, withTimes } from '@/lib/summarize.ts';
import { TEMPLATES, type TemplateId } from '@/lib/templates.ts';
import type { Meeting, Row } from '@/lib/types';

// Fallback only: seed meetings have every template precomputed. Generates once, then serves from the DB.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const meeting_id = typeof body?.meeting_id === 'string' ? body.meeting_id : '';
  const template = TEMPLATES.find(t => t.id === body?.template)?.id as TemplateId | undefined;
  if (!meeting_id || !template) return Response.json({ error: 'meeting_id and a valid template are required' }, { status: 400 });

  const [cached] = (await sql`select sections from summaries where meeting_id = ${meeting_id} and template = ${template}`) as { sections: unknown }[];
  if (cached) return Response.json({ sections: cached.sections });

  const [meeting] = (await sql`select title, speakers from meetings where id = ${meeting_id} and status = 'ready'`) as Pick<Meeting, 'title' | 'speakers'>[];
  if (!meeting) return Response.json({ error: 'meeting not found' }, { status: 404 });

  // Public endpoint: cap Claude spend. ponytail: global hourly cap, per-IP limits if it ever sees real traffic
  const [{ recent }] = (await sql`select count(*)::int as recent from summaries where created_at > now() - interval '1 hour'`) as { recent: number }[];
  if (recent >= 40) return Response.json({ error: 'Summary generation is busy, try again later' }, { status: 429 });

  const rows = (await sql`select idx, speaker, start_ms, end_ms, text from utterances where meeting_id = ${meeting_id} order by idx`) as Row[];
  try {
    const { sections } = await summarize(new Anthropic(), meeting.title, rows, meeting.speakers, template);
    const timed = withTimes(sections, rows);
    await sql`insert into summaries (meeting_id, template, sections) values (${meeting_id}, ${template}, ${JSON.stringify(timed)})
              on conflict (meeting_id, template) do nothing`;
    return Response.json({ sections: timed });
  } catch (err) {
    console.error('summary generation failed', err);
    return Response.json({ error: 'Could not generate this summary' }, { status: 502 });
  }
}
