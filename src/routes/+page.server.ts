import type { Actions, PageServerLoad } from './$types';
import { trpcServer } from '$lib/server/server';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { addFlightSchema } from '$lib/zod/flight';
import { zod } from 'sveltekit-superforms/adapters';
import { fail } from '@sveltejs/kit';
import { airportFromICAO } from '$lib/utils';
import { db } from '$lib/db';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);

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
      return fail(400, { form });
    }
    const to = form.data.to;
    if (!airportFromICAO(to)) {
      setError(form, 'to', 'Invalid airport code');
      return fail(400, { form });
    }

    const departureDate = dayjs(form.data.departure);
    const departure = form.data.departureTime
      ? mergeTimeWithDate(departureDate, form.data.departureTime)
      : undefined;
    console.log(departure?.toISOString());

    /*
    const resp = await db
      .insertInto('Flight')
      .values({
        userId: user.id,
        from,
        to,
        duration: 5,
        date: departureDate.format('YYYY-MM-DD'),
      })
      .execute();

    if (resp.length === 0) {
      return message(form, { type: 'error', text: 'Failed to add flight' });
    }
     */

    return message(form, {
      type: 'success',
      text: 'Flight added successfully',
    });
  },
};

const mergeTimeWithDate = (
  dateOnly: dayjs.Dayjs,
  timeString: string,
): dayjs.Dayjs => {
  const normalizedTimeString = timeString.replace(/(am|pm)$/i, ' $1');

  const is12HourFormat = /(?:am|pm)$/i.test(normalizedTimeString);
  const timeFormat = is12HourFormat ? 'hh:mm A' : 'HH:mm';

  const timeParsed = dayjs(normalizedTimeString, timeFormat);

  if (!timeParsed.isValid()) {
    throw new Error('Invalid time format');
  }

  return dateOnly.hour(timeParsed.hour()).minute(timeParsed.minute()).second(0);
};
