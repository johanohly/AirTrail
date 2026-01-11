import { json, type RequestHandler } from '@sveltejs/kit';

import { syncAirlines } from '$lib/server/utils/sync';

export const POST: RequestHandler = async ({ locals, request }) => {
  const user = locals.user;
  if (!user) {
    return json({ error: 'Not logged in' }, { status: 401 });
  }

  if (user.role !== 'owner') {
    return json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { overwrite, includeDefunct } = await request.json();
    const result = await syncAirlines({ overwrite, includeDefunct });
    return json({ success: true, result });
  } catch (err) {
    return json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
};
