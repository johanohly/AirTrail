import { actionResult, superValidate } from 'sveltekit-superforms';
import { zod4 as zod } from 'sveltekit-superforms/adapters';

import type { RequestHandler } from './$types';

import { hasPermission } from '$lib/server/authorization/authorize';
import { validateAndSaveAircraft } from '$lib/server/utils/aircraft';
import { handleErrorActionResult } from '$lib/utils/forms';
import { aircraftSchema } from '$lib/zod/aircraft';

export const POST: RequestHandler = async ({ locals, request }) => {
  const formData = await request.formData();
  const form = await superValidate(formData, zod(aircraftSchema));
  if (!form.valid) {
    return actionResult('failure', { form });
  }

  if (!locals.authorization) {
    form.message = { type: 'error', text: 'Not logged in' };
    return actionResult('failure', { form });
  }

  if (!hasPermission(locals.authorization, 'data.aircraft.manage')) {
    form.message = { type: 'error', text: 'Unauthorized' };
    return actionResult('failure', { form });
  }

  const result = await validateAndSaveAircraft(form.data);
  return handleErrorActionResult(form, result);
};
