/**
 * Extract a human-readable error message from an unknown error value.
 * Handles tRPC error shapes, plain Error instances, and plain strings.
 */
export const getErrorText = (error: unknown): string => {
  if (!error || typeof error !== 'object') {
    return typeof error === 'string' ? error : '';
  }

  const candidate = error as {
    message?: string;
    data?: { code?: string };
    shape?: { message?: string };
    cause?: { message?: string };
  };

  return (
    candidate.message ||
    candidate.shape?.message ||
    candidate.cause?.message ||
    candidate.data?.code ||
    ''
  );
};
