import { z } from 'zod';

// These end up in `href` and `src`, so anything but HTTPS is rejected.
const httpsUrl = z
  .string()
  .refine((value) => value.startsWith('https://'), 'HTTPS URL required');

export const planespottersResponseSchema = z.object({
  photos: z.array(
    z.object({
      thumbnail: z.object({ src: httpsUrl }),
      thumbnail_large: z.object({ src: httpsUrl }).optional(),
      link: httpsUrl,
      photographer: z.string(),
    }),
  ),
});

export type AircraftPhoto = {
  thumbnailSrc: string;
  link: string;
  photographer: string;
};

export type AircraftPhotoResult =
  | { status: 'found'; photo: AircraftPhoto }
  | { status: 'none' }
  | { status: 'disabled' }
  | { status: 'unavailable' };
