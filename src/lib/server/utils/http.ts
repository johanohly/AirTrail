/** A Content-Type header's media type: parameters stripped, lower-cased. */
export const mediaType = (contentType: string | null) =>
  contentType?.split(';', 1)[0]?.trim().toLowerCase() ?? '';
