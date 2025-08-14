import { error } from '@sveltejs/kit';
import { actionResult, superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';

import type { RequestHandler } from './$types';

import { appConfig } from '$lib/server/utils/config';
import { integrationsConfigSchema } from '$lib/zod/config';

export const POST: RequestHandler = async ({ locals, request }) => {
  const form = await superValidate(request, zod(integrationsConfigSchema));
  if (!form.valid) return actionResult('failure', { form });

  const user = locals.user;
  if (!user || user.role === 'user') {
    return actionResult('error', 'Unauthorized', 401);
  }

  const currentConfig = (await appConfig.get())?.integrations;
  let { aeroDataBoxKey } = form.data;
  if (typeof aeroDataBoxKey === 'string' && aeroDataBoxKey.trim() === '') {
    aeroDataBoxKey = null;
  }

  if (
    currentConfig &&
    aeroDataBoxKey !== currentConfig.aeroDataBoxKey &&
    appConfig.envConfigured?.integrations?.aeroDataBoxKey
  ) {
    return error(500, {
      message:
        'This config field is controlled by the .env file and cannot be changed here.',
    });
  }

  const success = await appConfig.set({ integrations: { aeroDataBoxKey } });

  if (!success) {
    form.message = {
      type: 'error',
      text: 'Failed to update integrations config',
    };
    return actionResult('failure', { form });
  }

  form.message = { type: 'success', text: 'Integrations config updated' };
  return actionResult('success', { form });
};
