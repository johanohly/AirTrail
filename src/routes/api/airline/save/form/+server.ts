import { actionResult, superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';

import type { RequestHandler } from './$types';

import { validateAndSaveAirline } from '$lib/server/utils/airline';
import { handleErrorActionResult } from '$lib/utils/forms';
import { airlineSchema } from '$lib/zod/airline';

export const POST: RequestHandler = async ({ locals, request }) => {
  const formData = await request.formData();
  const form = await superValidate(formData, zod(airlineSchema));
  if (!form.valid) {
    return actionResult('failure', { form });
  }

  const user = locals.user;
  if (!user) {
    form.message = { type: 'error', text: 'Not logged in' };
    return actionResult('failure', { form });
  }

  if (user.role === 'user') {
    form.message = { type: 'error', text: 'Unauthorized' };
    return actionResult('failure', { form });
  }

  const result = await validateAndSaveAirline(form.data);
  return handleErrorActionResult(form, result);
};
