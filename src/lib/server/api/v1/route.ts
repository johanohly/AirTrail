import type { RequestEvent, RequestHandler } from '@sveltejs/kit';

import type { ApiScope } from '$lib/api/v1/scopes';
import { protectedResourceUrl } from '$lib/api/v1/resources';
import { requireApiScope } from './access';
import { apiV1Unauthorized } from './errors';
import { authenticateApiPrincipal, type ApiPrincipal } from './principal';
import { handleApiV1Error } from './response';

export type ApiRouteContext<Event extends RequestEvent = RequestEvent> = {
  principal: ApiPrincipal;
  event: Event;
};

/*
 * Every /api/v1 route is built with this. Declaring `scope` is not optional, so
 * a route physically cannot ship without a scope check: authentication, the
 * baseline scope check and error mapping all happen here rather than being
 * retyped in each handler -- which is how `GET /flights/{id}` ended up skipping
 * the role half of the check while its neighbours did not.
 *
 * `scope` is the *baseline*. Handlers whose required scope depends on data they
 * have not loaded yet (is the caller a passenger on this flight?) declare the
 * `.own` variant here and call `requireApiScope` again for the broader `.any`
 * variant once they know. That is sound because `principalHasScope` treats
 * `.any` as satisfying `.own`.
 */
export const apiRoute =
  <Event extends RequestEvent>(
    scope: ApiScope,
    handler: (context: ApiRouteContext<Event>) => Response | Promise<Response>,
  ): RequestHandler =>
  async (event) => {
    const principal = await authenticateApiPrincipal(
      event.request,
      protectedResourceUrl(event.url.origin, 'apiV1'),
    );
    if (!principal) return apiV1Unauthorized('apiV1', scope, event.url.origin);
    try {
      requireApiScope(principal, scope);
      return await handler({ principal, event: event as Event });
    } catch (error) {
      return handleApiV1Error(error);
    }
  };
