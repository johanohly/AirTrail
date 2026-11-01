import { error } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

import { listFlightBaseQuery } from '$lib/db/queries';
import { db } from '$lib/db';
import { DEFAULT_FLIGHT_SCOPE } from '$lib/flight-scope';
import { loadAuthorizationContext } from '$lib/server/authorization/context';
import { canExportFlights } from '$lib/server/authorization/flight';
import { buildCalendarFeed } from '$lib/server/utils/ical';
import {
  getFeedByToken,
  getFeedOwnerName,
  touchFeed,
} from '$lib/server/utils/calendar-feed';

/**
 * Public, unauthenticated calendar feed. The secret token in the path is the
 * credential, so anything that should not be served is answered with 404
 * rather than 401/403 to avoid confirming which tokens exist.
 */
export const GET: RequestHandler = async ({ params }) => {
  const token = params.token.replace(/\.ics$/, '');
  const feed = await getFeedByToken(token);
  if (!feed) {
    error(404, 'Calendar feed not found');
  }

  const authorization = await loadAuthorizationContext(feed.userId);
  if (
    !authorization ||
    !canExportFlights(authorization, DEFAULT_FLIGHT_SCOPE)
  ) {
    error(404, 'Calendar feed not found');
  }

  const [flights, displayName] = await Promise.all([
    listFlightBaseQuery(db, feed.userId).execute(),
    getFeedOwnerName(feed.userId),
  ]);

  const body = buildCalendarFeed(flights, {
    userId: feed.userId,
    displayName,
    showEmoji: feed.showEmoji,
    reminderOffsetMinutes: feed.reminderOffsetMinutes,
  });

  touchFeed(feed.id);

  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'private, no-cache',
    },
  });
};
