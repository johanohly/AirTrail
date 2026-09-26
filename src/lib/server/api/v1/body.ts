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
    );
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    throw new ApiOperationError(
      'validation_failed',
      'Request validation failed',
      zodErrorDetails(parsed.error),
    );
  return parsed.data;
};
