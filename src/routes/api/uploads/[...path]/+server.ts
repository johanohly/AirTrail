import * as fs from 'fs';
import * as path from 'path';

import type { RequestHandler } from './$types';
import { uploadManager } from '$lib/server/utils/uploads';

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

export const GET: RequestHandler = async ({ params }) => {
  const relativePath = params.path;

  if (!relativePath || !uploadManager.uploadLocation) {
    return new Response('Not found', { status: 404 });
  }

  const fullPath = path.join(uploadManager.uploadLocation, relativePath);

  // Security: Ensure path doesn't escape upload directory
  const resolvedPath = path.resolve(fullPath);
  const resolvedUploadLocation = path.resolve(uploadManager.uploadLocation);
  if (!resolvedPath.startsWith(resolvedUploadLocation)) {
    return new Response('Forbidden', { status: 403 });
  }

  if (!fs.existsSync(fullPath)) {
    return new Response('Not found', { status: 404 });
  }

  const ext = path.extname(fullPath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  const fileBuffer = fs.readFileSync(fullPath);

  return new Response(fileBuffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
