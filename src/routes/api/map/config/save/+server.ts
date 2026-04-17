import { error } from '@sveltejs/kit';
import { actionResult, superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';

import type { RequestHandler } from './$types';

import { appConfig } from '$lib/server/utils/config';
import { mapConfigSchema } from '$lib/zod/config';

export const POST: RequestHandler = async ({ locals, request }) => {
  const form = await superValidate(request, zod(mapConfigSchema));
  if (!form.valid) return actionResult('failure', { form });

  const user = locals.user;
  if (!user || user.role === 'user') {
    return actionResult('error', 'Unauthorized', 401);
  }

  const currentConfig = (await appConfig.get())?.map;

  for (const key of Object.keys(form.data) as Array<keyof typeof form.data>) {
    if (
      currentConfig &&
      form.data[key] !== currentConfig[key] &&
      appConfig.envConfigured?.map?.[key]
    ) {
      return error(500, {
        message:
          'This config field is controlled by the .env file and cannot be changed here.',
      });
    }
  }

  const success = await appConfig.set({ map: form.data });

  if (!success) {
    form.message = { type: 'error', text: 'Failed to update map config' };
    return actionResult('failure', { form });
  }

  form.message = { type: 'success', text: 'Map config updated' };
  return actionResult('success', { form });
};
