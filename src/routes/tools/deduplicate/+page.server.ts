import { error, redirect } from '@sveltejs/kit';

import type { PageServerLoad } from './$types';

import { canDeduplicateOwnFlights } from '$lib/authorization/permissions';
import type { Flight } from '$lib/db/types';
import { listFlights } from '$lib/server/utils/flight';

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user;
  if (!user) {
    return redirect(302, '/login');
  }
  if (
    !locals.authorization ||
    !canDeduplicateOwnFlights(locals.authorization)
  ) {
    return error(403, 'Forbidden');
  }

  const flights = await listFlights(user.id);
  const duplicates: Flight[] = [];
  const uniqueFlights: Flight[] = [];

  for (const flight of flights) {
    const hasDuplicate = uniqueFlights.some(
      (f) =>
        f.date === flight.date &&
        f.from &&
        f.to &&
        f.from.id === flight.from?.id &&
        f.to.id === flight.to?.id,
    );

    if (hasDuplicate) {
      duplicates.push(flight);
    } else {
      uniqueFlights.push(flight);
    }
  }

  return {
    flights: duplicates,
  };
};
