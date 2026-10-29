import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { db } from '$lib/db';
import { canAccessFlight } from '$lib/server/authorization/flight';
import { authedProcedure, permissionProcedure, router } from '$lib/server/trpc';
import {
  getAircraft,
  getAircraftByIcao,
  getAircraftByName,
} from '$lib/server/utils/aircraft';
import { getAircraftPhoto } from '$lib/server/utils/aircraft-photos';
import { appConfig } from '$lib/server/utils/config';
import { syncAircraft } from '$lib/server/utils/sync';
import type { AircraftPhoto } from '$lib/zod/aircraft-photo';

// Upsert on the PK — concurrent viewers of the same flight race on the first
// fetch and the last write wins with identical metadata.
const savePhoto = (
  flightId: number,
  reg: string,
  photo: AircraftPhoto,
  fetchedAt = new Date(),
) =>
  db
    .insertInto('flightPhoto')
    .values({
      flightId,
      reg,
      photoLink: photo.link,
      thumbnailUrl: photo.thumbnailSrc,
      photographer: photo.photographer,
      fetchedAt,
      updatedAt: new Date(),
    })
    .onConflict((oc) =>
      oc.column('flightId').doUpdateSet({
        reg,
        photoLink: photo.link,
        thumbnailUrl: photo.thumbnailSrc,
        photographer: photo.photographer,
        fetchedAt,
        updatedAt: new Date(),
      }),
    )
    .returningAll()
    .executeTakeFirst();

export const aircraftRouter = router({
  get: authedProcedure.input(z.number()).query(async ({ input }) => {
    return await getAircraft(input);
  }),
  getByIcao: authedProcedure.input(z.string()).query(async ({ input }) => {
    return await getAircraftByIcao(input);
  }),
  getByName: authedProcedure.input(z.string()).query(async ({ input }) => {
    return await getAircraftByName(input);
  }),
  getOrFetchPhoto: authedProcedure
    .input(z.number())
    .query(async ({ ctx: { authorization }, input }) => {
      if (!(await canAccessFlight(authorization, 'read', input))) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      const existing = await db
        .selectFrom('flightPhoto')
        .selectAll()
        .where('flightId', '=', input)
        .executeTakeFirst();

      const flight = await db
        .selectFrom('flight')
        .select('aircraftReg')
        .where('id', '=', input)
        .executeTakeFirst();
      const reg = flight?.aircraftReg;
      if (!reg) return null;

      // A stored photo pinned to a registration the flight no longer carries
      // (edited after the fetch) is stale — re-pin against the current reg.
      if (existing && existing.reg === reg.toUpperCase()) return existing;

      const photo = await getAircraftPhoto(reg);
      if (!photo) return null;

      // Writes during a query — idempotent and PK-guarded: at most one fetch
      // per flight is ever persisted here.
      return (await savePhoto(input, reg.toUpperCase(), photo)) ?? null;
    }),
  refetchPhoto: authedProcedure
    .input(
      z.object({
        flightId: z.number(),
        // Omitted → use the flight's stored reg (details-pane refetch).
        // null → the registration was cleared, drop the stored photo.
        // A string → the typed registration (edit-form blur, pre-save).
        reg: z.string().trim().min(2).max(10).nullish(),
      }),
    )
    .mutation(async ({ ctx: { authorization }, input }) => {
      if (!(await canAccessFlight(authorization, 'update', input.flightId))) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      const flight = await db
        .selectFrom('flight')
        .select('aircraftReg')
        .where('id', '=', input.flightId)
        .executeTakeFirst();
      if (!flight) throw new TRPCError({ code: 'NOT_FOUND' });

      const reg =
        input.reg === undefined ? flight.aircraftReg : (input.reg ?? null);
      if (!reg) {
        await db
          .deleteFrom('flightPhoto')
          .where('flightId', '=', input.flightId)
          .execute();
        return null;
      }

      // Re-fetch bypassing the in-memory cache.
      const photo = await getAircraftPhoto(reg, { bypassCache: true });
      if (!photo) {
        await db
          .deleteFrom('flightPhoto')
          .where('flightId', '=', input.flightId)
          .execute();
        return null;
      }

      return (
        (await savePhoto(input.flightId, reg.toUpperCase(), photo)) ?? null
      );
    }),
  previewPhotoByReg: authedProcedure
    .input(z.string().trim().min(2).max(10))
    .query(async ({ input }) => {
      if (!(await appConfig.get())?.integrations?.aircraftPhotosEnabled) {
        return null;
      }
      // Ephemeral: in-memory cache only, nothing is persisted.
      return await getAircraftPhoto(input);
    }),
  list: authedProcedure.query(async () => {
    return await db
      .selectFrom('aircraft')
      .selectAll()
      .orderBy('name')
      .execute();
  }),
  delete: permissionProcedure('data.aircraft.manage')
    .input(z.number())
    .mutation(async ({ input }) => {
      const result = await db
        .deleteFrom('aircraft')
        .where('id', '=', input)
        .execute();
      return result.length > 0;
    }),
  sync: permissionProcedure('data.aircraft.manage')
    .input(z.object({ overwrite: z.boolean().optional() }))
    .mutation(async ({ input }) => {
      return await syncAircraft(input);
    }),
});
