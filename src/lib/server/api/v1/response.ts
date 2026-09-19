import { json } from '@sveltejs/kit';

import { AuthorizationError } from '$lib/server/authorization/authorize';
import { RoleOperationError } from '$lib/server/authorization/roles';
import {
  ApiOperationError,
  apiV1Error,
  type ApiV1ErrorCode,
  responseHeaders,
} from './errors';

const ROLE_ERROR_CODE: Record<RoleOperationError['kind'], ApiV1ErrorCode> = {
  conflict: 'conflict',
  invalid: 'bad_request',
  not_found: 'not_found',
};

const authorizationErrorCode = (status: number): ApiV1ErrorCode =>
  status === 401 ? 'unauthorized' : status === 404 ? 'not_found' : 'forbidden';

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
    return apiV1Error(error.code, error.message, error.details);
  }
  // The role services throw these instead of an ApiOperationError. Without the
  // mapping an expected 409/404/403 surfaced as a 500 (and got logged as one).
  if (error instanceof RoleOperationError) {
    return apiV1Error(ROLE_ERROR_CODE[error.kind], error.message);
  }
  if (error instanceof AuthorizationError) {
    return apiV1Error(authorizationErrorCode(error.status), error.message);
  }
  // Unexpected errors are not shown to the caller, so they have to be logged
  // here or every 500 from the v1 API is undebuggable.
  console.error('[api/v1] unhandled error', error);
  return apiV1Error('internal_error', 'The request could not be completed');
};
