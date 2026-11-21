import { json } from '@sveltejs/kit';

import { PassengerResolutionError } from '$lib/db/queries';
import { AuthorizationError } from '$lib/server/authorization/authorize';
import { RoleOperationError } from '$lib/server/authorization/roles';
import { CustomFieldValidationError } from '$lib/server/utils/custom-fields';
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

/** A domain error whose message is written for callers, as the v1 error it maps to. */
export const asApiOperationError = (
  error: unknown,
): ApiOperationError | null => {
  if (error instanceof ApiOperationError) return error;
  if (
    error instanceof CustomFieldValidationError ||
    error instanceof PassengerResolutionError
  )
    return new ApiOperationError('validation_failed', error.message);
  if (error instanceof RoleOperationError)
    return new ApiOperationError(ROLE_ERROR_CODE[error.kind], error.message);
  if (error instanceof AuthorizationError)
    return new ApiOperationError(
      authorizationErrorCode(error.status),
      error.message,
    );
  return null;
};

export const handleApiV1Error = (error: unknown) => {
  const known = asApiOperationError(error);
  if (known) return apiV1Error(known.code, known.message, known.details);
  console.error('[api/v1] unhandled error', error);
  return apiV1Error('internal_error', 'The request could not be completed');
};
