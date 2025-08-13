import type { FlightLookupOptions, FlightLookupResult } from './flight-lookup';
import { RequestRateLimiter } from '$lib/utils/ratelimiter';
import { appConfig } from '$lib/server/utils/config';
import {
  differenceInCalendarDays,
  format,
  isValid,
  parse,
  subDays,
  addDays,
} from 'date-fns';
import { getAirport } from '$lib/server/utils/airport';
import { airlineFromICAO } from '$lib/utils/data/airlines';
import { tz } from '@date-fns/tz';

const BASE_URL = 'https://prod.api.market/api/v1/aedbx/aerodatabox';
const rateLimiter = new RequestRateLimiter();

function sanitizeFlightNumber(fn: string): string {
  // Remove spaces and dashes, uppercase (e.g., "SK 728" -> "SK728")
  return fn.replace(/\s|-/g, '').toUpperCase();
}

function isValidDateWithin365(dateStr: string): boolean {
  const d = parse(dateStr, 'yyyy-MM-dd', new Date());
  if (!isValid(d)) return false;
  const diff = Math.abs(differenceInCalendarDays(d, new Date()));
  return diff <= 365;
}

export async function getFlightRoute(
  flightNumber: string,
  opts?: FlightLookupOptions,
): Promise<FlightLookupResult> {
  await rateLimiter.checkRequest();

  const config = await appConfig.get();
  const apiKey = config?.flight?.apiMarketKey ?? null;
  if (!apiKey) {
    // Fallback decision is handled by the unified getter; this is a safeguard
    throw new Error('AeroDataBox API key not configured');
  }

  const cleaned = sanitizeFlightNumber(flightNumber);

  const date = opts?.date;
  if (date && !isValidDateWithin365(date)) {
    throw new Error('Date must be within 365 days of today');
  }

  let url: string;
  if (date) {
    url = `${BASE_URL}/flights/Number/${encodeURIComponent(
      cleaned,
    )}/${date}?dateLocalRole=Both&withAircraftImage=false&withLocation=false`;
  } else {
    const now = new Date();
    const fromDate = format(subDays(now, 2), 'yyyy-MM-dd');
    const toDate = format(addDays(now, 2), 'yyyy-MM-dd');
    url = `${BASE_URL}/flights/Number/${encodeURIComponent(
      cleaned,
    )}/${fromDate}/${toDate}?dateLocalRole=Both&withAircraftImage=false&withLocation=false`;
  }

  // const resp = await fetch(url, {
  //   headers: {
  //     'x-api-market-key': apiKey,
  //   },
  // });
  //
  // if (resp.status === 204) {
  //   throw new Error('Flight not found');
  // }
  // if (!resp.ok) {
  //   throw new Error('Flight not found');
  // }

  type AedbxFlight = {
    departure: {
      airport: { icao: string; timeZone: string };
      revisedTime: { local: string };
    };
    arrival: {
      airport: { icao: string; timeZone: string };
      revisedTime: { local: string };
    };
    airline?: { icao?: string };
  };

  // const data = (await resp.json()) as AedbxFlight[];
  // if (!Array.isArray(data) || data.length === 0) {
  //   throw new Error('Flight not found');
  // }

  const data: AedbxFlight[] = JSON.parse(`[
  {
    "greatCircleDistance": {
      "meter": 399997.33,
      "km": 400.0,
      "mile": 248.55,
      "nm": 215.98,
      "feet": 1312327.2
    },
    "departure": {
      "airport": {
        "icao": "ESSA",
        "iata": "ARN",
        "name": "Stockholm -Arlanda",
        "shortName": "-Arlanda",
        "municipalityName": "Stockholm",
        "location": {
          "lat": 59.6519,
          "lon": 17.9186
        },
        "countryCode": "SE",
        "timeZone": "Europe/Stockholm"
      },
      "scheduledTime": {
        "utc": "2024-10-10 19:55Z",
        "local": "2024-10-10 21:55+02:00"
      },
      "revisedTime": {
        "utc": "2024-10-10 19:57Z",
        "local": "2024-10-10 21:57+02:00"
      },
      "terminal": "5",
      "checkInDesk": "71-80",
      "gate": "F35",
      "quality": ["Basic", "Live"]
    },
    "arrival": {
      "airport": {
        "icao": "EFHK",
        "iata": "HEL",
        "name": "Helsinki Vantaa",
        "shortName": "Vantaa",
        "municipalityName": "Helsinki",
        "location": {
          "lat": 60.3172,
          "lon": 24.9633
        },
        "countryCode": "FI",
        "timeZone": "Europe/Helsinki"
      },
      "scheduledTime": {
        "utc": "2024-10-10 20:55Z",
        "local": "2024-10-10 23:55+03:00"
      },
      "revisedTime": {
        "utc": "2024-10-10 20:47Z",
        "local": "2024-10-10 23:47+03:00"
      },
      "terminal": "2",
      "gate": "21",
      "baggageBelt": "11",
      "quality": ["Basic", "Live"]
    },
    "lastUpdatedUtc": "2024-10-10 21:12Z",
    "number": "SK 728",
    "callSign": "SAS728",
    "status": "Arrived",
    "codeshareStatus": "IsOperator",
    "isCargo": false,
    "aircraft": {
      "reg": "SE-RON",
      "modeS": "4AC9EE",
      "model": "Airbus A320 (Sharklets)"
    },
    "airline": {
      "name": "SAS",
      "iata": "SK",
      "icao": "SAS"
    }
  }
]`);

  const result: FlightLookupResult = [];
  for (const item of data) {
    const fromAirport = await getAirport(item.departure.airport.icao);
    const toAirport = await getAirport(item.arrival.airport.icao);

    if (!fromAirport || !toAirport) {
      continue;
    }

    const departureTime = parse(
      item.departure.revisedTime.local,
      'yyyy-MM-dd HH:mmxxx',
      new Date(),
      { in: tz(item.departure.airport.timeZone) },
    );
    const arrivalTime = parse(
      item.arrival.revisedTime.local,
      'yyyy-MM-dd HH:mmxxx',
      new Date(),
      { in: tz(item.arrival.airport.timeZone) },
    );

    const flightInfo = {
      from: fromAirport,
      to: toAirport,
      departure: departureTime,
      arrival: arrivalTime,
      airline: item.airline?.icao ? airlineFromICAO(item.airline.icao) : null,
    };

    result.push(flightInfo);
  }

  return result;
}
