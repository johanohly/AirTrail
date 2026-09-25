import { describe, expect, it } from 'vitest';

import { CSRF_EXEMPT_PATHS, isCrossSiteFormPost } from './csrf';

const request = (
  overrides: Partial<Parameters<typeof isCrossSiteFormPost>[0]>,
) =>
  isCrossSiteFormPost({
    method: 'POST',
    pathname: '/api/flight/save/form',
    contentType: 'application/x-www-form-urlencoded',
    origin: null,
    expectedOrigin: 'https://airtrail.example',
    ...overrides,
  });

describe('cross-site form post detection', () => {
  it('blocks a form post with no Origin', () => {
    expect(request({})).toBe(true);
  });

  it('blocks a form post from another origin', () => {
    expect(request({ origin: 'https://evil.example' })).toBe(true);
  });

  it('allows a same-origin form post', () => {
    expect(request({ origin: 'https://airtrail.example' })).toBe(false);
  });

  it('ignores content types a form cannot produce', () => {
    expect(request({ contentType: 'application/json' })).toBe(false);
  });

  it('matches the content type ignoring parameters and case', () => {
    expect(request({ contentType: 'Multipart/Form-Data; boundary=abc' })).toBe(
      true,
    );
  });

  it('ignores safe methods', () => {
    expect(request({ method: 'GET' })).toBe(false);
    expect(request({ method: 'HEAD' })).toBe(false);
  });

  /*
   * The whole reason the built-in check had to be replaced. If these ever start
   * returning true again, every non-browser OAuth client breaks with a 403 that
   * only reproduces in a production build.
   */
  it.each([...CSRF_EXEMPT_PATHS])('allows %s without an Origin', (pathname) => {
    expect(request({ pathname })).toBe(false);
    expect(request({ pathname, origin: 'https://evil.example' })).toBe(false);
  });
});

describe('sveltekit configuration', () => {
  it('disables the built-in origin check this replaces', async () => {
    const { default: config } = await import('../../../../svelte.config.js');
    expect(config.kit?.csrf?.checkOrigin).toBe(false);
  });
});
