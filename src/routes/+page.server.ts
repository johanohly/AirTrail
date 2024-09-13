import type { Actions, PageServerLoad } from './$types';
import { trpcServer } from '$lib/server/server';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { error, fail } from '@sveltejs/kit';
import { distanceBetween, toISOString } from '$lib/utils';
import { db } from '$lib/db';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import duration from 'dayjs/plugin/duration';
import { flightSchema } from '$lib/zod/flight';
import { airportFromICAO } from '$lib/utils/data/airports';
import {
  createFlight,
  getFlight,
  updateFlight,
} from '$lib/server/utils/flight';

dayjs.extend(customParseFormat);
dayjs.extend(duration);

export const load: PageServerLoad = async (event) => {
  await trpcServer.flight.list.ssr(event);

  return {
    users: (await db.selectFrom('user').selectAll().execute()).map(
      ({ password, ...rest }) => rest,
    ),
  };
};

export const actions: Actions = {
  'save-flight': async ({ locals, request }) => {
    const formData = await request.formData();
    const form = await superValidate(formData, zod(flightSchema));
    if (!form.valid) return fail(400, { form });

    const user = locals.user;
    if (!user) {
      return error(401, 'You must be logged in');
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

    let departureDate = dayjs(form.data.departure);
    if (departureDate.isBefore(dayjs('1970-01-01'))) {
      // Y2K38
      return returnError(form, 'departure', 'Too far in the past');
    }

    let departure: dayjs.Dayjs | undefined;
    try {
      departure = form.data.departureTime
        ? mergeTimeWithDate(departureDate, form.data.departureTime).subtract(
            fromAirport.tz,
            'minutes',
          ) // convert to UTC
        : undefined;
    } catch (e) {
      return returnError(form, 'departureTime', 'Invalid time format');
    }

    // adjust departureDate if a departure time is provided and makes it necessary - e.g. 23:00 EDT on the 1st is 03:00 UTC on the 2nd
    if (departure && departureDate.diff(departure, 'days') !== 0) {
      departureDate = departure;
    }

    const arrivalDate = form.data.arrival
      ? dayjs(form.data.arrival)
      : undefined;
    if (arrivalDate && arrivalDate.isBefore(dayjs('1970-01-01'))) {
      return returnError(form, 'arrival', 'Too far in the past');
    }
    if (arrivalDate && !form.data.arrivalTime) {
      return returnError(
        form,
        'arrival',
        'Cannot have arrival date without time',
      );
    }

    let arrival: dayjs.Dayjs | undefined;
    try {
      arrival =
        arrivalDate && form.data.arrivalTime
          ? mergeTimeWithDate(arrivalDate, form.data.arrivalTime).subtract(
              toAirport.tz,
              'minutes',
            ) // convert to UTC
          : undefined;
    } catch (e) {
      return returnError(form, 'arrivalTime', 'Invalid time format');
    }
    if (arrival && departure && arrival.isBefore(departure)) {
      return returnError(form, 'arrival', 'Arrival must be after departure');
    }

    let duration: number | null = null;
    if (departure && arrival) {
      duration = arrival.diff(departure, 'seconds');
    } else if (fromAirport != toAirport) {
      // if the airports are the same, the duration can't be calculated
      const fromLonLat = { lon: fromAirport.lon, lat: fromAirport.lat };
      const toLonLat = { lon: toAirport.lon, lat: toAirport.lat };
      const distance = distanceBetween(fromLonLat, toLonLat) / 1000;
      const durationHours = distance / 805 + 0.5; // 805 km/h is the average speed of a commercial jet, add 0.5 hours for takeoff and landing
      duration = Math.round(dayjs.duration(durationHours, 'hours').asSeconds());
    }

    const { flightNumber, aircraft, aircraftReg, airline, flightReason, note } =
      form.data;

    const values = {
      from,
      to,
      duration,
      departure: departure ? toISOString(departure) : null,
      arrival: arrival ? toISOString(arrival) : null,
      date: departureDate.format('YYYY-MM-DD'),
      flightNumber,
      aircraft,
      aircraftReg,
      airline,
      flightReason,
      note,
      seats: form.data.seats,
    };

    const updateId = form.data.id;
    if (updateId) {
      const flight = await getFlight(updateId);
      if (!flight || !flight.seats.some((seat) => seat.userId === user.id)) {
        throw new Error('You do not have a seat on this flight');
      }

      try {
        await updateFlight(updateId, values);
      } catch (e) {
        console.error(e);
        return message(form, {
          type: 'error',
          text: 'Failed to update flight',
        });
      }

      return message(form, {
        type: 'success',
        text: 'Flight updated successfully',
      });
    }

    try {
      await createFlight(values);
    } catch (_) {
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
