import { createHash } from 'node:crypto';

import sharp from 'sharp';

import { env } from '$env/dynamic/private';
import { db } from '$lib/db';
import type { User } from '$lib/db/types';
import { MAX_FILE_SIZE } from '$lib/server/utils/uploads';

export const AVATAR_SIZE = 256;
export const MAX_AVATAR_INPUT_SIZE = MAX_FILE_SIZE;
export const ALLOWED_AVATAR_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/avif',
];

const OAUTH_PICTURE_TIMEOUT_MS = 5_000;
// Decoding stops past this many pixels, so a small file cannot expand into a
// huge bitmap.
const MAX_INPUT_PIXELS = 40_000_000;

export type AvatarSource = NonNullable<User['avatarSource']>;

export class AvatarError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AvatarError';
  }
}

/**
 * Re-encodes an image as a square WebP. Re-encoding drops EXIF and other
 * metadata (such as GPS position) and keeps only the first animation frame.
 * Vector formats are rejected because SVG can carry scripts.
 */
export const processAvatar = async (input: Uint8Array): Promise<Buffer> => {
  if (input.byteLength > MAX_AVATAR_INPUT_SIZE) {
    throw new AvatarError('Image is too large (max 5 MB)');
  }

  let format: string | undefined;
  try {
    ({ format } = await sharp(input, {
      limitInputPixels: MAX_INPUT_PIXELS,
    }).metadata());
  } catch {
    throw new AvatarError('File is not a supported image');
  }
  if (!format || !['png', 'jpeg', 'webp', 'gif', 'heif'].includes(format)) {
    throw new AvatarError('Use a PNG, JPEG, WebP, GIF or AVIF image');
  }

  try {
    return await sharp(input, {
      limitInputPixels: MAX_INPUT_PIXELS,
      failOn: 'error',
    })
      .rotate()
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover' })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new AvatarError('Could not read this image');
  }
};

export const avatarHash = (data: Uint8Array) =>
  createHash('sha256').update(data).digest('base64url').slice(0, 16);

/** Stores a processed avatar. Returns the new hash. */
export const setAvatar = async (
  userId: string,
  data: Buffer,
  source: AvatarSource,
) => {
  const hash = avatarHash(data);
  await db.transaction().execute(async (trx) => {
    await trx
      .insertInto('userAvatar')
      .values({ userId, data, updatedAt: new Date() })
      .onConflict((oc) =>
        oc.column('userId').doUpdateSet({ data, updatedAt: new Date() }),
      )
      .execute();
    await trx
      .updateTable('user')
      .set({ avatarHash: hash, avatarSource: source })
      .where('id', '=', userId)
      .execute();
  });
  return hash;
};

export const clearAvatar = async (userId: string) => {
  await db.transaction().execute(async (trx) => {
    await trx.deleteFrom('userAvatar').where('userId', '=', userId).execute();
    await trx
      .updateTable('user')
      .set({ avatarHash: null, avatarSource: null })
      .where('id', '=', userId)
      .execute();
  });
};

export const getAvatar = async (userId: string, hash: string) => {
  const row = await db
    .selectFrom('userAvatar')
    .innerJoin('user', 'user.id', 'userAvatar.userId')
    .select('userAvatar.data')
    .where('userAvatar.userId', '=', userId)
    .where('user.avatarHash', '=', hash)
    .executeTakeFirst();
  return row?.data ?? null;
};

/**
 * Whether the user's picture comes from the identity provider and so cannot
 * be uploaded. Local accounts with no OAuth link can always upload.
 */
export const isAvatarManagedByOAuth = (
  user: Pick<User, 'oauthId'>,
  syncPicture: boolean,
) => syncPicture && !!user.oauthId;

const readLimited = async (response: Response, limit: number) => {
  const declared = Number(response.headers.get('content-length'));
  if (declared > limit) throw new AvatarError('Picture is too large');
  if (!response.body) throw new AvatarError('Picture response is empty');

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new AvatarError('Picture is too large');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
};

/**
 * Downloads the picture an identity provider points to. The URL comes from
 * the provider the admin configured, so hosts on the local network are
 * allowed; self-hosted providers often serve pictures from one.
 */
export const fetchOAuthPicture = async (
  rawUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Buffer> => {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new AvatarError('Picture URL is invalid');
  }
  const allowHttp = env.OAUTH_ALLOW_INSECURE_HTTP === 'true';
  if (url.protocol !== 'https:' && !(allowHttp && url.protocol === 'http:')) {
    throw new AvatarError(`Picture URL scheme ${url.protocol} is not allowed`);
  }

  const response = await fetchImpl(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(OAUTH_PICTURE_TIMEOUT_MS),
    headers: { Accept: 'image/*' },
  });
  if (!response.ok) {
    throw new AvatarError(`Picture request failed (${response.status})`);
  }
  const type = response.headers.get('content-type') ?? '';
  if (!type.toLowerCase().startsWith('image/')) {
    throw new AvatarError(`Picture has content type "${type}"`);
  }
  return readLimited(response, MAX_AVATAR_INPUT_SIZE);
};

const pictureClaim = (...sources: Record<string, unknown>[]) => {
  for (const source of sources) {
    const value = source.picture;
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
};

export type OAuthPictureAction =
  { kind: 'none' } | { kind: 'fetch'; url: string } | { kind: 'clear' };

/** Decides what a login does to the stored picture. */
export const planOAuthPictureSync = (
  user: Pick<User, 'avatarSource'>,
  syncPicture: boolean,
  profile: Record<string, unknown>,
  idTokenClaims: Record<string, unknown>,
): OAuthPictureAction => {
  if (!syncPicture) return { kind: 'none' };
  const url = pictureClaim(profile, idTokenClaims);
  if (url) return { kind: 'fetch', url };
  // The provider dropped the picture. An upload from before sync was turned
  // on stays until the provider supplies one.
  return user.avatarSource === 'oauth' ? { kind: 'clear' } : { kind: 'none' };
};

/**
 * Updates the user's picture from the identity provider. Failures are
 * logged and never block the login.
 */
export const syncOAuthPicture = async (
  user: Pick<User, 'id' | 'avatarHash' | 'avatarSource'>,
  syncPicture: boolean,
  profile: Record<string, unknown>,
  idTokenClaims: Record<string, unknown>,
) => {
  const action = planOAuthPictureSync(
    user,
    syncPicture,
    profile,
    idTokenClaims,
  );
  try {
    if (action.kind === 'clear') {
      await clearAvatar(user.id);
    } else if (action.kind === 'fetch') {
      const data = await processAvatar(await fetchOAuthPicture(action.url));
      const hash = avatarHash(data);
      if (hash !== user.avatarHash || user.avatarSource !== 'oauth') {
        await setAvatar(user.id, data, 'oauth');
      }
    }
  } catch (err) {
    console.warn(
      `Could not sync the identity provider picture for user ${user.id}:`,
      err instanceof Error ? err.message : err,
    );
  }
};
