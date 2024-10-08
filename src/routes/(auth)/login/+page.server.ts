import type { PageServerLoad } from './$types';
import { trpcServer } from '$lib/server/server';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { signInSchema } from '$lib/zod/auth';

export const load: PageServerLoad = async (event) => {
  await trpcServer.user.isSetup.ssr(event);

  const form = await superValidate(zod(signInSchema));
  return { form };
};
