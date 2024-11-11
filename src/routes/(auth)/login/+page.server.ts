import type { PageServerLoad } from './$types';
import { trpcServer } from '$lib/server/server';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { signInSchema } from '$lib/zod/auth';
import { appConfig } from '$lib/server/utils/config';

export const load: PageServerLoad = async (event) => {
  await trpcServer.user.isSetup.ssr(event);

  const form = await superValidate(zod(signInSchema));
  const config = await appConfig.getClientConfig();
  return { form, appConfig: config };
};
