'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const STEPS = ['Uploaded', 'Transcribing and separating speakers', 'Writing chapters, action items and summary'];

export default function Processing({ id, title, status: initial, error: initialError }: { id: string; title: string; status: string; error: string | null }) {
  const router = useRouter();
  const [status, setStatus] = useState(initial);
  const [error, setError] = useState(initialError);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (status !== 'processing') return;
    const started = Date.now();
    const tick = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    const poll = setInterval(async () => {
      const res = await fetch(`/api/meetings/${id}`, { cache: 'no-store' }).catch(() => null);
      const body = await res?.json().catch(() => null);
      if (!body?.status || body.status === 'processing') return;
      setStatus(body.status);
      setError(body.error);
      if (body.status === 'ready') router.refresh();
    }, 3000);
    return () => { clearInterval(tick); clearInterval(poll); };
  }, [id, status, router]);

  // Deepgram usually returns within ~30s; after that we're most likely on the AI pass.
  const step = elapsed < 25 ? 1 : 2;
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-4 py-16">
      <div>
        <p className="text-sm text-muted">{status === 'failed' ? 'Processing failed' : 'Processing your recording'}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
      </div>
      {status === 'failed' ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm">
          {error || 'Something went wrong.'} <a href="/upload" className="font-medium text-accent">Try another file</a>
        </div>
      ) : (
        <ol className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5">
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-center gap-3 text-sm">
              <span className={`grid h-6 w-6 place-items-center rounded-full text-xs ${i < step ? 'bg-accent text-white' : i === step ? 'animate-pulse bg-accent-soft text-accent' : 'bg-surface-2 text-muted'}`}>
                {i < step ? '✓' : i + 1}
              </span>
              <span className={i > step ? 'text-muted' : ''}>{s}</span>
            </li>
          ))}
          <li className="pt-1 text-xs text-muted">{elapsed}s · this page opens the meeting as soon as it&apos;s ready. An hour-long call takes about 2 minutes.</li>
        </ol>
      )}
    </main>
  );
}
