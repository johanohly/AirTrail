import type { Actions, PageServerLoad } from './$types';
import { trpcServer } from '$lib/server/server';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { addFlightSchema } from '$lib/zod/flight';
import { zod } from 'sveltekit-superforms/adapters';
import { fail } from '@sveltejs/kit';
import { airportFromICAO } from '$lib/utils';
import { type APIFlight, db } from '$lib/db';
import { parseDate, parseDateTime } from '@internationalized/date';
import dayjs from 'dayjs';

export const load: PageServerLoad = async (event) => {
  await trpcServer.flight.list.ssr(event);

  return {
    user: event.locals.user,
  };
};

export const actions: Actions = {
  'add-flight': async (event) => {
    const form = await superValidate(event, zod(addFlightSchema));
    if (!form.valid) return fail(400, { form });

    const user = event.locals.user;
    if (!user)
      return message(form, {
        type: 'error',
        text: 'You must be logged in to add a flight',
      });

    const from = form.data.from;
    if (!airportFromICAO(from)) {
      setError(form, 'from', 'Invalid airport code');
    }
    const to = form.data.to;
    if (!airportFromICAO(to)) {
      setError(form, 'to', 'Invalid airport code');
    }

    const departure = dayjs(form.data.departure).format('YYYY-MM-DD');

    const resp = await db
      .insertInto('Flight')
      .values({
        userId: user.id,
        from,
        to,
        duration: 5,
        date: departure,
      })
      .execute();

    if (resp.length === 0) {
      return message(form, { type: 'error', text: 'Failed to add flight' });
    }

    return message(form, {
      type: 'success',
      text: 'Flight added successfully',
    });
  },
};
