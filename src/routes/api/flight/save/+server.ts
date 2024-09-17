import { actionResult, setError, superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { flightSchema } from '$lib/zod/flight';
import { airportFromICAO } from '$lib/utils/data/airports';
import dayjs from 'dayjs';
import { estimateDuration, toISOString } from '$lib/utils';
import {
  createFlight,
  getFlight,
  updateFlight,
} from '$lib/server/utils/flight';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, request }) => {
  const formData = await request.formData();
  const form = await superValidate(formData, zod(flightSchema));
  if (!form.valid) {
    return actionResult('failure', { form });
  }

  const user = locals.user;
  if (!user) {
    return actionResult('error', 'Not logged in', 401);
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

  let arrivalDate = form.data.arrival ? dayjs(form.data.arrival) : undefined;
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
  if (form.data.arrivalTime && !arrivalDate) {
    arrivalDate = departureDate;
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
    duration = estimateDuration(fromLonLat, toLonLat);
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
      return actionResult(
        'error',
        'You do not have a seat on this flight',
        403,
      );
    }

    try {
      await updateFlight(updateId, values);
    } catch (e) {
      form.message = { type: 'error', text: 'Failed to update flight' };
      return actionResult('failure', { form });
    }

    form.message = { type: 'success', text: 'Flight updated successfully' };
    return actionResult('success', { form });
  }

  try {
    await createFlight(values);
  } catch (_) {
    form.message = { type: 'error', text: 'Failed to add flight' };
    return actionResult('failure', { form });
  }

  form.message = { type: 'success', text: 'Flight added successfully' };
  return actionResult('success', { form });
};

const timePartsRegex = /^(\d{1,2})(?::|\.|)(\d{2})(?:\s?(am|pm))?$/i;
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

  if (ampm) {
    let h = +hours;
    if (ampm.toLowerCase() === 'pm' && h < 12) {
      h += 12; // Add 12 hours between 1 and 11 PM
    }
    if (ampm.toLowerCase() === 'am' && h === 12) {
      h = 0; // 12 AM is 0 hours from midnight
    }

    return dateOnly.hour(h).minute(+minutes).second(0);
  }

  return dateOnly.hour(+hours).minute(+minutes).second(0);
};

const returnError = (
  form: Awaited<ReturnType<typeof superValidate>>,
  field: string,
  message: string,
) => {
  setError(form, field, message);
  return actionResult('failure', { form });
};
