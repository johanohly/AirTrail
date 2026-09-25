import type { RequestHandler } from './$types';
import {
  authenticateClient,
  revokeIssuedToken,
} from '$lib/server/oauth/server';
import {
  formValue,
  oauthError,
  oauthRateLimit,
  readForm,
} from '$lib/server/oauth/http';
import { RATE_LIMITS } from '$lib/server/security/rate-limit';

export const POST: RequestHandler = async (event) => {
  const limited = oauthRateLimit(event, RATE_LIMITS.oauthRevoke);
  if (limited) return limited;

  const form = await readForm(event.request);
  if (!form)
    return oauthError('invalid_request', 'Request body must be form-encoded');

  /*
   * RFC 7009 2.1 requires client authentication and only permits revoking a
   * token the client was issued. `revokeIssuedToken` enforces the ownership;
   * this authenticates the caller first, exactly as the token endpoint does.
   */
  const client = await authenticateClient(
    formValue(form, 'client_id'),
    formValue(form, 'client_secret'),
  );
  if (!client)
    return oauthError('invalid_client', 'Client authentication failed', 401);

  const token = formValue(form, 'token');
  if (token) await revokeIssuedToken(token, client.id);

  // RFC 7009 2.2: an invalid token is not an error.
  return new Response(null, { status: 200 });
};
