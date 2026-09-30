import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { randomInt } from 'node:crypto';
import { sql } from '@/lib/db';
import { clock } from '@/lib/format';
import { speakerName, type Meeting, type Row } from '@/lib/types';

const Input = z
  .object({ meeting_id: z.string().min(1), start_ms: z.number().int().min(0), end_ms: z.number().int() })
  .refine(b => b.end_ms > b.start_ms, 'end_ms must be greater than start_ms')
  .refine(b => b.end_ms - b.start_ms <= 5 * 60_000, 'clip must be at most 5 minutes');

const Output = z.object({
  title: z.string().describe('Headline for the moment, at most 8 words'),
  why: z.string().describe('One sentence: why this moment matters to someone who was not in the meeting'),
});

const firstWords = (s: string, n: number) => s.split(/\s+/).filter(Boolean).slice(0, n).join(' ');

export async function POST(req: Request) {
  const parsed = Input.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { meeting_id, start_ms, end_ms } = parsed.data;

  const [meeting] = (await sql`select title, speakers from meetings where id = ${meeting_id} and status = 'ready'`) as Pick<Meeting, 'title' | 'speakers'>[];
  if (!meeting) return Response.json({ error: 'meeting not found' }, { status: 404 });

  // Rows overlapping the clip plus 3 rows of context either side.
  const rows = (await sql`
    with hit as (
      select min(idx) as lo, max(idx) as hi from utterances
      where meeting_id = ${meeting_id} and start_ms < ${end_ms} and end_ms > ${start_ms}
    )
    select u.idx, u.speaker, u.start_ms, u.end_ms, u.text, u.words
    from utterances u, hit
    where u.meeting_id = ${meeting_id} and u.idx between hit.lo - 3 and hit.hi + 3
    order by u.idx`) as Row[];

  const inClip = (r: Row) => r.start_ms < end_ms && r.end_ms > start_ms;
  // Keep words that start inside the range; rows without word timings contribute their whole text.
  const quote = rows
    .filter(inClip)
    .map(r => (r.words ? r.words.filter(([s]) => s >= start_ms && s < end_ms).map(w => w[2]).join(' ') : r.text))
    .filter(Boolean)
    .join(' ');
  if (!quote) return Response.json({ error: 'no speech in that range' }, { status: 400 });

  let title = firstWords(quote, 8);
  let why: string | null = null;
  // Public, unauthenticated endpoint: cap Claude spend. Past the cap, clips still work with a plain title.
  // ponytail: global hourly cap, per-IP limits if this ever sees real traffic
  const [{ recent }] = (await sql`select count(*)::int as recent from highlights where created_at > now() - interval '1 hour'`) as { recent: number }[];
  if (recent < 30) try {
    const transcript = rows
      .map(r => `${inClip(r) ? '>>' : '  '} [${clock(r.start_ms)}] ${speakerName(meeting.speakers.find(s => s.label === r.speaker), r.speaker)}: ${r.text}`)
      .join('\n');
    const res = await new Anthropic().messages.parse({
      model: 'claude-sonnet-5',
      max_tokens: 2000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low', format: zodOutputFormat(Output) },
      messages: [
        {
          role: 'user',
          content:
            `Someone clipped a moment from the meeting "${meeting.title}" to share with a colleague who was not there.\n` +
            `Transcript excerpt (lines marked >> are the clip, the rest is surrounding context):\n\n${transcript}\n\n` +
            `Clipped quote: "${quote}"\n\n` +
            `Write a title (at most 8 words, specific, no quotes) and a one-sentence "why" explaining why this moment matters to someone who wasn't there.`,
        },
      ],
    });
    if (res.parsed_output) {
      title = firstWords(res.parsed_output.title, 8) || title;
      why = res.parsed_output.why.trim() || null;
    }
  } catch (err) {
    console.error('highlight title generation failed', err); // fall back to the quote's first words
  }

  const id = Array.from({ length: 8 }, () => randomInt(36).toString(36)).join('');
  await sql`
    insert into highlights (id, meeting_id, start_ms, end_ms, title, quote, why)
    values (${id}, ${meeting_id}, ${start_ms}, ${end_ms}, ${title}, ${quote}, ${why})`;
  return Response.json({ id, title, why });
}
