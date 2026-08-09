import { error } from '@sveltejs/kit';
import { actionResult, superValidate } from 'sveltekit-superforms';
import { zod4 as zod } from 'sveltekit-superforms/adapters';

import type { RequestHandler } from './$types';

import { mergeMapSettings, toMapSettingsFormData } from '$lib/map/map-settings';
import { getMapProviderConfigurationIssue } from '$lib/server/map/basemap-style';
import { hasPermission } from '$lib/server/authorization/authorize';
import { appConfig } from '$lib/server/utils/config';
import { mapSettingsFormSchema } from '$lib/zod/config';

export const POST: RequestHandler = async ({ locals, request }) => {
  const form = await superValidate(request, zod(mapSettingsFormSchema));
  if (!form.valid) return actionResult('failure', { form });

  if (
    !locals.authorization ||
    !hasPermission(locals.authorization, 'instance.map.manage')
  ) {
    return actionResult('error', 'Unauthorized', 401);
  }

  const currentConfig = (await appConfig.get())?.map;
  if (!currentConfig) {
    form.message = { type: 'error', text: 'Map configuration is unavailable' };
    return actionResult('failure', { form });
  }

  const nextConfig = mergeMapSettings(currentConfig, form.data);

  const providerIssue = getMapProviderConfigurationIssue(nextConfig);
  if (providerIssue) {
    form.message = { type: 'error', text: providerIssue };
    return actionResult('failure', { form });
  }

  for (const key of Object.keys(nextConfig) as Array<keyof typeof nextConfig>) {
    if (
      nextConfig[key] !== currentConfig[key] &&
      appConfig.envConfigured?.map?.[key]
    ) {
      return error(403, {
        message:
          'This config field is controlled by the .env file and cannot be changed here.',
      });
    }
  }

  const success = await appConfig.set({ map: nextConfig });

  if (!success) {
    form.message = { type: 'error', text: 'Failed to update map config' };
    return actionResult('failure', { form });
  }

  form.data = toMapSettingsFormData(nextConfig);
  form.message = { type: 'success', text: 'Map config updated' };
  return actionResult('success', { form });
};
