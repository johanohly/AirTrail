import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import {
  ALLOWED_IMAGE_EXTENSIONS,
  ALLOWED_IMAGE_TYPES,
  MAX_FILE_SIZE,
  uploadManager,
} from '$lib/server/utils/uploads';

export const POST: RequestHandler = async ({ locals, request }) => {
  const user = locals.user;
  if (!user) {
    return json({ error: 'Not logged in' }, { status: 401 });
  }

  if (user.role === 'user') {
    return json({ error: 'Unauthorized' }, { status: 403 });
  }

  if (!uploadManager.isReady) {
    return json({ error: 'File uploads are not configured' }, { status: 503 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const airlineId = formData.get('airlineId') as string | null;

  if (!file || !airlineId) {
    return json({ error: 'Missing file or airlineId' }, { status: 400 });
  }

  const airlineIdNum = parseInt(airlineId, 10);
  if (isNaN(airlineIdNum)) {
    return json({ error: 'Invalid airlineId' }, { status: 400 });
  }

  const typeIndex = ALLOWED_IMAGE_TYPES.indexOf(file.type);
  if (typeIndex === -1) {
    return json(
      { error: 'Invalid file type. Allowed: PNG, JPG, SVG, WebP' },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return json({ error: 'File too large (max 5MB)' }, { status: 400 });
  }

  // Get file extension from mime type
  const ext = ALLOWED_IMAGE_EXTENSIONS[typeIndex] || '.png';
  const relativePath = `airlines/${airlineId}${ext}`;

  // Delete old icon if it exists with a different extension
  const existingAirline = await db
    .selectFrom('airline')
    .select(['iconPath'])
    .where('id', '=', airlineIdNum)
    .executeTakeFirst();

  if (existingAirline?.iconPath && existingAirline.iconPath !== relativePath) {
    await uploadManager.deleteFile(existingAirline.iconPath);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const success = await uploadManager.saveFile(relativePath, buffer);

  if (!success) {
    return json({ error: 'Failed to save file' }, { status: 500 });
  }

  // Update airline record with icon path
  await db
    .updateTable('airline')
    .set({ iconPath: relativePath })
    .where('id', '=', airlineIdNum)
    .execute();

  return json({ success: true, path: relativePath });
};

export const DELETE: RequestHandler = async ({ locals, request }) => {
  const user = locals.user;
  if (!user) {
    return json({ error: 'Not logged in' }, { status: 401 });
  }

  if (user.role === 'user') {
    return json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { airlineId } = await request.json();

  if (!airlineId) {
    return json({ error: 'Missing airlineId' }, { status: 400 });
  }

  // Get current icon path
  const airline = await db
    .selectFrom('airline')
    .select(['iconPath'])
    .where('id', '=', airlineId)
    .executeTakeFirst();

  if (airline?.iconPath) {
    await uploadManager.deleteFile(airline.iconPath);
  }

  // Clear icon path in database
  await db
    .updateTable('airline')
    .set({ iconPath: null })
    .where('id', '=', airlineId)
    .execute();

  return json({ success: true });
};
