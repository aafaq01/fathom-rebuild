// Server-only. Uploads live in a private Blob store (OIDC auth, no public URLs), so anything that reads
// them (Deepgram, the browser's <video>/<audio>) gets a time-limited signed GET URL. Seed media are
// public URLs and pass through untouched.
import { issueSignedToken, presignUrl } from '@vercel/blob';

export async function readableUrl(url: string, ttlMs = 6 * 3600_000) {
  const u = new URL(url);
  if (!u.hostname.endsWith('.private.blob.vercel-storage.com')) return url;
  const pathname = decodeURIComponent(u.pathname.slice(1));
  const token = await issueSignedToken({ pathname, operations: ['get'], validUntil: Date.now() + ttlMs });
  const { presignedUrl } = await presignUrl(token, { operation: 'get', pathname, access: 'private' });
  return presignedUrl;
}
