import { notFound } from 'next/navigation';
import { getMeeting, sql } from '@/lib/db';
import MeetingView from './MeetingView';
import Processing from './Processing';

export async function generateMetadata(props: PageProps<'/m/[id]'>) {
  const data = await getMeeting((await props.params).id);
  return { title: data ? `${data.meeting.title} · Fathom rebuild` : 'Meeting · Fathom rebuild' };
}

export default async function MeetingPage(props: PageProps<'/m/[id]'>) {
  const { id } = await props.params;
  const t = Number((await props.searchParams).t);
  const data = await getMeeting(id);
  if (!data) {
    // Uploads show a processing state until transcription + notes are done.
    const [m] = (await sql`select title, status, error from meetings where id = ${id}`) as { title: string; status: string; error: string | null }[];
    if (!m) notFound();
    return <Processing id={id} title={m.title} status={m.status} error={m.error} />;
  }
  return <MeetingView data={data} initialMs={Number.isFinite(t) && t > 0 ? t : 0} />;
}
