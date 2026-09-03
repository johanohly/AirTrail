import { json } from '@sveltejs/kit';

import { ApiOperationError, apiV1Error, responseHeaders } from './errors';

export const apiV1Data = <T>(data: T, init?: ResponseInit) =>
  json(
    { data },
    { ...init, headers: { ...responseHeaders, ...init?.headers } },
  );

export const apiV1Collection = <T>(
  data: readonly T[],
  page: { nextCursor: string | null },
  init?: ResponseInit,
) =>
  json(
    { data, page },
    { ...init, headers: { ...responseHeaders, ...init?.headers } },
  );

export const handleApiV1Error = (error: unknown) => {
  if (error instanceof ApiOperationError) {
    return apiV1Error(error.code, error.message, error.status, error.details);
  }
  return apiV1Error(
    'internal_error',
    'The request could not be completed',
    500,
  );
};
