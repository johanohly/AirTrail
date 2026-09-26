import {
  parseFlightScopeSearchParams,
  type FlightScope,
} from '$lib/flight-scope';
import { ApiOperationError } from './errors';
import { decodeCursor, type FlightPage } from './services/flight-page';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const FLIGHT_SCOPE_ERRORS = {
  invalid_scope: 'Invalid scope',
  missing_user: 'A userId query parameter is required for user scope',
} as const;

export const parseFlightScope = (
  searchParams: URLSearchParams,
): FlightScope => {
  const parsed = parseFlightScopeSearchParams(searchParams);
  if (!parsed.success)
    throw new ApiOperationError(
      'bad_request',
      FLIGHT_SCOPE_ERRORS[parsed.reason],
    );
  return parsed.data;
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
