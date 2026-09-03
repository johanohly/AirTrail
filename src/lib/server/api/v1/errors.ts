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

export const apiV1Unauthorized = (scope?: string) =>
  apiV1Error(
    'unauthorized',
    'A valid bearer credential is required',
    401,
    undefined,
    {
      'WWW-Authenticate': [
        'Bearer',
        ...(scope ? [`scope="${scope}"`] : []),
      ].join(scope ? ' ' : ''),
    },
  );

export const zodErrorDetails = (error: ZodError) =>
  error.issues.map((issue) => ({
    code: issue.code,
    path: issue.path.map(String),
    message: issue.message,
  }));

export const responseHeaders = {
  'Cache-Control': 'private, no-store',
} as const;
