import { appConfig } from '$lib/server/utils/config';
import { RequestRateLimiter } from '$lib/utils/ratelimiter';
import type { AircraftPhoto } from '$lib/zod/aircraft-photo';
import { planespottersResponseSchema } from '$lib/zod/aircraft-photo';

// Planespotters photo API (https://www.planespotters.net/photo/api):
// keyless, returns the airframe's latest photo. ToS allows backend fetching
// only with the URLs passed through to the viewer unchanged and the images
// fetched directly from their CDN — we therefore cache/store JSON metadata
// only and never download, proxy or rewrite the image binaries.
const PHOTOS_API = 'https://api.planespotters.net/pub/photos/reg';
// ToS access identification: a unique, descriptive UA with a contact URL.
const USER_AGENT = 'AirTrail (+https://github.com/johanohly/AirTrail)';
// Caching the API response beyond 24h is not allowed by the ToS.
const TTL_MS = 24 * 60 * 60 * 1000;
const NEGATIVE_TTL_MS = 60 * 60 * 1000;
const ERROR_TTL_MS = 60_000;
const FETCH_TIMEOUT_MS = 8000;
// Cap bounds process memory under abusive registration enumeration.
const CACHE_MAX_ENTRIES = 5000;
const rateLimiter = new RequestRateLimiter(1, 1, 2, 1, 1000);

type CacheEntry = {
  value: AircraftPhoto | null;
  fetchedAt: number;
  expiresAt: number;
};
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<AircraftPhoto | null>>();

function setCacheEntry(key: string, entry: CacheEntry) {
  if (cache.has(key)) cache.delete(key); // move-to-end on update
  cache.set(key, entry);
  while (cache.size > CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

export async function getAircraftPhoto(
  reg: string,
  opts?: { bypassCache?: boolean },
): Promise<AircraftPhoto | null> {
  const cfg = await appConfig.get();
  if (!cfg?.integrations?.aircraftPhotosEnabled) return null;

  const key = reg.trim().toUpperCase();
  if (!key) return null;
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now && !opts?.bypassCache) {
    return cached.value;
  }

  const existing = inflight.get(key);
  if (existing && !opts?.bypassCache) return existing;

  const promise = (async () => {
    try {
      await rateLimiter.checkRequest();

      const photo = await fetchAircraftPhoto(key);
      setCacheEntry(key, {
        value: photo,
        fetchedAt: now,
        expiresAt: now + (photo ? TTL_MS : NEGATIVE_TTL_MS),
      });
      return photo;
    } catch (err) {
      console.error(`[aircraft-photos] fetch failed for ${key}:`, err);
      setCacheEntry(key, {
        value: null,
        fetchedAt: now,
        expiresAt: now + ERROR_TTL_MS,
      });
      return null;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}

async function fetchAircraftPhoto(key: string): Promise<AircraftPhoto | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(`${PHOTOS_API}/${encodeURIComponent(key)}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!resp.ok) {
      throw new Error(`Planespotters fetch ${resp.status} ${resp.statusText}`);
    }
    const parsed = planespottersResponseSchema.parse(await resp.json());
    const photo = parsed.photos[0];
    if (!photo) return null;
    return {
      thumbnailSrc: photo.thumbnail_large?.src ?? photo.thumbnail.src,
      link: photo.link,
      photographer: photo.photographer,
    };
  } finally {
    clearTimeout(timer);
  }
}
