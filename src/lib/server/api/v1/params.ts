import { ApiOperationError } from './errors';

/** A path `id` that must be a positive integer, in the v1 error shape. */
export const parsePositiveId = (value: string) => {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1)
    throw new ApiOperationError('bad_request', 'id must be a positive integer');
  return id;
};
