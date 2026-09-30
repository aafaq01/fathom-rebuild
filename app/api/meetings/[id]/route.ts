import { sql } from '@/lib/db';

// Processing status, polled by the meeting page while an upload is being transcribed.
export async function GET(_req: Request, ctx: RouteContext<'/api/meetings/[id]'>) {
  const { id } = await ctx.params;
  const [m] = (await sql`select status, error from meetings where id = ${id}`) as { status: string; error: string | null }[];
  if (!m) return Response.json({ error: 'not found' }, { status: 404 });
  return Response.json(m);
}
