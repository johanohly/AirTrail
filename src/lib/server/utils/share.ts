import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { db } from '$lib/db';
import { listFlightBaseQuery } from '$lib/db/queries';
import type {
  Airport,
  Aircraft,
  Airline,
  Seat,
  PublicShare,
} from '$lib/db/types';
import { generateRandomString } from '$lib/server/utils/random';
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
  seats: Seat[];
  // Conditionally included fields based on privacy settings
  flightNumber?: string | null;
  airline?: Airline | null;
  aircraft?: Aircraft | null;
  departure?: string | null;
  arrival?: string | null;
  date?: string | null;
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

/**
 * Create a new share
 */
export async function createShare(userId: string, input: ShareCreateInput) {
  const slug = input.slug || generateRandomString(12);

  // Check if slug already exists
  const existing = await db
    .selectFrom('publicShare')
    .select('slug')
    .where('slug', '=', slug)
    .executeTakeFirst();

  if (existing) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: 'Share URL already exists. Please choose a different one.',
    });
  }

  return await db
    .insertInto('publicShare')
    .values({
      userId,
      slug,
      expiresAt: input.expiresAt ? input.expiresAt.toISOString() : null,
      dateFrom: input.dateFrom || null,
      dateTo: input.dateTo || null,
      showMap: input.showMap,
      showStats: input.showStats,
      showFlightList: input.showFlightList,
      showFlightNumbers: input.showFlightNumbers,
      showAirlines: input.showAirlines,
      showAircraft: input.showAircraft,
      showTimes: input.showTimes,
      showDates: input.showDates,
      showSeat: input.showSeat,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    .returningAll()
    .executeTakeFirstOrThrow();
}

/**
 * Update an existing share
 */
export async function updateShare(userId: string, input: ShareUpdateInput) {
  const { id, ...updates } = input;

  // Check if slug already exists (if being updated)
  if (updates.slug) {
    const existing = await db
      .selectFrom('publicShare')
      .select('id')
      .where('slug', '=', updates.slug)
      .where('id', '!=', id)
      .executeTakeFirst();

    if (existing) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Share URL already exists. Please choose a different one.',
      });
    }
  }

  return await db
    .updateTable('publicShare')
    .set(updates)
    .where('id', '=', id)
    .where('userId', '=', userId)
    .returningAll()
    .executeTakeFirstOrThrow();
}

/**
 * Delete a share
 */
export async function deleteShare(userId: string, shareId: string) {
  const result = await db
    .deleteFrom('publicShare')
    .where('id', '=', parseInt(shareId))
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

  // Get user's flights with filtering
  const flights = await getFilteredFlightsForShare(share);

  // Sanitize flight data based on privacy settings
  const sanitizedFlights = sanitizeFlightData(flights, share);

  return {
    settings: {
      showMap: share.showMap,
      showStats: share.showStats,
      showFlightList: share.showFlightList,
    },
    flights: sanitizedFlights,
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
function sanitizeFlightData(
  flights: Awaited<ReturnType<typeof getFilteredFlightsForShare>>,
  share: PublicShare,
): SanitizedFlight[] {
  return flights.map((flight) => {
    // Create sanitized seats array (only include user's seats, remove sensitive data)
    const userSeats = flight.seats
      .filter((seat) => seat.userId === share.userId)
      .map((seat) => ({
        ...seat,
        seat: share.showSeat ? seat.seat : null,
        seatClass: share.showSeat ? seat.seatClass : null,
        seatNumber: share.showSeat ? seat.seatNumber : null,
        userId: seat.userId,
      }));

    const sanitized: SanitizedFlight = {
      id: flight.id,
      from: flight.from!, // Always include complete from airport
      to: flight.to!, // Always include complete to airport
      duration: flight.duration,
      flightReason: flight.flightReason,
      aircraftReg: flight.aircraftReg,
      seats: userSeats,
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
    }

    if (share.showDates) {
      sanitized.date = flight.date;
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

  // Generate slug if not provided
  const slug = shareData.slug || generateRandomString(12);

  // Check if updating existing share
  const isUpdating = !!shareData.id;

  if (isUpdating && shareData.id) {
    try {
      // Check if slug already exists (excluding current share)
      const existing = await db
        .selectFrom('publicShare')
        .select('id')
        .where('slug', '=', slug)
        .where('id', '!=', shareData.id)
        .where('userId', '=', userId)
        .executeTakeFirst();

      if (existing) {
        return {
          success: false,
          type: 'error',
          message: 'Share URL already exists. Please choose a different one.',
        };
      }

      // Update existing share
      await db
        .updateTable('publicShare')
        .set({
          slug,
          expiresAt: expiresAt ? expiresAt.toISOString() : null,
          dateFrom: shareData.dateFrom || null,
          dateTo: shareData.dateTo || null,
          showMap: shareData.showMap,
          showStats: shareData.showStats,
          showFlightList: shareData.showFlightList,
          showFlightNumbers: shareData.showFlightNumbers,
          showAirlines: shareData.showAirlines,
          showAircraft: shareData.showAircraft,
          showTimes: shareData.showTimes,
          showDates: shareData.showDates,
          showSeat: shareData.showSeat,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        .where('id', '=', shareData.id)
        .where('userId', '=', userId)
        .execute();

      return {
        success: true,
        message: 'Share updated successfully',
      };
    } catch (error) {
      console.error('Error updating share:', error);
      return {
        success: false,
        type: 'error',
        message: 'Failed to update share',
      };
    }
  } else {
    try {
      // Check if slug already exists
      const existing = await db
        .selectFrom('publicShare')
        .select('slug')
        .where('slug', '=', slug)
        .executeTakeFirst();

      if (existing) {
        return {
          success: false,
          type: 'error',
          message: 'Share URL already exists. Please choose a different one.',
        };
      }

      // Create new share
      await db
        .insertInto('publicShare')
        .values({
          userId,
          slug,
          expiresAt: expiresAt ? expiresAt.toISOString() : null,
          dateFrom: shareData.dateFrom || null,
          dateTo: shareData.dateTo || null,
          showMap: shareData.showMap,
          showStats: shareData.showStats,
          showFlightList: shareData.showFlightList,
          showFlightNumbers: shareData.showFlightNumbers,
          showAirlines: shareData.showAirlines,
          showAircraft: shareData.showAircraft,
          showTimes: shareData.showTimes,
          showDates: shareData.showDates,
          showSeat: shareData.showSeat,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        .execute();

      return {
        success: true,
        message: 'Share created successfully',
      };
    } catch (error) {
      console.error('Error creating share:', error);
      return {
        success: false,
        type: 'error',
        message: 'Failed to create share',
      };
    }
  }
}
