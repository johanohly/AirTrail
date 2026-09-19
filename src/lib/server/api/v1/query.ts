import type { FlightScope } from '$lib/flight-scope';
import { ApiOperationError } from './errors';
import { decodeCursor, type FlightPage } from './flight-read';

/*
 * Query-string parsing lives at the transport boundary: routes pass raw values,
 * MCP passes its already-typed arguments, and both get the same typed domain
 * value or a v1 error. Services then accept `FlightScope` / `FlightPage`
 * directly instead of re-parsing HTTP artifacts.
 */

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export const parseFlightScope = (
  scope: string | null,
  userId: string | null,
): FlightScope => {
  if (scope === null || scope === 'mine') return { scope: 'mine' };
  if (scope === 'all') return { scope: 'all' };
  if (scope !== 'user')
    throw new ApiOperationError('bad_request', 'Invalid scope');
  if (!userId)
    throw new ApiOperationError(
      'bad_request',
      'A userId query parameter is required for user scope',
    );
  return { scope: 'user', userId };
};

export const parsePage = (
  limitValue: string | number | null,
  cursorValue: string | null,
): FlightPage => {
  const limit = limitValue === null ? DEFAULT_LIMIT : Number(limitValue);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT)
    throw new ApiOperationError('bad_request', 'Invalid pagination');
  if (cursorValue === null) return { limit, cursor: null };
  const cursor = decodeCursor(cursorValue);
  if (!cursor) throw new ApiOperationError('bad_request', 'Invalid cursor');
  return { limit, cursor };
};
