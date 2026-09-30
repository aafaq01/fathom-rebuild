// Server-only: generate one summary template with Claude. Used by scripts/seed-templates.mjs
// (Node runs this .ts file directly) and by the live fallback in app/api/summary.
// Claude cites transcript rows; callers map rows -> timestamps, so links are exact.
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { TEMPLATE_GUIDE, stripRowRefs, type TemplateId } from './templates.ts';

type RowLike = { idx: number; speaker: number; start_ms: number; text: string };
type SpeakerLike = { label: number; name: string | null; role: string };

const Sections = z.object({
  sections: z.array(z.object({
    heading: z.string(),
    bullets: z.array(z.object({ text: z.string(), row: z.number().int().describe('Row number that supports this bullet') })),
  })),
});
export type RowSections = z.infer<typeof Sections>['sections'];

const mmss = (ms: number) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export async function summarize(client: Anthropic, title: string, rows: RowLike[], speakers: SpeakerLike[], template: TemplateId) {
  const who = speakers.map(s => `S${s.label} = ${s.name ?? `Speaker ${s.label + 1}`}${s.role ? ` (${s.role})` : ''}`).join('\n');
  const transcript = rows.map(r => `#${r.idx} [${mmss(r.start_ms)}] S${r.speaker}: ${r.text}`).join('\n');
  const res = await client.messages.parse({
    model: 'claude-sonnet-5',
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'medium', format: zodOutputFormat(Sections) },
    // Transcript lives in a cached system block, so the other templates for the same meeting reuse it.
    system: [
      {
        type: 'text',
        text: `You write meeting summaries for a notetaker app. The transcript is machine-generated with diarized speaker labels; expect recognition errors.
Each row is "#<row> [<time>] S<label>: <text>". Every bullet must cite the row that supports it. Be concrete and faithful; never invent names, owners, dates or decisions. Refer to people by name when known.

Meeting: ${title}
Speakers:
${who}

Transcript:
${transcript}`,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: `Write the "${template}" summary. ${TEMPLATE_GUIDE[template]} Even a short meeting gets a summary.` }],
  });
  if (!res.parsed_output) throw new Error(`summary ${template}: no parsed output (stop_reason ${res.stop_reason})`);
  return { sections: res.parsed_output.sections, usage: res.usage };
}

// Rows -> timestamps. Clamp out-of-range row numbers rather than dropping the bullet.
export function withTimes(sections: RowSections, rows: { start_ms: number }[]) {
  const at = (i: number) => rows[Math.min(Math.max(i, 0), rows.length - 1)].start_ms;
  return sections.map(s => ({ heading: s.heading, bullets: s.bullets.map(b => ({ text: stripRowRefs(b.text), at_ms: at(b.row) })) }));
}
