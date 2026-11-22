import { error, redirect } from '@sveltejs/kit';

import type { PageServerLoad } from './$types';

import { canFillOwnFlightTimes } from '$lib/authorization/permissions';
import { planTrackTimeFills } from '$lib/server/utils/track-event-times';

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user;
  if (!user) {
    return redirect(302, '/login');
  }
  if (!locals.authorization || !canFillOwnFlightTimes(locals.authorization)) {
    return error(403, 'Forbidden');
  }

  return { fills: await planTrackTimeFills(user.id) };
};
