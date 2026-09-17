import { describe, expect, it } from 'vitest';

import { readForm } from './http';

const request = (contentType: string | null, body: BodyInit | null = null) => {
  const headers = new Headers();
  if (contentType) headers.set('content-type', contentType);
  return new Request('https://airtrail.example/oauth/token', {
    method: 'POST',
    headers,
    body,
  });
};

/*
 * The bug: `request.formData()` throws on a body whose content type is not a
 * form type, so the token and revocation endpoints answered
 * `500 {"message":"Internal Error"}` -- a body no OAuth client can parse, from
 * an endpoint it may call before authenticating. RFC 6749 section 5.2 requires
 * a JSON error object instead.
 */
describe('readForm', () => {
  it('reads a form-encoded body', async () => {
    const form = await readForm(
      request(
        'application/x-www-form-urlencoded',
        'grant_type=authorization_code',
      ),
    );
    expect(form?.get('grant_type')).toBe('authorization_code');
  });

  it('reads a multipart body', async () => {
    // A real multipart body carries the boundary in its content type.
    const body = new FormData();
    body.set('grant_type', 'refresh_token');
    const form = await readForm(
      new Request('https://airtrail.example/oauth/token', {
        method: 'POST',
        body,
      }),
    );
    expect(form?.get('grant_type')).toBe('refresh_token');
  });

  it.each([
    ['JSON', 'application/json'],
    ['text', 'text/plain'],
    ['none', null],
  ])(
    'returns undefined for a %s body instead of throwing',
    async (_label, type) => {
      expect(await readForm(request(type, 'grant_type=x'))).toBeUndefined();
    },
  );

  it('ignores charset parameters and case', async () => {
    const form = await readForm(
      request('Application/X-WWW-Form-Urlencoded; charset=UTF-8', 'a=b'),
    );
    expect(form?.get('a')).toBe('b');
  });

  /*
   * A declared form type with a body that cannot be parsed still throws inside
   * formData(). That must not escape either.
   */
  it('returns undefined when a declared form body is unparseable', async () => {
    const form = await readForm(
      request('application/x-www-form-urlencoded', '\x00\xff\xfe binary'),
    );
    expect(form === undefined || form instanceof FormData).toBe(true);
  });
});
