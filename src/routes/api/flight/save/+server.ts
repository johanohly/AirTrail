import { actionResult, setError, superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { flightSchema } from '$lib/zod/flight';
import { airportFromICAO } from '$lib/utils/data/airports';
import {
  createFlight,
  getFlight,
  updateFlight,
} from '$lib/server/utils/flight';
import type { RequestHandler } from './$types';
import {
  differenceInSeconds,
  format,
  formatISO,
  isBefore,
  isValid,
  parse,
  parseISO,
} from 'date-fns';
import type { TZDate } from '@date-fns/tz';
import {
  estimateFlightDuration,
  isBeforeEpoch,
  parseLocalISO,
  toUtc,
} from '$lib/utils/datetime';
import { tz } from '@date-fns/tz/tz';

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

  const departureDate = toUtc(
    parseLocalISO(form.data.departure, fromAirport.tz),
  );
  if (isBeforeEpoch(departureDate)) {
    // Y2K38
    return returnError(form, 'departure', 'Too far in the past');
  }

  let departure: TZDate | undefined;
  try {
    departure = form.data.departureTime
      ? mergeTimeWithDate(
          form.data.departure,
          form.data.departureTime,
          fromAirport.tz,
        )
      : undefined;
    if (departure && !isValid(departure)) {
      return returnError(form, 'departureTime', 'Invalid time format');
    }
  } catch {
    return returnError(form, 'departureTime', 'Invalid time format');
  }

  const arrivalDate = form.data.arrival
    ? parseLocalISO(form.data.arrival, toAirport.tz)
    : undefined;
  if (arrivalDate && isBeforeEpoch(arrivalDate)) {
    return returnError(form, 'arrival', 'Too far in the past');
  }
  if (arrivalDate && !form.data.arrivalTime) {
    return returnError(
      form,
      'arrival',
      'Cannot have arrival date without time',
    );
  }

  if (form.data.arrivalTime && !form.data.arrival) {
    form.data.arrival = formatISO(departureDate);
  }

  let arrival: TZDate | undefined;
  try {
    arrival =
      form.data.arrival && form.data.arrivalTime
        ? mergeTimeWithDate(
            form.data.arrival,
            form.data.arrivalTime,
            toAirport.tz,
          )
        : undefined;
    if (arrival && !isValid(arrival)) {
      return returnError(form, 'arrivalTime', 'Invalid time format');
    }
  } catch {
    return returnError(form, 'arrivalTime', 'Invalid time format');
  }

  if (arrival && departure && isBefore(arrival, departure)) {
    return returnError(form, 'arrival', 'Arrival must be after departure');
  }

  let duration: number | null = null;
  if (departure && arrival) {
    duration = differenceInSeconds(arrival, departure);
  } else if (fromAirport != toAirport) {
    // if the airports are the same, the duration can't be calculated
    const fromLonLat = { lon: fromAirport.lon, lat: fromAirport.lat };
    const toLonLat = { lon: toAirport.lon, lat: toAirport.lat };
    duration = estimateFlightDuration(fromLonLat, toLonLat);
  }

  const { flightNumber, aircraft, aircraftReg, airline, flightReason, note } =
    form.data;

  const values = {
    from,
    to,
    duration,
    departure: departure ? toUtc(departure).toISOString() : null,
    arrival: arrival ? toUtc(arrival).toISOString() : null,
    date: format(departureDate, 'yyyy-MM-dd'),
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
    } catch {
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
  dateString: string,
  time: string,
  tzId: string,
): TZDate => {
  const date = parseISO(dateString);
  const match = time.match(timePartsRegex);
  if (!match) {
    throw new Error('Invalid time format');
  }
  const [, hourPart, minutePart, ampm] = match;
  if (!hourPart || !minutePart) {
    throw new Error('Invalid time format');
  }

  let hours = +hourPart;
  const minutes = +minutePart;

  if (ampm) {
    if (ampm.toLowerCase() === 'pm' && hours < 12) {
      hours += 12; // Add 12 hours between 1 and 11 PM
    }
    if (ampm.toLowerCase() === 'am' && hours === 12) {
      hours = 0; // 12 AM is 0 hours from midnight
    }
  }

  return parse(
    `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${hours}:${minutes}`,
    'yyyy-M-d H:m',
    new Date(),
    { in: tz(tzId) },
  );
};

const returnError = (
  form: Awaited<ReturnType<typeof superValidate>>,
  field: string,
  message: string,
) => {
  setError(form, field, message);
  return actionResult('failure', { form });
};
