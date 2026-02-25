import { redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';

import type { PageServerLoad } from './$types';

import { resolve } from '$app/paths';
import { isSetup } from '$lib/server/utils/auth';
import { appConfig } from '$lib/server/utils/config';
import { signInSchema } from '$lib/zod/auth';

export const load: PageServerLoad = async () => {
  const setup = await isSetup();

  if (!setup) {
    return redirect(302, resolve('/setup'));
  }

  const form = await superValidate(zod(signInSchema));
  const config = await appConfig.getClientConfig();
  return { isSetup: setup, form, appConfig: config };
};
