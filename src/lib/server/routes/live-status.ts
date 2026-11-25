import { TRPCError } from '@trpc/server';
import { sql } from 'kysely';
import { z } from 'zod';

import { authedProcedure, router } from '$lib/server/trpc';
import { db } from '$lib/db';
import {
  findFlightInstance,
  getTailHistoryToday,
  getBackupRoutes,
  type FR24Leg,
} from '$lib/server/utils/fr24';
import { buildFlightStatsUrlForLeg } from '$lib/server/utils/flightstats';

// Normalize a user-entered flight number to the form FR24's departures board
// uses: uppercase, no spaces/hyphens. "wn 500" → "WN500", "AA-1234" → "AA1234".
function sanitizeFlightNumber(fn: string): string {
  return fn.replace(/\s|-/g, '').toUpperCase();
}

export const liveStatusRouter = router({
  // Flights owned by the calling user that are "trackable now" — i.e. worth
  // showing in the live-status modal. The window is intentionally forgiving on
  // both ends so a flight doesn't blink out of the modal at scheduled push-back
  // just because `now` crossed the scheduled-departure timestamp.
  //
  // A flight qualifies when ALL of:
  //   Rule 1  – scheduled departure is <= 24 h in the future
  //             (i.e. COALESCE(departureScheduled, departure) <= now + 24h).
  //   Rule 2a – user has NOT populated an actual arrival timestamp yet. Once
  //             the user records that they're on the ground, the trip is done
  //             from JTrail's perspective and we stop tracking it.
  //   Rule 3  – it's still less than 6 h past the effective scheduled arrival,
  //             where effective arrival falls back to (scheduled dep + 24 h)
  //             if the user only entered a departure time. This is the hard
  //             backstop for cancelled flights and cases where FR24's DB
  //             never records a landing.
  //
  // Rule 2b (FR24 says landed) is enforced client-side in LiveStatusModal
  // against the cached rotation payload, so we never fan out FR24 calls from
  // this endpoint and never persist FR24 timings back to `flight.arrival`
  // (which is user-owned).
  //
  // Timestamps are ISO-8601 strings which sort chronologically, so plain
  // string comparison works without any timezone parsing.
  listUpcoming: authedProcedure.query(async ({ ctx: { user } }) => {
    const now = new Date();
    const in24hIso = new Date(
      now.getTime() + 24 * 60 * 60 * 1000,
    ).toISOString();
    const sixHoursAgoIso = new Date(
      now.getTime() - 6 * 60 * 60 * 1000,
    ).toISOString();

    const rows = await db
      .selectFrom('flight')
      .innerJoin('seat', 'seat.flightId', 'flight.id')
      .innerJoin('airport as fromAirport', 'fromAirport.id', 'flight.fromId')
      .innerJoin('airport as toAirport', 'toAirport.id', 'flight.toId')
      .leftJoin('airline', 'airline.id', 'flight.airlineId')
      .where('seat.userId', '=', user.id)
      .where('flight.flightNumber', 'is not', null)
      // Rule 2a — user hasn't logged the arrival yet.
      .where('flight.arrival', 'is', null)
      // Rule 1 — effective scheduled departure is <= 24 h in the future AND
      // known. Everything is `text` on disk (ISO-8601 UTC strings), so we cast
      // to timestamptz for the comparison so unusual formats can't sneak past
      // plain string ordering.
      .where(
        sql<boolean>`coalesce(
          ${sql.ref('flight.departureScheduled')},
          ${sql.ref('flight.departure')}
        )::timestamptz <= ${in24hIso}::timestamptz`,
      )
      // Rule 3 — effective scheduled arrival + 6 h hasn't passed yet.
      // Fallback chain: arrivalScheduled → (departureScheduled + 24 h) →
      // (departure + 24 h). The 24 h fallback is a generous placeholder for
      // legs where the user only entered a departure time. The 6 h grace is
      // applied by comparing against (now - 6 h) instead of `now`.
      .where(
        sql<boolean>`coalesce(
          ${sql.ref('flight.arrivalScheduled')}::timestamptz,
          ${sql.ref('flight.departureScheduled')}::timestamptz + interval '24 hours',
          ${sql.ref('flight.departure')}::timestamptz + interval '24 hours'
        ) >= ${sixHoursAgoIso}::timestamptz`,
      )
      .select([
        'flight.id',
        'flight.flightNumber',
        'flight.departureScheduled',
        'flight.departure',
        'fromAirport.iata as fromIata',
        'fromAirport.tz as fromTz',
        'fromAirport.name as fromName',
        'toAirport.iata as toIata',
        'toAirport.name as toName',
        'airline.name as airlineName',
        'airline.iconPath as airlineIconPath',
      ])
      .orderBy('flight.departureScheduled', 'asc')
      .orderBy('flight.departure', 'asc')
      .execute();

    return rows.map((row) => ({
      id: row.id,
      flightNumber: row.flightNumber as string,
      // Prefer the scheduled timestamp when present; fall back to the actual
      // gate-out timestamp. One of the two is guaranteed non-null by the WHERE.
      departureScheduled: (row.departureScheduled ?? row.departure) as string,
      from: { iata: row.fromIata, tz: row.fromTz, name: row.fromName },
      to: { iata: row.toIata, name: row.toName },
      airline: row.airlineName
        ? { name: row.airlineName, iconPath: row.airlineIconPath }
        : null,
    }));
  }),

  // FR24 rotation lookup for one upcoming flight. Returns the user's leg plus
  // each prior leg the assigned aircraft has flown today, plus alternative
  // same-day origin→destination flights.
  getRotation: authedProcedure
    .input(
      z.object({
        flightNumber: z.string().min(1),
        originIata: z.string().length(3),
        destinationIata: z.string().length(3),
        // Origin-airport tz used to compute the same-day cutoff for the
        // rotation walk. Required because the server's local TZ doesn't
        // generally match the user's flight origin TZ.
        originTz: z.string().min(1),
        // The user's scheduled departure from JTrail's DB, ISO-8601. Used
        // to disambiguate when FR24 returns multiple instances of the same
        // flight number (yesterday's, today's, tomorrow's, plus same-day
        // siblings on unrelated routes for airlines that reuse numbers).
        // We pick the instance whose schedDep is closest to this timestamp.
        schedDepIso: z.string().datetime({ offset: true }),
      }),
    )
    .query(async ({ input }) => {
      const cleaned = sanitizeFlightNumber(input.flightNumber);
      const originIata = input.originIata.toUpperCase();
      const destIata = input.destinationIata.toUpperCase();
      const targetSchedDepTs = Math.floor(
        new Date(input.schedDepIso).getTime() / 1000,
      );

      let yourLeg: FR24Leg | null;
      try {
        yourLeg = await findFlightInstance(
          cleaned,
          originIata,
          destIata,
          targetSchedDepTs,
        );
      } catch (err) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `FR24 unreachable: ${(err as Error)?.message ?? 'unknown'}`,
        });
      }

      // FR24 hasn't surfaced this flight yet (very early boarding calls or
      // unusual data gaps). Treat as a soft "not found" so the UI can render
      // a "check back later" empty state instead of an error toast.
      if (yourLeg === null) {
        return {
          kind: 'tail_not_found' as const,
          fetchedAt: new Date().toISOString(),
        };
      }

      const priorLegs =
        yourLeg.tail && yourLeg.schedDep
          ? await getTailHistoryToday(
              yourLeg.tail,
              yourLeg.schedDep,
              input.originTz,
              originIata,
            )
          : [];

      // Backup routes filter out flights scheduled to depart before the user's
      // own scheduled departure. The use case is "what if my flight is
      // cancelled or I miss it" — only later-departing alternatives are
      // actually catchable. Fall back to "now" if for some reason yourLeg
      // doesn't carry a scheduled departure timestamp.
      const backupCutoffTs = yourLeg.schedDep ?? Math.floor(Date.now() / 1000);
      const backupRoutes = await getBackupRoutes(
        originIata,
        destIata,
        cleaned,
        backupCutoffTs,
      );

      // Look up the IANA tz for every airport that appears in any leg. FR24
      // sometimes includes tz info in the response but its format is unstable;
      // the JTrail airports table is authoritative IANA. One DB query for the
      // whole rotation is cheaper than serializing tz onto every FR24 row.
      const allLegs = [yourLeg, ...priorLegs, ...backupRoutes];
      const iatas = new Set<string>();
      for (const leg of allLegs) {
        if (leg.origin) iatas.add(leg.origin);
        if (leg.destination) iatas.add(leg.destination);
      }
      const tzByIata = new Map<string, string>();
      if (iatas.size > 0) {
        const rows = await db
          .selectFrom('airport')
          .select(['iata', 'tz'])
          .where('iata', 'in', [...iatas])
          .execute();
        for (const r of rows) {
          if (r.iata) tzByIata.set(r.iata, r.tz);
        }
      }
      const enrich = (leg: FR24Leg): FR24Leg => ({
        ...leg,
        originTz: (leg.origin && tzByIata.get(leg.origin)) ?? null,
        destinationTz:
          (leg.destination && tzByIata.get(leg.destination)) ?? null,
      });

      const enrichedYourLeg = enrich(yourLeg);

      // FlightStats deep-link for the user's own leg. Skipped when the leg
      // is currently active on FR24 (isLive OR departed-but-not-arrived) —
      // the client's linkUrl coalesce hands FR24's live-map link priority
      // in that state anyway, so scraping FlightStats would waste an HTTP
      // round-trip on a URL the UI ignores. Runs for pre-departure 'mine'
      // legs and post-landing 'mine' legs (classify keeps yourLeg in 'mine'
      // state after landing until the 6h server rule hides the flight —
      // FlightStats' historical details page is still useful there for
      // actual-vs-scheduled comparisons).
      //
      // buildFlightStatsUrlForLeg swallows all errors and returns null, so
      // callers don't need an extra try/catch.
      const yourLegIsActive =
        enrichedYourLeg.isLive ||
        (enrichedYourLeg.realDep != null && enrichedYourLeg.realArr == null);
      const flightStatsUrl = yourLegIsActive
        ? null
        : await buildFlightStatsUrlForLeg(enrichedYourLeg, input.originTz);

      return {
        kind: 'ok' as const,
        yourLeg: enrichedYourLeg,
        priorLegs: priorLegs.map(enrich),
        backupRoutes: backupRoutes.map(enrich),
        flightStatsUrl,
        fetchedAt: new Date().toISOString(),
      };
    }),
});

export type LiveStatusRouter = typeof liveStatusRouter;
