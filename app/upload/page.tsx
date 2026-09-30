'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { uploadPresigned } from '@vercel/blob/client';

// The stubbed capture layer: instead of a meeting bot, upload a recording and it runs through the
// same pipeline as the seeded meetings (Deepgram -> Claude -> the meeting page).
export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title.trim()) return;
    setError(null);
    setProgress(0);
    try {
      const blob = await uploadPresigned(`uploads/${file.name}`, file, {
        access: 'public',
        handleUploadUrl: '/api/upload',
        contentType: file.type,
        multipart: file.size > 50 * 1024 * 1024,
        onUploadProgress: p => setProgress(p.percentage),
      });
      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), url: blob.url, kind: file.type.startsWith('audio/') ? 'audio' : 'video' }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || res.statusText);
      router.push(`/m/${body.id}`);
    } catch (err) {
      setProgress(null);
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  const busy = progress !== null;
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Upload a recording</h1>
      <p className="mt-2 text-muted">
        Audio or video of a meeting. It gets transcribed with speaker separation, then chapters, action items by owner and a
        summary, the same as the seeded meetings.
      </p>
      <form onSubmit={submit} className="mt-8 flex flex-col gap-4 rounded-xl border border-line bg-surface p-5">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Recording</span>
          <input
            type="file" accept="audio/*,video/*" required disabled={busy}
            onChange={e => { const f = e.target.files?.[0] ?? null; setFile(f); if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')); }}
            className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-accent-soft file:px-3 file:py-1.5 file:text-accent"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Title</span>
          <input
            value={title} onChange={e => setTitle(e.target.value)} required disabled={busy} maxLength={120}
            placeholder="Weekly product sync"
            className="h-10 rounded-lg border border-line bg-surface-2 px-3 outline-none focus:border-accent"
          />
        </label>
        {busy && (
          <div className="flex flex-col gap-1.5 text-xs text-muted">
            <div className="h-2 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${progress}%` }} />
            </div>
            {progress! < 100 ? `Uploading… ${Math.round(progress!)}%` : 'Starting transcription…'}
          </div>
        )}
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button disabled={busy || !file} className="h-10 rounded-lg bg-accent text-sm font-medium text-white disabled:opacity-50">
          {busy ? 'Working…' : 'Upload and process'}
        </button>
      </form>
    </main>
  );
}
