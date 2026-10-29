import { TRPCError } from '@trpc/server';

import { authedProcedure, router } from '../trpc';

import { DEFAULT_FLIGHT_SCOPE } from '$lib/flight-scope';
import { canExportFlights } from '$lib/server/authorization/flight';
import {
  disableFeed,
  enableFeed,
  getFeed,
  regenerateFeedToken,
  updateFeed,
} from '$lib/server/utils/calendar-feed';
import { calendarUpdateSchema } from '$lib/zod/calendar';

const requireExportPermission = (
  authorization: Parameters<typeof canExportFlights>[0],
) => {
  if (!canExportFlights(authorization, DEFAULT_FLIGHT_SCOPE)) {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
};

export const calendarRouter = router({
  get: authedProcedure.query(async ({ ctx: { user } }) => {
    const feed = await getFeed(user.id);
    if (!feed) {
      return { enabled: false as const };
    }

    return {
      enabled: true as const,
      token: feed.token,
      reminderOffsetMinutes: feed.reminderOffsetMinutes,
      showEmoji: feed.showEmoji,
      lastFetched: feed.lastFetched,
    };
  }),

  enable: authedProcedure.mutation(async ({ ctx: { user, authorization } }) => {
    requireExportPermission(authorization);
    return await enableFeed(user.id);
  }),

  update: authedProcedure
    .input(calendarUpdateSchema)
    .mutation(async ({ ctx: { user }, input }) => {
      return await updateFeed(user.id, input);
    }),

  regenerate: authedProcedure.mutation(
    async ({ ctx: { user, authorization } }) => {
      requireExportPermission(authorization);
      return await regenerateFeedToken(user.id);
    },
  ),

  disable: authedProcedure.mutation(async ({ ctx: { user } }) => {
    await disableFeed(user.id);
    return { ok: true as const };
  }),
});
