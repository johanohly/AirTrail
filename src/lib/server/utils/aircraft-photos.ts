import { isPublicDemo } from '$lib/server/demo/mode';
import { appConfig } from '$lib/server/utils/config';
import { createLookupCache } from '$lib/server/utils/lookup-cache';
import {
  type AircraftPhoto,
  type AircraftPhotoResult,
  PHOTO_BROWSER_CACHE_MS,
  planespottersResponseSchema,
} from '$lib/zod/aircraft-photo';

/*
 * Planespotters' terms (https://www.planespotters.net/photo/api) allow fetching
 * from a backend if responses are kept for at most 24 hours, URLs reach the
 * viewer unchanged, images load directly from their CDN in the viewer's browser
 * and the data isn't offered to anyone else. That is why nothing here touches
 * the database or the image files, and why this stays out of the REST API, MCP,
 * shares and exports.
 */
const PHOTOS_API = 'https://api.planespotters.net/pub/photos/reg';
const USER_AGENT = 'AirTrail (+https://github.com/johanohly/AirTrail)';
const FETCH_TIMEOUT_MS = 8000;
// The browser can hold a response through `staleTime` and `gcTime` after this.
const PHOTO_TTL_MS = 24 * 60 * 60 * 1000 - 2 * PHOTO_BROWSER_CACHE_MS;
const NO_PHOTO_TTL_MS = 60 * 60 * 1000;
const MIN_REQUEST_INTERVAL_MS = 1000;
/** Longer than this in line and the caller is better off retrying later. */
const MAX_QUEUE_WAIT_MS = 8000;
const DEFAULT_RATE_LIMIT_PAUSE_MS = 60 * 1000;
const MAX_RATE_LIMIT_PAUSE_MS = 60 * 60 * 1000;
const REGISTRATION_RE = /^[A-Z0-9][A-Z0-9-]{1,9}$/;

const cache = createLookupCache<AircraftPhoto | null>(5000);

let nextRequestAt = 0;
let pausedUntil = 0;

const toResult = (photo: AircraftPhoto | null): AircraftPhotoResult =>
  photo ? { status: 'found', photo } : { status: 'none' };

/*
 * The slot is claimed before the first `await`, so parallel callers line up
 * instead of all firing when a shared wait ends. The pause is checked again
 * after waiting because a 429 may have arrived in the meantime.
 */
const waitForRequestSlot = async () => {
  const now = Date.now();
  if (pausedUntil > now) return false;

  const slot = Math.max(now, nextRequestAt);
  if (slot - now > MAX_QUEUE_WAIT_MS) return false;
  nextRequestAt = slot + MIN_REQUEST_INTERVAL_MS;

  if (slot > now) {
    await new Promise((resolve) => setTimeout(resolve, slot - now));
  }
  return pausedUntil <= Date.now();
};

const rateLimitPauseMs = (retryAfter: string | null) => {
  if (!retryAfter) return DEFAULT_RATE_LIMIT_PAUSE_MS;

  const seconds = Number(retryAfter);
  const pause = Number.isNaN(seconds)
    ? Date.parse(retryAfter) - Date.now()
    : seconds * 1000;
  return pause > 0
    ? Math.min(pause, MAX_RATE_LIMIT_PAUSE_MS)
    : DEFAULT_RATE_LIMIT_PAUSE_MS;
};

const lookUpPhoto = async (reg: string): Promise<AircraftPhotoResult> => {
  if (!(await waitForRequestSlot())) return { status: 'unavailable' };

  try {
    const response = await fetch(`${PHOTOS_API}/${encodeURIComponent(reg)}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (response.status === 429) {
      const pause = rateLimitPauseMs(response.headers.get('Retry-After'));
      pausedUntil = Date.now() + pause;
      console.warn(
        `[aircraft-photos] rate limited, pausing lookups for ${Math.ceil(pause / 1000)}s`,
      );
      return { status: 'unavailable' };
    }
    if (!response.ok) {
      throw new Error(`Planespotters responded with ${response.status}`);
    }

    const { photos } = planespottersResponseSchema.parse(await response.json());
    const first = photos[0];
    const photo = first
      ? {
          thumbnailSrc: first.thumbnail_large?.src ?? first.thumbnail.src,
          link: first.link,
          photographer: first.photographer,
        }
      : null;
    cache.set(reg, photo, photo ? PHOTO_TTL_MS : NO_PHOTO_TTL_MS);
    return toResult(photo);
  } catch (err) {
    console.error(`[aircraft-photos] lookup failed for ${reg}:`, err);
    return { status: 'unavailable' };
  }
};

export const getAircraftPhoto = async (
  reg: string,
): Promise<AircraftPhotoResult> => {
  cache.deleteExpired();

  // Demo visitors are anonymous, so they don't get to drive outbound requests.
  if (isPublicDemo()) return { status: 'disabled' };

  const config = await appConfig.get();
  if (!config?.integrations?.aircraftPhotosEnabled) {
    return { status: 'disabled' };
  }

  const key = reg.trim().toUpperCase();
  if (!REGISTRATION_RE.test(key)) return { status: 'none' };

  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return toResult(cached.value);

  return cache.dedupe(key, () => lookUpPhoto(key));
};
