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

  for (let i = 0; i < flights.length; i++) {
    const flight = flights[i];
    if (!flight) continue;

    if (
      flights.some(
        (f, index) =>
          index !== i &&
          f.date === flight.date &&
          f.from.code === flight.from.code &&
          f.to.code === flight.to.code,
      )
    ) {
      duplicates.push(flight);
      flights.splice(i, 1);
      i--;
    }
  }

  return {
    flights: duplicates,
  };
};
