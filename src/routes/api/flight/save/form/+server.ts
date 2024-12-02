import { actionResult, superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';

import type { RequestHandler } from './$types';

import { validateAndCreateFlight } from '$lib/server/utils/flight';
import { handleErrorActionResult } from '$lib/utils/forms';
import { flightSchema } from '$lib/zod/flight';

export const POST: RequestHandler = async ({ locals, request }) => {
  const formData = await request.formData();
  const form = await superValidate(formData, zod(flightSchema));
  if (!form.valid) {
    return actionResult('failure', { form });
  }

  const user = locals.user;
  if (!user) {
    return actionResult('error', 'Not logged in', 401);
  }

  const result = await validateAndCreateFlight(user, form.data);
  return handleErrorActionResult(form, result);
};
