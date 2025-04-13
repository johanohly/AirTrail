import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';

import type { PageServerLoad } from './$types';

import { isSetup } from '$lib/server/utils/auth';
import { signUpSchema } from '$lib/zod/auth';

export const load: PageServerLoad = async () => {
  const setup = await isSetup();

  const form = await superValidate(zod(signUpSchema));
  return { isSetup: setup, form };
};
