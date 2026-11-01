import { authedProcedure, permissionProcedure, router } from '../trpc';

import {
  disableFeed,
  enableFeed,
  getFeed,
  regenerateFeedToken,
  updateFeed,
} from '$lib/server/utils/calendar-feed';
import { calendarUpdateSchema } from '$lib/zod/calendar';

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

  enable: permissionProcedure('flight.export.own').mutation(
    async ({ ctx: { user } }) => {
      return await enableFeed(user.id);
    },
  ),

  update: permissionProcedure('flight.export.own')
    .input(calendarUpdateSchema)
    .mutation(async ({ ctx: { user }, input }) => {
      return await updateFeed(user.id, input);
    }),

  regenerate: permissionProcedure('flight.export.own').mutation(
    async ({ ctx: { user } }) => {
      return await regenerateFeedToken(user.id);
    },
  ),

  disable: authedProcedure.mutation(async ({ ctx: { user } }) => {
    await disableFeed(user.id);
    return { ok: true as const };
  }),
});
