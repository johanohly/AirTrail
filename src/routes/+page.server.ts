import type { Actions, PageServerLoad } from './$types';
import { trpcServer } from '$lib/server/server';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { addFlightSchema } from '$lib/zod/flight';
import { zod } from 'sveltekit-superforms/adapters';
import { error, fail } from '@sveltejs/kit';
import { airportFromICAO, distanceBetween } from '$lib/utils';
import { db } from '$lib/db';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import duration from 'dayjs/plugin/duration';

dayjs.extend(customParseFormat);
dayjs.extend(duration);

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

    const fromAirport = airportFromICAO(from);
    if (!fromAirport) {
      return returnError(form, 'from', 'Invalid airport code');
    }
    const toAirport = airportFromICAO(to);
    if (!toAirport) {
      return returnError(form, 'to', 'Invalid airport code');
    }

    const departureDate = dayjs(form.data.departure);
    if (departureDate.isBefore(dayjs('1970-01-01'))) {
      // Y2K38
      return returnError(form, 'departure', 'Too far in the past');
    }

    let departure: Date | undefined;
    try {
      departure = form.data.departureTime
        ? mergeTimeWithDate(departureDate, form.data.departureTime).toDate()
        : undefined;
    } catch (e) {
      return returnError(form, 'departureTime', 'Invalid time format');
    }

    const arrivalDate = form.data.arrival
      ? dayjs(form.data.arrival)
      : undefined;
    if (arrivalDate && arrivalDate.isBefore(dayjs('1970-01-01'))) {
      return returnError(form, 'arrival', 'Too far in the past');
    }
    if (arrivalDate && arrivalDate.isBefore(departureDate)) {
      return returnError(form, 'arrival', 'Arrival must be after departure');
    }

    let arrival: Date | undefined;
    try {
      arrival =
        arrivalDate && form.data.arrivalTime
          ? mergeTimeWithDate(arrivalDate, form.data.arrivalTime).toDate()
          : undefined;
    } catch (e) {
      return returnError(form, 'arrivalTime', 'Invalid time format');
    }

    let duration: number | undefined;
    if (departure && arrival) {
      duration = Math.round(
        Math.abs(arrival.getTime() - departure.getTime()) / 1000,
      );
    } else if (fromAirport != toAirport) {
      // if the airports are the same, the duration can't be calculated
      const fromLonLat = { lon: fromAirport.lon, lat: fromAirport.lat };
      const toLonLat = { lon: toAirport.lon, lat: toAirport.lat };
      const distance = distanceBetween(fromLonLat, toLonLat) / 1000;
      const durationHours = distance / 805 + 0.5; // 805 km/h is the average speed of a commercial jet, add 0.5 hours for takeoff and landing
      duration = Math.round(dayjs.duration(durationHours, 'hours').asSeconds());
    }

    const resp = await db
      .insertInto('flight')
      .values({
        userId: user.id,
        from,
        to,
        duration,
        departure,
        arrival,
        date: departureDate.format('YYYY-MM-DD'),
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

const returnError = (
  form: Awaited<ReturnType<typeof superValidate>>,
  field: string,
  message: string,
) => {
  setError(form, field, message);
  return fail(400, { form });
};
