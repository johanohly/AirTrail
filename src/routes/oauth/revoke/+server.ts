import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { oauthError, readForm } from '$lib/server/oauth/http';
import { hashSha256 } from '$lib/server/utils/hash';

export const POST: RequestHandler = async ({ request }) => {
  const form = await readForm(request);
  if (!form)
    return oauthError('invalid_request', 'Request body must be form-encoded');

  const token = form.get('token');
  if (typeof token === 'string' && token.length > 0) {
    const hash = hashSha256(token);
    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable('oauthAccessToken')
        .set({ revokedAt: new Date() })
        .where('tokenHash', '=', hash)
        .execute();
      const refresh = await trx
        .selectFrom('oauthRefreshToken')
        .select('familyId')
        .where('tokenHash', '=', hash)
        .executeTakeFirst();
      if (refresh) {
        await trx
          .updateTable('oauthRefreshToken')
          .set({ revokedAt: new Date() })
          .where('familyId', '=', refresh.familyId)
          .execute();
        await trx
          .updateTable('oauthAccessToken')
          .set({ revokedAt: new Date() })
          .where('refreshFamilyId', '=', refresh.familyId)
          .execute();
      }
    });
  }
  return new Response(null, { status: 200 });
};
