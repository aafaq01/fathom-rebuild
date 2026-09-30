// Server-only: the per-meeting AI pass (Claude Sonnet 5, structured output). Used by the seed script
// and the upload pipeline. Claude cites rows by index; timestamps come from our rows, never the model.
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { mmss, type SeedRow } from './rows.ts';

const Notes = z.object({
  speakers: z.array(z.object({
    label: z.number().int(),
    name: z.string().nullable().describe('Real name ONLY if the transcript states it for this speaker (self-introduction, or directly addressed by name right before/after their row). Otherwise null.'),
    role: z.string().describe('Short role inferred from what they say, e.g. "Board chair", "Finance lead", "Resident (public comment)"'),
    evidence: z.string().nullable().describe('Quote + row number that establishes the name; null when name is null'),
  })),
  chapters: z.array(z.object({
    title: z.string().describe('3-7 words'),
    summary: z.string().describe('1-2 sentences: what was discussed or decided'),
    start_row: z.number().int(),
  })).describe('Topic segments in order, covering the whole meeting. 4-10 for an hour, fewer for short meetings.'),
  action_items: z.array(z.object({
    owner_label: z.number().int().nullable().describe('Speaker label of the person who will DO it (committed or was assigned), not whoever mentioned it. null if no clear owner.'),
    text: z.string().describe('Imperative, specific task'),
    due: z.string().nullable().describe('Due date/time only if stated'),
    row: z.number().int().describe('Row where the commitment/assignment is made'),
  })),
  summary: z.array(z.object({
    heading: z.enum(['Purpose', 'Key takeaways', 'Decisions', 'Open questions', 'Next steps']),
    bullets: z.array(z.object({ text: z.string(), row: z.number().int() })),
  })).describe('General summary. Omit a heading if it has nothing real under it. Even a short meeting gets a summary.'),
});
export type MeetingNotes = z.infer<typeof Notes>;

const SYSTEM = `You write meeting notes for a notetaker app. The transcript is machine-generated with diarized speaker labels (S0, S1, ...); expect recognition errors and occasional mislabelled speakers.
Each row is "#<row> [<time>] S<label>: <text>". Cite rows by their number: every chapter, action item and summary bullet must point at the row that supports it, so users can jump to that moment.
Be concrete and faithful to what was said. Do not invent names, owners, dates or decisions. Getting owners right matters more than finding many action items.`;

export async function generateNotes(client: Anthropic, title: string, rows: SeedRow[]) {
  const transcript = rows.map(r => `#${r.idx} [${mmss(r.start_ms)}] S${r.speaker}: ${r.text}`).join('\n');
  const res = await client.messages.parse({
    model: 'claude-sonnet-5',
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'medium', format: zodOutputFormat(Notes) },
    system: SYSTEM,
    messages: [{ role: 'user', content: `Meeting: ${title}\n\nTranscript:\n${transcript}` }],
  });
  if (!res.parsed_output) throw new Error(`notes: no parsed output (stop_reason ${res.stop_reason})`);
  return { notes: res.parsed_output, model: res.model, usage: res.usage };
}
