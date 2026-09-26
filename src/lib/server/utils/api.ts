import { json, type RequestEvent, type RequestHandler } from '@sveltejs/kit';

import {
  authenticateApiPrincipal,
  type ApiPrincipal,
} from '$lib/server/api/v1/principal';
import { asApiOperationError } from '$lib/server/api/v1/response';

export const apiError = (message: string, status = 500) => {
  return json({ success: false, message }, { status });
};

/*
 * The deprecated /api/flight/* and /api/stats routes. They accept API keys
 * only, as they always have, and make the same authorization decisions as
 * /api/v1 through its services; only the response shape is theirs.
 */
export const legacyApiRoute =
  <Event extends RequestEvent>(
    handler: (context: {
      principal: ApiPrincipal;
      event: Event;
    }) => Promise<Response>,
  ): RequestHandler =>
  async (event) => {
    const principal = await authenticateApiPrincipal(event.request, null);
    if (!principal) return apiError('Unauthorized', 401);
    try {
      return await handler({ principal, event: event as Event });
    } catch (error) {
      const known = asApiOperationError(error);
      if (known) return apiError(known.message, known.status);
      console.error('[api] unhandled error', error);
      return apiError('The request could not be completed');
    }
  };
