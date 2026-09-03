import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { authenticateRestPrincipal } from '$lib/server/api/v1/authenticate';
import { apiV1Unauthorized } from '$lib/server/api/v1/errors';
import { requireApiScope } from '$lib/server/api/v1/access';
import { apiV1Data, handleApiV1Error } from '$lib/server/api/v1/response';
import { parseJsonBody } from '$lib/server/api/v1/body';
import { visitedCountryInputSchema } from '$lib/api/v1/schemas';
export const GET: RequestHandler = async (event) => {
  const p = await authenticateRestPrincipal(event);
  if (!p) return apiV1Unauthorized('visited_countries.read');
  try {
    requireApiScope(p, 'visited_countries.read');
    return apiV1Data(
      await db
        .selectFrom('visitedCountry')
        .selectAll()
        .where('userId', '=', p.user.id)
        .execute(),
    );
  } catch (e) {
    return handleApiV1Error(e);
  }
};
export const PUT: RequestHandler = async (event) => {
  const p = await authenticateRestPrincipal(event);
  if (!p) return apiV1Unauthorized('visited_countries.write');
  try {
    requireApiScope(p, 'visited_countries.write');
    const input = await parseJsonBody(event.request, visitedCountryInputSchema);
    const row = await db
      .insertInto('visitedCountry')
      .values({ ...input, userId: p.user.id })
      .onConflict((oc) =>
        oc
          .columns(['userId', 'code'])
          .doUpdateSet({ status: input.status, note: input.note }),
      )
      .returningAll()
      .executeTakeFirstOrThrow();
    return apiV1Data(row);
  } catch (e) {
    return handleApiV1Error(e);
  }
};
export const DELETE: RequestHandler = async (event) => {
  const p = await authenticateRestPrincipal(event);
  if (!p) return apiV1Unauthorized('visited_countries.write');
  try {
    requireApiScope(p, 'visited_countries.write');
    const code = event.url.searchParams.get('code')?.toUpperCase();
    if (!code) throw new Error('code required');
    await db
      .deleteFrom('visitedCountry')
      .where('userId', '=', p.user.id)
      .where('code', '=', code)
      .execute();
    return new Response(null, { status: 204 });
  } catch (e) {
    return handleApiV1Error(e);
  }
};
