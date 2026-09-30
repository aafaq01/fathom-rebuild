import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { sql } from '@/lib/db';
import { clock } from '@/lib/format';
import { shortDate } from '@/lib/dates';
import type { Chapter, Highlight, Meeting, Row } from '@/lib/types';
import { SpeakerLabel } from '../../SpeakerStack';
import { readableUrl } from '@/lib/media';
import ClipPlayer from './clip-player';

const load = cache(async (id: string) => {
  const [h] = (await sql`select * from highlights where id = ${id}`) as (Highlight & { meeting_id: string })[];
  if (!h) return null;
  const [meetings, rows, chapters] = await Promise.all([
    sql`select * from meetings where id = ${h.meeting_id} and status = 'ready'`,
    // Rows overlapping the clip plus 2 rows of context either side.
    sql`
      with hit as (
        select min(idx) as lo, max(idx) as hi from utterances
        where meeting_id = ${h.meeting_id} and start_ms < ${h.end_ms} and end_ms > ${h.start_ms}
      )
      select u.idx, u.speaker, u.start_ms, u.end_ms, u.text
      from utterances u, hit
      where u.meeting_id = ${h.meeting_id} and u.idx between hit.lo - 2 and hit.hi + 2
      order by u.idx`,
    sql`select idx, title, summary, start_ms, end_ms from chapters
        where meeting_id = ${h.meeting_id} and start_ms <= ${h.start_ms}
        order by start_ms desc limit 1`,
  ]);
  const meeting = (meetings as Meeting[])[0];
  if (!meeting) return null;
  return { h, meeting, rows: rows as Omit<Row, 'words'>[], chapter: (chapters as Chapter[])[0] ?? null };
});

export async function generateMetadata({ params }: PageProps<'/c/[id]'>): Promise<Metadata> {
  const clip = await load((await params).id);
  if (!clip) return { title: 'Clip not found' };
  const description = clip.h.why ?? `A moment from ${clip.meeting.title}`;
  return { title: clip.h.title, description, openGraph: { title: clip.h.title, description } };
}

export default async function ClipPage({ params }: PageProps<'/c/[id]'>) {
  const clip = await load((await params).id);
  if (!clip) notFound();
  const { h, meeting, rows, chapter } = clip;
  const date = shortDate(meeting.recorded_at);
  const fullMeeting = `/m/${h.meeting_id}?t=${h.start_ms}`;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <p className="text-sm text-muted">
        Clip from <Link href={`/m/${h.meeting_id}`} className="font-medium text-fg hover:text-accent">{meeting.title}</Link>
        {date && <> · {date}</>}
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{h.title}</h1>
      {h.why && (
        <p className="mt-4 rounded-lg border-l-4 border-accent bg-accent-soft px-4 py-3 leading-relaxed">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-accent">Why it matters</span> {h.why}
        </p>
      )}

      <div className="mt-6">
        <ClipPlayer kind={meeting.media_kind} src={await readableUrl(meeting.media_url)} start={h.start_ms} end={h.end_ms} />
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">What was said</h2>
        <ol className="mt-3 space-y-3 rounded-xl border border-line bg-surface p-4">
          {rows.map(r => {
            const inClip = r.start_ms < h.end_ms && r.end_ms > h.start_ms;
            const s = meeting.speakers.find(s => s.label === r.speaker);
            return (
              <li key={r.idx} className={inClip ? '' : 'opacity-50'}>
                <div className="flex items-center gap-2 text-xs text-muted">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s?.color }} />
                  <span className="font-medium text-fg"><SpeakerLabel meetingId={h.meeting_id} speaker={s} label={r.speaker} /></span>
                  <span className="font-mono">{clock(r.start_ms)}</span>
                </div>
                <p className={`mt-1 leading-relaxed ${inClip ? 'border-l-2 border-accent pl-3 font-medium' : 'pl-3.5 text-sm'}`}>{r.text}</p>
              </li>
            );
          })}
        </ol>
      </section>

      {chapter && (
        <section className="mt-8 rounded-xl border border-line bg-surface-2 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Part of the chapter · {clock(chapter.start_ms)}
          </p>
          <h3 className="mt-1 font-medium">{chapter.title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted">{chapter.summary}</p>
        </section>
      )}

      <Link
        href={fullMeeting}
        className="mt-8 flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-4 font-medium text-white hover:opacity-90"
      >
        Open the full meeting at {clock(h.start_ms)} <span aria-hidden>→</span>
      </Link>

      {meeting.attribution && (
        <p className="mt-10 border-t border-line pt-4 text-xs text-muted">
          {meeting.attribution}
          {meeting.license && <> · {meeting.license}</>}
          {meeting.source_url && (
            <> · <a href={meeting.source_url} className="underline hover:text-fg" rel="noopener noreferrer">Source</a></>
          )}
        </p>
      )}
    </main>
  );
}
