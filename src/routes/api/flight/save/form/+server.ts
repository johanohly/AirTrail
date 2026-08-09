import { actionResult, superValidate } from 'sveltekit-superforms';
import { zod4 as zod } from 'sveltekit-superforms/adapters';

import type { RequestHandler } from './$types';

import { validateAndSaveFlight } from '$lib/server/utils/flight';
import { handleErrorActionResult } from '$lib/utils/forms';
import { flightFormSchema } from '$lib/zod/flight';

export const POST: RequestHandler = async ({ locals, request }) => {
  const formData = await request.formData();
  const form = await superValidate(formData, zod(flightFormSchema));
  if (!form.valid) {
    return actionResult('failure', { form });
  }

  const authorization = locals.authorization;
  if (!locals.user || !authorization) {
    return actionResult('error', 'Not logged in', 401);
  }

  const result = await validateAndSaveFlight(authorization, form.data);
  return handleErrorActionResult(form, result);
};
