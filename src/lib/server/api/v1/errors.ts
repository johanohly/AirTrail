import { json } from '@sveltejs/kit';
import type { ZodError } from 'zod';

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

export class ApiOperationError extends Error {
  constructor(
    readonly code: ApiV1ErrorCode,
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiOperationError';
  }
}

export const apiV1Error = (
  code: ApiV1ErrorCode,
  message: string,
  status: number,
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
      status,
      headers: {
        'Cache-Control': 'private, no-store',
        ...headers,
      },
    },
  );

/*
 * RFC 9728 clients discover where to authenticate from `resource_metadata`.
 * /api/mcp already advertised it; /api/v1 did not, so a client that hit the
 * REST API first had no way to find the protected-resource document that
 * /.well-known/oauth-protected-resource/api/v1 has been serving all along.
 */
export const apiV1Unauthorized = (scope?: string, url?: URL) => {
  const challenge = ['Bearer'];
  if (scope) challenge.push(`scope="${scope}"`);
  if (url)
    challenge.push(
      `resource_metadata="${url.origin}/.well-known/oauth-protected-resource/api/v1"`,
    );
  return apiV1Error(
    'unauthorized',
    'A valid bearer credential is required',
    401,
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

export const responseHeaders = {
  'Cache-Control': 'private, no-store',
} as const;
