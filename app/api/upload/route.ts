import { issueSignedToken } from '@vercel/blob';
import { handleUploadPresigned, type HandleUploadPresignedBody } from '@vercel/blob/client';

// Browser -> Blob direct upload. This store authenticates with Vercel OIDC (no read-write token),
// so we hand the browser a short-lived presigned PUT URL scoped to one pathname.
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadPresignedBody;
  try {
    const result = await handleUploadPresigned({
      body,
      request,
      getSignedToken: async pathname => ({
        token: await issueSignedToken({
          pathname,
          operations: ['put'],
          validUntil: Date.now() + 15 * 60_000,
          maximumSizeInBytes: 500 * 1024 * 1024,
          allowedContentTypes: ['audio/*', 'video/*'],
        }),
        urlOptions: { addRandomSuffix: true },
      }),
    });
    return Response.json(result);
  } catch (err) {
    console.error('upload token failed', err);
    return Response.json({ error: err instanceof Error ? err.message : 'Upload failed' }, { status: 400 });
  }
}
