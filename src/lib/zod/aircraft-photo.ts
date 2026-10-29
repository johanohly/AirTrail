import { z } from 'zod';

// zod v4: .url() is deprecated repo-wide; use a plain refine like mapResourceBaseUrl (config.ts)
const httpsUrl = z
  .string()
  .refine((value) => value.startsWith('https://'), 'HTTPS URL required');

// Raw Planespotters /pub/photos response (subset). thumbnail_large is not
// guaranteed on every photo — fall back to thumbnail.src.
export const planespottersResponseSchema = z.object({
  photos: z.array(
    z.object({
      thumbnail: z.object({ src: httpsUrl }),
      thumbnail_large: z.object({ src: httpsUrl }).optional(),
      link: httpsUrl, // carries ?utm_source=api — store verbatim (ToS)
      photographer: z.string(),
    }),
  ),
});

export type AircraftPhoto = {
  thumbnailSrc: string; // thumbnail_large?.src ?? thumbnail.src
  link: string;
  photographer: string;
};
