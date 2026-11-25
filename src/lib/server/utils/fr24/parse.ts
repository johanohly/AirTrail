// Shape we extract from one row of an FR24 airport-board response.
// Mirrors the dict produced by parse_flight() in the Python prototype
// at /Users/jack/Projects/flights/flights.py, with two intentional
// differences:
//   1. real / estimated times are kept separate (the prototype collapsed
//      them into one "actual" value), so the UI can show "h:mm Late" for
//      already-completed legs vs "Est. h:mm Late" for legs that have not
//      happened yet but already have an FR24-estimated delay.
//   2. originTz / destinationTz fields are present but always null after
//      parse — the router fills them in via the JTrail airports table.
export type FR24Leg = {
  flightNumber: string;
  /**
   * FR24's internal per-flight-instance ID (a hex string like "36c19c30").
   * Present for flights FR24 is actively tracking; null for purely-scheduled
   * future flights that haven't been assigned a live tracking session.
   * Used to build deep-link URLs that both desktop web AND the mobile app
   * resolve correctly — the bare /<flight_number> shortcut is desktop-web
   * only and the FR24 mobile app rejects it as "invalid link".
   */
  flightId: string | null;
  tail: string | null;
  origin: string | null;
  /** IANA tz name for the origin airport. Filled in by the router, not parse. */
  originTz: string | null;
  destination: string | null;
  /** IANA tz name for the destination airport. Filled in by the router, not parse. */
  destinationTz: string | null;
  airline: string;
  schedDep: number | null;
  schedArr: number | null;
  /** After-the-fact actual departure (wheels-off as reported by FR24). */
  realDep: number | null;
  /** After-the-fact actual arrival (gate-in as reported by FR24). */
  realArr: number | null;
  /** FR24 estimate for an upcoming departure. Null once realDep is known. */
  estDep: number | null;
  /** FR24 estimate for an upcoming arrival. Null once realArr is known. */
  estArr: number | null;
  /**
   * True when FR24 is actively receiving ADS-B pings for this flight session
   * right now — i.e. the aircraft's transponder is broadcasting and FR24 has
   * live position updates. Fires during taxi-out (engines up, still on the
   * ground) through in-flight through taxi-in, then flips false when the
   * plane parks and shuts down. Distinct from `flightId`, which stays set
   * before AND after the live window. Primary signal for "should this leg
   * get the emerald active-tracking treatment in the UI."
   */
  isLive: boolean;
  status: string;
};

// Parse one row from the FR24 airport pluginData.schedule.{departures,arrivals}.data array.
// FR24 returns deeply-nested dicts where any inner object can be null/missing,
// so we use the `value ?? {}` pattern at each level — keeps every subsequent
// `.<field>` lookup safe without a stack of optional chains.
export function parseLeg(raw: unknown): FR24Leg {
  const r = (raw ?? {}) as Record<string, any>;
  const ident = r.identification ?? {};
  const number = ident.number ?? {};
  const aircraft = r.aircraft ?? {};
  const airportInfo = r.airport ?? {};
  const originInfo = airportInfo.origin ?? {};
  const originCode = originInfo.code ?? {};
  const destInfo = airportInfo.destination ?? {};
  const destCode = destInfo.code ?? {};
  const airline = r.airline ?? {};
  const time = r.time ?? {};
  const scheduled = time.scheduled ?? {};
  const estimated = time.estimated ?? {};
  const real = time.real ?? {};
  const status = r.status ?? {};

  return {
    flightNumber: (number.default ?? '') as string,
    flightId: (ident.id ?? null) as string | null,
    tail: (aircraft.registration ?? null) as string | null,
    origin: (originCode.iata ?? null) as string | null,
    originTz: null,
    destination: (destCode.iata ?? null) as string | null,
    destinationTz: null,
    airline: (airline.name ?? 'Unknown') as string,
    schedDep: (scheduled.departure ?? null) as number | null,
    schedArr: (scheduled.arrival ?? null) as number | null,
    realDep: (real.departure ?? null) as number | null,
    realArr: (real.arrival ?? null) as number | null,
    estDep: (estimated.departure ?? null) as number | null,
    estArr: (estimated.arrival ?? null) as number | null,
    isLive: status.live === true,
    status: (status.text ?? 'Unknown') as string,
  };
}
