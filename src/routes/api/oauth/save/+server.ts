import { zod } from 'sveltekit-superforms/adapters';
import type { RequestHandler } from './$types';
import { actionResult, superValidate } from 'sveltekit-superforms';
import { oauthConfigSchema } from '$lib/zod/oauth';
import { updateAppConfig } from '$lib/server/utils/config';
import type { AppConfig } from '$lib/db/types';

export const POST: RequestHandler = async ({ locals, request }) => {
  const form = await superValidate(request, zod(oauthConfigSchema));
  if (!form.valid) return actionResult('failure', { form });

  const user = locals.user;
  if (!user || user.role === 'user') {
    return actionResult('error', 'Unauthorized', 401);
  }

  const data: Partial<AppConfig> = form.data;

  // Don't overwrite clientSecret if it's not provided
  if (!data.clientSecret) {
    data.clientSecret = undefined;
  }
  const success = await updateAppConfig(form.data);

  if (!success) {
    form.message = { type: 'error', text: 'Failed to edit oauth config' };
    return actionResult('failure', { form });
  }

  form.message = { type: 'success', text: 'OAuth config updated' };

  return actionResult('success', { form });
};
