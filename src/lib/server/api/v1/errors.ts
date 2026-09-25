import { json } from '@sveltejs/kit';
import type { ZodError } from 'zod';

import {
  protectedResourceMetadataUrl,
  type ProtectedResourceKey,
} from '$lib/api/v1/resources';

export const responseHeaders = {
  'Cache-Control': 'private, no-store',
} as const;

export const API_V1_ERROR_CODES = [
  'bad_request',
  'conflict',
  'forbidden',
  'insufficient_scope',
  'internal_error',
  'invalid_json',
  'not_found',
  'unauthorized',
  'validation_failed',
] as const;

export type ApiV1ErrorCode = (typeof API_V1_ERROR_CODES)[number];

/** Each code has one status, so a throw site cannot pair them wrongly. */
export const API_V1_ERROR_STATUS: Record<ApiV1ErrorCode, number> = {
  bad_request: 400,
  conflict: 409,
  forbidden: 403,
  insufficient_scope: 403,
  internal_error: 500,
  invalid_json: 400,
  not_found: 404,
  unauthorized: 401,
  validation_failed: 422,
};

export class ApiOperationError extends Error {
  readonly status: number;

  constructor(
    readonly code: ApiV1ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiOperationError';
    this.status = API_V1_ERROR_STATUS[code];
  }
}

export const apiV1Error = (
  code: ApiV1ErrorCode,
  message: string,
  details?: unknown,
  headers?: HeadersInit,
) =>
  json(
    {
      error: {
        code,
        message,
        ...(details === undefined ? {} : { details }),
      },
    },
    {
      status: API_V1_ERROR_STATUS[code],
      headers: {
        ...responseHeaders,
        ...headers,
      },
    },
  );

/** RFC 9728 clients find where to authenticate from `resource_metadata`. */
export const apiV1Unauthorized = (
  resource: ProtectedResourceKey,
  scope?: string,
  origin?: string,
) => {
  const challenge = ['Bearer'];
  if (scope) challenge.push(`scope="${scope}"`);
  if (origin)
    challenge.push(
      `resource_metadata="${protectedResourceMetadataUrl(origin, resource)}"`,
    );
  return apiV1Error(
    'unauthorized',
    'A valid bearer credential is required',
    undefined,
    { 'WWW-Authenticate': challenge.join(', ') },
  );
};

export const zodErrorDetails = (error: ZodError) =>
  error.issues.map((issue) => ({
    code: issue.code,
    path: issue.path.map(String),
    message: issue.message,
  }));
