import { redirect } from '@sveltejs/kit';

import type { PageServerLoad } from './$types';

import type { Flight } from '$lib/db/types';
import { listFlights } from '$lib/server/utils/flight';

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user;
  if (!user) {
    return redirect(302, '/login');
  }

  const flights = await listFlights(user.id);
  const duplicates: Flight[] = [];
  const uniqueFlights: Flight[] = [];

  for (const flight of flights) {
    const hasDuplicate = uniqueFlights.some(
      (f) =>
        f.date === flight.date &&
        f.from.code === flight.from.code &&
        f.to.code === flight.to.code,
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
