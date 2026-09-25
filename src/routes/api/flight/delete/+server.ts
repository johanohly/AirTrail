import { json } from '@sveltejs/kit';
import { z } from 'zod';

import { deleteFlight } from '$lib/server/api/v1/services/flights';
import { legacyApiRoute } from '$lib/server/utils/api';

const deleteFlightSchema = z.object({
  id: z.number(),
});

export const POST = legacyApiRoute(async ({ principal, event }) => {
  const parsed = deleteFlightSchema.safeParse(await event.request.json());
  if (!parsed.success) {
    return json(
      { success: false, errors: parsed.error.issues },
      { status: 400 },
    );
  }

  await deleteFlight(principal, parsed.data.id);
  return json({ success: true });
});
