import type { RequestEvent, RequestHandler } from '@sveltejs/kit';

import { API_OPERATIONS, type ApiOperationId } from '$lib/api/v1/operations';
import { protectedResourceUrl } from '$lib/api/v1/resources';
import { requireOperation } from './access';
import { apiV1Unauthorized } from './errors';
import { authenticateApiPrincipal, type ApiPrincipal } from './principal';
import { handleApiV1Error } from './response';

export type ApiRouteContext<Event extends RequestEvent = RequestEvent> = {
  principal: ApiPrincipal;
  event: Event;
};

/*
 * Every authenticated /api/v1 handler is built with this: authentication, the
 * operation's registered scopes and error mapping happen here. Scopes that
 * depend on the target (own or any flight) are checked by the service.
 */
export const apiRoute =
  <Event extends RequestEvent>(
    operation: ApiOperationId,
    handler: (context: ApiRouteContext<Event>) => Response | Promise<Response>,
  ): RequestHandler =>
  async (event) => {
    const principal = await authenticateApiPrincipal(
      event.request,
      protectedResourceUrl(event.url.origin, 'apiV1'),
    );
    if (!principal)
      return apiV1Unauthorized(
        'apiV1',
        API_OPERATIONS[operation].requires.join(' '),
        event.url.origin,
      );
    try {
      requireOperation(principal, operation);
      return await handler({ principal, event: event as Event });
    } catch (error) {
      return handleApiV1Error(error);
    }
  };
