import { notFound } from 'next/navigation';
import { getMeeting } from '@/lib/db';
import MeetingView from './MeetingView';

export async function generateMetadata(props: PageProps<'/m/[id]'>) {
  const data = await getMeeting((await props.params).id);
  return { title: data ? `${data.meeting.title} · Fathom rebuild` : 'Meeting not found' };
}

export default async function MeetingPage(props: PageProps<'/m/[id]'>) {
  const { id } = await props.params;
  const t = Number((await props.searchParams).t);
  const data = await getMeeting(id);
  if (!data) notFound();
  return <MeetingView data={data} initialMs={Number.isFinite(t) && t > 0 ? t : 0} />;
}
