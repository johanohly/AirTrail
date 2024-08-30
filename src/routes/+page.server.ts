import type { Actions, PageServerLoad } from './$types';
import { trpcServer } from '$lib/server/server';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { addFlightSchema } from '$lib/zod/flight';
import { zod } from 'sveltekit-superforms/adapters';
import { error, fail } from '@sveltejs/kit';
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
  'add-flight': async ({ locals, request }) => {
    const form = await superValidate(request, zod(addFlightSchema));
    if (!form.valid) return fail(400, { form });

    const user = locals.user;
    if (!user) {
      return error(401, 'You must be logged in to add a flight');
    }

    const from = form.data.from;
    const to = form.data.to;
    const duration = form.data.duration;
    if (from === to && !duration) {
      setError(
        form,
        'duration',
        'Duration must be set when origin and destination are the same',
      );
    }
    if (!airportFromICAO(from)) {
      setError(form, 'from', 'Invalid airport code');
    }
    if (!airportFromICAO(to)) {
      setError(form, 'to', 'Invalid airport code');
    }

    const departureDate = dayjs(form.data.departure);
    let departure: number | undefined;
    try {
      departure = form.data.departureTime
        ? mergeTimeWithDate(departureDate, form.data.departureTime).unix()
        : undefined;
    } catch (e) {
      setError(form, 'departureTime', 'Invalid time format');
    }
    console.log(departure);

    // Catches all the setErrors above
    if (!form.valid) {
      return fail(400, { form });
    }

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

const timePartsRegex = /^(\d{1,2}):(\d{2})(?:\s?(am|pm))?$/i;
const mergeTimeWithDate = (
  dateOnly: dayjs.Dayjs,
  timeString: string,
): dayjs.Dayjs => {
  const match = timeString.match(timePartsRegex);
  if (!match) {
    throw new Error('Invalid time format');
  }
  const [, hours, minutes, ampm] = match;
  if (!hours || !minutes) {
    throw new Error('Invalid time format');
  }

  if (ampm && ampm.toLowerCase() === 'pm') {
    return dateOnly
      .hour(+hours + 12)
      .minute(+minutes)
      .second(0);
  }

  return dateOnly.hour(+hours).minute(+minutes).second(0);
};
