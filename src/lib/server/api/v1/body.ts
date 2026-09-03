import { ApiOperationError, zodErrorDetails } from './errors';
import type { ZodType } from 'zod';

export const parseJsonBody = async <T>(
  request: Request,
  schema: ZodType<T>,
) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiOperationError(
      'invalid_json',
      'Request body must be valid JSON',
      400,
    );
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    throw new ApiOperationError(
      'validation_failed',
      'Request validation failed',
      422,
      zodErrorDetails(parsed.error),
    );
  return parsed.data;
};

export const parsePositiveId = (value: string) => {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1)
    throw new ApiOperationError(
      'bad_request',
      'id must be a positive integer',
      400,
    );
  return id;
};
