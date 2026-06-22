import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

import { apiError, unauthorized, validateApiKey } from '$lib/server/utils/api';
import { listAllFlights, listFlights } from '$lib/server/utils/flight';
import type { Flight } from '$lib/db/types';
import { distanceBetween } from '$lib/utils';

const topKey = (flights: Flight[], getKey: (f: Flight) => string | null) => {
  const counts = new Map<string, number>();
  for (const f of flights) {
    const k = getKey(f);
    if (k !== null) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [k, c] of counts) {
    if (c > bestCount) { best = k; bestCount = c; }
  }
  return { best, count: bestCount };
};

const computeStats = (flights: Flight[]) => {
  let totalDistanceKm = 0;
  let totalDurationSeconds = 0;
  const airportIds = new Set<string>();

  for (const flight of flights) {
    if (flight.from && flight.to) {
      totalDistanceKm += distanceBetween(
        [flight.from.lon, flight.from.lat],
        [flight.to.lon, flight.to.lat],
      ) / 1000;
    }

    if (flight.duration !== null) {
      totalDurationSeconds += flight.duration;
    }

    if (flight.from?.id) airportIds.add(String(flight.from.id));
    if (flight.to?.id) airportIds.add(String(flight.to.id));
  }

  const airlineResult = topKey(flights, (f) =>
    f.airline ? String(f.airline.id) : null,
  );
  const topAirline = airlineResult.best
    ? (() => {
        const a = flights.find((f) => String(f.airline?.id) === airlineResult.best)!.airline!;
        return { id: a.id, name: a.name, iata: a.iata, icao: a.icao, count: airlineResult.count };
      })()
    : null;

  const airportCounts = new Map<string, number>();
  for (const f of flights) {
    if (f.from?.id) airportCounts.set(String(f.from.id), (airportCounts.get(String(f.from.id)) ?? 0) + 1);
    if (f.to?.id) airportCounts.set(String(f.to.id), (airportCounts.get(String(f.to.id)) ?? 0) + 1);
  }
  let bestAirportId: string | null = null;
  let bestAirportCount = 0;
  for (const [id, c] of airportCounts) {
    if (c > bestAirportCount) { bestAirportId = id; bestAirportCount = c; }
  }
  const topAirport = bestAirportId
    ? (() => {
        const ap = flights.find(
          (f) => String(f.from?.id) === bestAirportId || String(f.to?.id) === bestAirportId,
        )!;
        const a = String(ap.from?.id) === bestAirportId ? ap.from! : ap.to!;
        return { id: a.id, name: a.name, icao: a.icao, iata: a.iata, count: bestAirportCount };
      })()
    : null;

  const aircraftResult = topKey(flights, (f) =>
    f.aircraft ? String(f.aircraft.id) : null,
  );
  const topAircraft = aircraftResult.best
    ? (() => {
        const a = flights.find((f) => String(f.aircraft?.id) === aircraftResult.best)!.aircraft!;
        return { id: a.id, name: a.name, icao: a.icao, count: aircraftResult.count };
      })()
    : null;

  const routeResult = topKey(flights, (f) =>
    f.from && f.to ? `${f.from.id}|${f.to.id}` : null,
  );
  const topRoute = routeResult.best
    ? (() => {
        const f = flights.find(
          (fl) => fl.from && fl.to && `${fl.from.id}|${fl.to.id}` === routeResult.best,
        )!;
        return {
          from: { id: f.from!.id, name: f.from!.name, icao: f.from!.icao, iata: f.from!.iata },
          to: { id: f.to!.id, name: f.to!.name, icao: f.to!.icao, iata: f.to!.iata },
          count: routeResult.count,
        };
      })()
    : null;

  return {
    flights: flights.length,
    distanceKm: Math.round(totalDistanceKm),
    durationSeconds: totalDurationSeconds,
    airports: airportIds.size,
    topAirline,
    topAirport,
    topAircraft,
    topRoute,
  };
};

export const GET: RequestHandler = async ({ request, url }) => {
  const user = await validateApiKey(request);
  if (!user) {
    return unauthorized();
  }

  const scope = url.searchParams.get('scope') ?? 'mine';

  if (scope === 'mine') {
    const flights = await listFlights(user.id);
    return json({ success: true, stats: computeStats(flights) });
  }

  if (user.role === 'user') {
    return apiError('Forbidden', 403);
  }

  if (scope === 'user') {
    const userId = url.searchParams.get('userId');
    if (!userId) {
      return apiError(
        'A userId query parameter is required for user scope',
        400,
      );
    }

    const flights = await listFlights(userId);
    return json({ success: true, stats: computeStats(flights) });
  }

  if (scope === 'all') {
    const flights = await listAllFlights();
    return json({ success: true, stats: computeStats(flights) });
  }

  return apiError('Invalid scope', 400);
};
