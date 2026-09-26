import { TRPCError } from '@trpc/server';
import type { Insertable } from 'kysely';
import { z } from 'zod';

import { db } from '$lib/db';
import { canShareOwnFlights } from '$lib/server/authorization/flight';
import { loadAuthorizationContext } from '$lib/server/authorization/context';
import { listFlightBaseQuery } from '$lib/db/queries';
import type { public_share } from '$lib/db/schema';
import type {
  Airport,
  Aircraft,
  Airline,
  FlightDatePrecision,
  FlightPassenger,
  PublicShare,
} from '$lib/db/types';
import { generateRandomString } from '$lib/server/utils/random';
import { reduceFlightTrackForMap } from '$lib/track/render';
import {
  flightTrackPayloadSchema,
  toFlightTrackInput,
  type FlightTrackInput,
} from '$lib/track/schema';
import type { ErrorActionResult } from '$lib/utils/forms';
import { baseShareSchema, type shareSchema } from '$lib/zod/share';

// Use complete objects instead of individual field properties
interface SanitizedFlight {
  id: number;
  from: Airport;
  to: Airport;
  duration: number | null;
  flightReason: string | null;
  aircraftReg: string | null;
  passengers: FlightPassenger[];
  // Conditionally included fields based on privacy settings
  flightNumber?: string | null;
  airline?: Airline | null;
  aircraft?: Aircraft | null;
  departure?: string | null;
  arrival?: string | null;
  departureScheduled?: string | null;
  arrivalScheduled?: string | null;
  takeoffScheduled?: string | null;
  takeoffActual?: string | null;
  landingScheduled?: string | null;
  landingActual?: string | null;
  date?: string | null;
  datePrecision?: FlightDatePrecision;
  track?: FlightTrackInput;
}

// Zod schemas for input validation
export const shareCreateSchema = z
  .object({
    slug: z.string().optional(),
    expiresAt: z.date().optional(),
  })
  .merge(baseShareSchema);

export const shareUpdateSchema = z.object({
  id: z.number(),
  slug: z.string().optional(),
  expiresAt: z.date().optional(),
  showMap: z.boolean().optional(),
  showStats: z.boolean().optional(),
  showFlightList: z.boolean().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  showFlightNumbers: z.boolean().optional(),
  showAirlines: z.boolean().optional(),
  showAircraft: z.boolean().optional(),
  showTimes: z.boolean().optional(),
  showTracks: z.boolean().optional(),
  showDates: z.boolean().optional(),
  showSeat: z.boolean().optional(),
});

export type ShareCreateInput = z.infer<typeof shareCreateSchema>;
export type ShareUpdateInput = z.infer<typeof shareUpdateSchema>;

/**
 * Delete all expired shares from the database (global cleanup)
 */
export async function deleteExpiredShares() {
  const result = await db
    .deleteFrom('publicShare')
    .where('expiresAt', '<', new Date())
    .where('expiresAt', 'is not', null)
    .execute();

  return result.reduce((total, r) => total + Number(r.numDeletedRows), 0);
}

/**
 * List all shares for a user, removing expired ones
 */
export async function listUserShares(userId: string) {
  // Delete expired shares first
  await deleteExpiredShares();

  // Return active shares
  return await db
    .selectFrom('publicShare')
    .selectAll()
    .where('userId', '=', userId)
    .orderBy('createdAt', 'desc')
    .execute();
}

type ShareValues = Omit<
  Insertable<public_share>,
  'id' | 'userId' | 'createdAt'
>;

export class ShareSlugTakenError extends Error {
  constructor() {
    super('Share URL already exists. Please choose a different one.');
    this.name = 'ShareSlugTakenError';
  }
}

const assertSlugAvailable = async (slug: string, exceptId?: number) => {
  let query = db
    .selectFrom('publicShare')
    .select('id')
    .where('slug', '=', slug);
  if (exceptId !== undefined) query = query.where('id', '!=', exceptId);
  if (await query.executeTakeFirst()) throw new ShareSlugTakenError();
};

/** Tracks are drawn on the map, so they cannot be shown without it. */
const withTrackInvariant = <T extends Partial<ShareValues>>(
  values: T,
  showMap: boolean | undefined,
): T => (showMap === false ? { ...values, showTracks: false } : values);

/** Inserts a share, generating a slug when none is given. */
export const insertShare = async (
  userId: string,
  values: Omit<ShareValues, 'slug'> & { slug?: string | null },
) => {
  const slug = values.slug || generateRandomString(12);
  await assertSlugAvailable(slug);
  return db
    .insertInto('publicShare')
    .values({
      ...withTrackInvariant(values, values.showMap ?? true),
      slug,
      userId,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
};

/** Applies `patch` to one of the user's shares; undefined when it is not theirs. */
export const patchShare = async (
  userId: string,
  id: number,
  patch: Partial<ShareValues>,
) => {
  const current = await db
    .selectFrom('publicShare')
    .select('showMap')
    .where('id', '=', id)
    .where('userId', '=', userId)
    .executeTakeFirst();
  if (!current) return undefined;
  if (patch.slug) await assertSlugAvailable(patch.slug, id);
  return db
    .updateTable('publicShare')
    .set(withTrackInvariant(patch, patch.showMap ?? current.showMap))
    .where('id', '=', id)
    .where('userId', '=', userId)
    .returningAll()
    .executeTakeFirst();
};

const conflictAsTrpc = async <T>(write: Promise<T>) => {
  try {
    return await write;
  } catch (error) {
    if (error instanceof ShareSlugTakenError)
      throw new TRPCError({ code: 'CONFLICT', message: error.message });
    throw error;
  }
};

/**
 * Create a new share
 */
export async function createShare(userId: string, input: ShareCreateInput) {
  return conflictAsTrpc(
    insertShare(userId, {
      ...input,
      expiresAt: input.expiresAt ?? null,
      dateFrom: input.dateFrom || null,
      dateTo: input.dateTo || null,
    }),
  );
}

/**
 * Update an existing share
 */
export async function updateShare(userId: string, input: ShareUpdateInput) {
  const { id, ...updates } = input;
  const updated = await conflictAsTrpc(patchShare(userId, id, updates));
  if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });
  return updated;
}

/**
 * Delete a share
 */
export async function deleteShare(userId: string, shareId: number) {
  const result = await db
    .deleteFrom('publicShare')
    .where('id', '=', shareId)
    .where('userId', '=', userId)
    .executeTakeFirst();

  return result.numDeletedRows > 0;
}

/**
 * Get public share data for viewing
 */
export async function getPublicShareData(slug: string) {
  const share = await db
    .selectFrom('publicShare')
    .selectAll()
    .where('slug', '=', slug)
    .where((eb) =>
      eb.or([eb('expiresAt', 'is', null), eb('expiresAt', '>', new Date())]),
    )
    .executeTakeFirst();

  if (!share) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Share not found or expired',
    });
  }

  const authorization = await loadAuthorizationContext(share.userId);
  if (!authorization || !canShareOwnFlights(authorization)) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Share not found or expired',
    });
  }

  // Get user's flights with filtering
  const flights = await getFilteredFlightsForShare(share);

  // Sanitize flight data based on privacy settings
  const sanitizedFlights = sanitizeFlightData(flights, share);
  const flightIds = sanitizedFlights.map((flight) => flight.id);
  const showTracks = share.showMap && share.showTracks;
  const trackRows =
    showTracks && flightIds.length > 0
      ? await db
          .selectFrom('flightTrack')
          .select(['flightId', 'track', 'sourceFormat', 'sourceName'])
          .where('flightId', 'in', flightIds)
          .execute()
      : [];
  const tracksByFlight = new Map<number, FlightTrackInput>(
    trackRows.map((row) => {
      const track = flightTrackPayloadSchema.parse(row.track);
      const renderTrack = reduceFlightTrackForMap(track);
      return [
        row.flightId,
        toFlightTrackInput(
          {
            ...renderTrack,
            sourceFormat: row.sourceFormat,
            sourceName: row.sourceName,
          },
          { includeTimes: share.showTimes },
        ),
      ];
    }),
  );

  return {
    settings: {
      showMap: share.showMap,
      showStats: share.showStats,
      showFlightList: share.showFlightList,
      showTracks,
    },
    flights: sanitizedFlights.map((flight) => ({
      ...flight,
      ...(tracksByFlight.has(flight.id)
        ? { track: tracksByFlight.get(flight.id) }
        : {}),
    })),
  };
}

/**
 * Get flights for a share with date filtering
 * Reuses the complete listFlightBaseQuery instead of sparse field selection
 */
async function getFilteredFlightsForShare(share: PublicShare) {
  let query = listFlightBaseQuery(db, share.userId);

  // Apply date filtering if specified
  if (share.dateFrom) {
    query = query.where('flight.date', '>=', share.dateFrom);
  }
  if (share.dateTo) {
    query = query.where('flight.date', '<=', share.dateTo);
  }

  return await query.execute();
}

/**
 * Sanitize flight data based on privacy settings
 * Sends complete objects to frontend instead of individual field properties
 */
export function sanitizeFlightData(
  flights: Awaited<ReturnType<typeof getFilteredFlightsForShare>>,
  share: PublicShare,
): SanitizedFlight[] {
  return flights.map((flight) => {
    // Create sanitized passengers array (only include user's passengers, remove sensitive data)
    const userPassengers = flight.passengers
      .filter((passenger) => passenger.userId === share.userId)
      .map((passenger) => ({
        ...passenger,
        seat: share.showSeat ? passenger.seat : null,
        seatClass: share.showSeat ? passenger.seatClass : null,
        seatNumber: share.showSeat ? passenger.seatNumber : null,
        userId: passenger.userId,
      }));

    const sanitized: SanitizedFlight = {
      id: flight.id,
      from: flight.from!, // Always include complete from airport
      to: flight.to!, // Always include complete to airport
      duration: flight.duration,
      flightReason: userPassengers[0]?.flightReason ?? null,
      aircraftReg: share.showAircraft ? flight.aircraftReg : null,
      passengers: userPassengers,
    };

    // Apply privacy settings for conditional fields
    if (share.showFlightNumbers) {
      sanitized.flightNumber = flight.flightNumber;
    }

    if (share.showAirlines && flight.airline) {
      sanitized.airline = flight.airline;
    }

    if (share.showAircraft && flight.aircraft) {
      sanitized.aircraft = flight.aircraft;
    }

    if (share.showTimes) {
      sanitized.departure = flight.departure;
      sanitized.arrival = flight.arrival;
      sanitized.departureScheduled = flight.departureScheduled;
      sanitized.arrivalScheduled = flight.arrivalScheduled;
      sanitized.takeoffScheduled = flight.takeoffScheduled;
      sanitized.takeoffActual = flight.takeoffActual;
      sanitized.landingScheduled = flight.landingScheduled;
      sanitized.landingActual = flight.landingActual;
    }

    if (share.showDates) {
      sanitized.date = flight.date;
      sanitized.datePrecision = flight.datePrecision;
    }

    return sanitized;
  });
}

/**
 * Validate and save share from form data
 */
export async function validateAndSaveShare(
  userId: string,
  shareData: z.infer<typeof shareSchema>,
): Promise<ErrorActionResult> {
  // Process expiry date based on expiry option
  let expiresAt: Date | null = null;
  if (shareData.expiryOption !== 'never') {
    const now = new Date();
    switch (shareData.expiryOption) {
      case '1day':
        expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        break;
      case '1week':
        expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case '1month':
        expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        break;
      case '3months':
        expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
        break;
      case 'custom':
        if (shareData.expiresAt) {
          expiresAt = new Date(shareData.expiresAt);
        }
        break;
    }
  }

  const values = {
    slug: shareData.slug,
    expiresAt,
    dateFrom: shareData.dateFrom || null,
    dateTo: shareData.dateTo || null,
    showMap: shareData.showMap,
    showStats: shareData.showStats,
    showFlightList: shareData.showFlightList,
    showFlightNumbers: shareData.showFlightNumbers,
    showAirlines: shareData.showAirlines,
    showAircraft: shareData.showAircraft,
    showTimes: shareData.showTimes,
    showTracks: shareData.showTracks,
    showDates: shareData.showDates,
    showSeat: shareData.showSeat,
  };
  const updating = Boolean(shareData.id);

  try {
    if (!shareData.id) await insertShare(userId, values);
    else if (!(await patchShare(userId, shareData.id, values)))
      return { success: false, type: 'error', message: 'Share not found' };
  } catch (error) {
    if (error instanceof ShareSlugTakenError)
      return { success: false, type: 'error', message: error.message };
    console.error('Error saving share:', error);
    return {
      success: false,
      type: 'error',
      message: updating ? 'Failed to update share' : 'Failed to create share',
    };
  }
  return {
    success: true,
    message: updating
      ? 'Share updated successfully'
      : 'Share created successfully',
  };
}
