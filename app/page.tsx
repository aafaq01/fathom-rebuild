import Link from 'next/link';
import { connection } from 'next/server';
import { sql } from '@/lib/db';
import { minutes } from '@/lib/format';
import { shortDate } from '@/lib/dates';
import type { Meeting } from '@/lib/types';
import SpeakerStack from './SpeakerStack';

type Card = Pick<Meeting, 'id' | 'title' | 'recorded_at' | 'duration_ms' | 'speakers'> & { actions: number; chapters: number };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export default async function Home() {
  await connection();
  const meetings = (await sql`
    select m.id, m.title, m.recorded_at, m.duration_ms, m.speakers,
      (select count(*)::int from action_items a where a.meeting_id = m.id) as actions,
      (select count(*)::int from chapters c where c.meeting_id = m.id) as chapters
    from meetings m
    where m.status = 'ready'
    -- Seeded meetings first (newest recording first: Burlington on top), then uploads (they live in Blob).
    order by (m.media_url like '%.blob.vercel-storage.com/%') , m.recorded_at desc nulls last, m.created_at desc`) as Card[];

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:py-14">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Meetings</h1>
      <p className="mt-2 text-muted">Meeting notes built for the long, crowded call.</p>

      {meetings.length === 0 ? (
        <p className="mt-10 rounded-xl border border-dashed border-line p-10 text-center text-muted">No meetings yet.</p>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {meetings.map(m => {
            return (
              <li key={m.id}>
                <Link
                  href={`/m/${m.id}`}
                  className="group flex h-full flex-col gap-4 rounded-xl border border-line bg-surface p-5 transition hover:-translate-y-0.5 hover:border-accent hover:shadow-md focus-visible:border-accent focus-visible:outline-none"
                >
                  <div>
                    <h2 className="font-medium leading-snug group-hover:text-accent">{m.title}</h2>
                    <p className="mt-1 text-sm text-muted">
                      {[shortDate(m.recorded_at), m.duration_ms ? minutes(m.duration_ms) : null].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-3">
                    <SpeakerStack meetingId={m.id} speakers={m.speakers} />
                    <p className="text-right text-xs text-muted">
                      {plural(m.actions, 'action item')} · {plural(m.chapters, 'chapter')}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
