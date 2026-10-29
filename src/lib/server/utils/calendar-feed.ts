import { TRPCError } from '@trpc/server';

import { db } from '$lib/db';
import type { CalendarFeed } from '$lib/db/types';
import { generateString } from '$lib/server/utils/random';
import {
  DEFAULT_REMINDER_OFFSET,
  type CalendarUpdateInput,
} from '$lib/zod/calendar';

/**
 * A user has at most one feed; the row existing is what "enabled" means.
 * Tokens are stored in plaintext because they are handed back to the owner in
 * the settings UI.
 */
export const getFeed = async (userId: string): Promise<CalendarFeed | null> =>
  (await db
    .selectFrom('calendarFeed')
    .selectAll()
    .where('userId', '=', userId)
    .executeTakeFirst()) ?? null;

export const getFeedByToken = async (
  token: string,
): Promise<CalendarFeed | null> =>
  (await db
    .selectFrom('calendarFeed')
    .selectAll()
    .where('token', '=', token)
    .executeTakeFirst()) ?? null;

export const getFeedOwnerName = async (userId: string): Promise<string> =>
  (
    await db
      .selectFrom('user')
      .select('displayName')
      .where('id', '=', userId)
      .executeTakeFirst()
  )?.displayName ?? 'Flight';

export const enableFeed = async (userId: string) => {
  const existing = await getFeed(userId);
  if (existing) {
    return { token: existing.token, feed: existing };
  }

  const feed = await db
    .insertInto('calendarFeed')
    .values({
      userId,
      token: generateString(),
      reminderOffsetMinutes: DEFAULT_REMINDER_OFFSET,
      updatedAt: new Date(),
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return { token: feed.token, feed };
};

export const updateFeed = async (
  userId: string,
  input: CalendarUpdateInput,
) => {
  const feed = await db
    .updateTable('calendarFeed')
    .set({
      reminderOffsetMinutes: input.reminderOffsetMinutes,
      showEmoji: input.showEmoji,
      updatedAt: new Date(),
    })
    .where('userId', '=', userId)
    .returningAll()
    .executeTakeFirst();

  if (!feed) {
    throw new TRPCError({ code: 'NOT_FOUND' });
  }
  return feed;
};

export const regenerateFeedToken = async (userId: string) => {
  const feed = await db
    .updateTable('calendarFeed')
    .set({ token: generateString(), updatedAt: new Date() })
    .where('userId', '=', userId)
    .returningAll()
    .executeTakeFirst();

  if (!feed) {
    throw new TRPCError({ code: 'NOT_FOUND' });
  }
  return { token: feed.token, feed };
};

export const disableFeed = async (userId: string) => {
  await db.deleteFrom('calendarFeed').where('userId', '=', userId).execute();
};

/**
 * Record that the feed was just consumed. Best effort: a failed write should
 * never fail the request the calendar app is waiting on.
 */
export const touchFeed = async (feedId: number) => {
  try {
    await db
      .updateTable('calendarFeed')
      .set({ lastFetched: new Date() })
      .where('id', '=', feedId)
      .execute();
  } catch (error) {
    console.error('Failed to update calendar feed lastFetched:', error);
  }
};
