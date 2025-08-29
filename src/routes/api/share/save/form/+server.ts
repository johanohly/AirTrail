import { actionResult, superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';

import type { RequestHandler } from './$types';

import { validateAndSaveShare } from '$lib/server/utils/share';
import { handleErrorActionResult } from '$lib/utils/forms';
import { shareSchema } from '$lib/zod/share';

export const POST: RequestHandler = async ({ locals, request }) => {
  const formData = await request.formData();
  const form = await superValidate(formData, zod(shareSchema));
  if (!form.valid) {
    return actionResult('failure', { form });
  }

  const user = locals.user;
  if (!user) {
    form.message = { type: 'error', text: 'Not logged in' };
    return actionResult('failure', { form });
  }

  const result = await validateAndSaveShare(user.id, form.data);
  return handleErrorActionResult(form, result);
};
