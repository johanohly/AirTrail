import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';

const { env } = vi.hoisted(() => ({
  env: {} as Record<string, string | undefined>,
}));

vi.mock('$env/dynamic/private', () => ({ env }));
vi.mock('$lib/db', () => ({ db: {} }));

import {
  AVATAR_SIZE,
  AvatarError,
  fetchOAuthPicture,
  isAvatarManagedByOAuth,
  planOAuthPictureSync,
  processAvatar,
} from './avatar';

const png = (width = 64, height = 32) =>
  sharp({
    create: { width, height, channels: 3, background: '#3366ff' },
  })
    .png()
    .toBuffer();

const imageResponse = (body: BodyInit, type = 'image/png') =>
  new Response(body, { headers: { 'content-type': type } });

describe('processAvatar', () => {
  it('outputs a square WebP without metadata', async () => {
    const withExif = await sharp(await png())
      .withMetadata({ exif: { IFD0: { Copyright: 'secret' } } })
      .jpeg()
      .toBuffer();
    const out = await processAvatar(withExif);
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(AVATAR_SIZE);
    expect(meta.height).toBe(AVATAR_SIZE);
    expect(meta.exif).toBeUndefined();
  });

  it('rejects SVG', async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>',
    );
    await expect(processAvatar(svg)).rejects.toBeInstanceOf(AvatarError);
  });

  it('rejects files that are not images', async () => {
    await expect(processAvatar(Buffer.from('hello'))).rejects.toBeInstanceOf(
      AvatarError,
    );
  });

  it('rejects oversized input', async () => {
    await expect(
      processAvatar(new Uint8Array(5 * 1024 * 1024 + 1)),
    ).rejects.toThrow('too large');
  });
});

describe('isAvatarManagedByOAuth', () => {
  it.each([
    [true, 'sub', true],
    [true, null, false],
    [false, 'sub', false],
  ])('sync %s, oauthId %s -> %s', (sync, oauthId, expected) => {
    expect(isAvatarManagedByOAuth({ oauthId }, sync)).toBe(expected);
  });
});

describe('planOAuthPictureSync', () => {
  const url = 'https://idp.example/pic.png';

  it('does nothing when sync is off', () => {
    expect(
      planOAuthPictureSync({ avatarSource: 'oauth' }, false, {}, {}),
    ).toEqual({ kind: 'none' });
  });

  it('prefers the userinfo claim over the ID token', () => {
    expect(
      planOAuthPictureSync(
        { avatarSource: null },
        true,
        { picture: url },
        { picture: 'https://other/pic.png' },
      ),
    ).toEqual({ kind: 'fetch', url });
  });

  it('falls back to the ID token claim', () => {
    expect(
      planOAuthPictureSync({ avatarSource: null }, true, {}, { picture: url }),
    ).toEqual({ kind: 'fetch', url });
  });

  it('clears a synced picture the provider no longer sends', () => {
    expect(
      planOAuthPictureSync({ avatarSource: 'oauth' }, true, {}, {}),
    ).toEqual({ kind: 'clear' });
  });

  it('keeps an upload when the provider sends no picture', () => {
    expect(
      planOAuthPictureSync({ avatarSource: 'upload' }, true, {}, {}),
    ).toEqual({ kind: 'none' });
  });
});

describe('fetchOAuthPicture', () => {
  it('returns the image bytes', async () => {
    const bytes = await png();
    const fetchImpl = vi.fn(async () => imageResponse(new Uint8Array(bytes)));
    const out = await fetchOAuthPicture(
      'https://idp.example/pic.png',
      fetchImpl as unknown as typeof fetch,
    );
    expect(out.equals(bytes)).toBe(true);
  });

  it('rejects http unless insecure OAuth is allowed', async () => {
    const fetchImpl = vi.fn(async () => imageResponse(new Uint8Array(1)));
    await expect(
      fetchOAuthPicture(
        'http://idp.local/pic.png',
        fetchImpl as unknown as typeof fetch,
      ),
    ).rejects.toThrow('not allowed');
    expect(fetchImpl).not.toHaveBeenCalled();

    env.OAUTH_ALLOW_INSECURE_HTTP = 'true';
    try {
      await fetchOAuthPicture(
        'http://idp.local/pic.png',
        fetchImpl as unknown as typeof fetch,
      );
      expect(fetchImpl).toHaveBeenCalledOnce();
    } finally {
      delete env.OAUTH_ALLOW_INSECURE_HTTP;
    }
  });

  it('rejects other schemes', async () => {
    await expect(fetchOAuthPicture('file:///etc/passwd')).rejects.toThrow(
      'not allowed',
    );
  });

  it('rejects non-image responses', async () => {
    const fetchImpl = vi.fn(async () =>
      imageResponse('<html></html>', 'text/html'),
    );
    await expect(
      fetchOAuthPicture(
        'https://idp.example/pic',
        fetchImpl as unknown as typeof fetch,
      ),
    ).rejects.toThrow('content type');
  });

  it('stops reading past the size limit', async () => {
    const chunk = new Uint8Array(1024 * 1024);
    let sent = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        sent += 1;
        if (sent > 10) controller.close();
        else controller.enqueue(chunk);
      },
    });
    const fetchImpl = vi.fn(async () => imageResponse(stream));
    await expect(
      fetchOAuthPicture(
        'https://idp.example/pic',
        fetchImpl as unknown as typeof fetch,
      ),
    ).rejects.toThrow('too large');
    expect(sent).toBeLessThan(10);
  });

  it('rejects failed responses', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 404 }));
    await expect(
      fetchOAuthPicture(
        'https://idp.example/pic',
        fetchImpl as unknown as typeof fetch,
      ),
    ).rejects.toThrow('404');
  });
});
