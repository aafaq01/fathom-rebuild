import { neon } from '@neondatabase/serverless';
import type { Meeting, Row, Chapter, ActionItem, Summary, Highlight } from './types';

export const sql = neon(process.env.DATABASE_URL!);

export async function getMeeting(id: string) {
  const [meeting] = (await sql`select * from meetings where id = ${id} and status = 'ready'`) as Meeting[];
  if (!meeting) return null;
  const [rows, chapters, actions, summaries, highlights] = await Promise.all([
    sql`select idx, speaker, start_ms, end_ms, text, words from utterances where meeting_id = ${id} order by idx`,
    sql`select idx, title, summary, start_ms, end_ms from chapters where meeting_id = ${id} order by idx`,
    sql`select id, owner, text, due, at_ms, done from action_items where meeting_id = ${id} order by at_ms`,
    sql`select template, sections from summaries where meeting_id = ${id}`,
    sql`select id, start_ms, end_ms, title, quote, why, created_at from highlights where meeting_id = ${id} order by start_ms`,
  ]);
  return {
    meeting,
    rows: rows as Row[],
    chapters: chapters as Chapter[],
    actions: actions as ActionItem[],
    summary: (summaries as Summary[]).find(s => s.template === 'general') ?? null,
    highlights: highlights as Highlight[],
  };
}
export type MeetingData = NonNullable<Awaited<ReturnType<typeof getMeeting>>>;
