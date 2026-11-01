import type { UserInfoResponse } from 'openid-client';
import { describe, expect, it } from 'vitest';

import { usernameFromProfile } from './username';

const profile = (claims: Partial<UserInfoResponse>) =>
  ({ sub: 'sub', ...claims }) as UserInfoResponse;

describe('usernameFromProfile', () => {
  it('prefers preferred_username', () => {
    expect(
      usernameFromProfile(
        profile({
          preferred_username: 'pilot',
          email: 'bob@example.com',
          email_verified: true,
        }),
      ),
    ).toBe('pilot');
  });

  it('falls back to the local part of a verified email', () => {
    expect(
      usernameFromProfile(
        profile({ email: 'bob@example.com', email_verified: true }),
      ),
    ).toBe('bob');
  });

  it('ignores an unverified email', () => {
    expect(
      usernameFromProfile(
        profile({ email: 'bob@example.com', email_verified: false }),
      ),
    ).toBeNull();
    expect(
      usernameFromProfile(profile({ email: 'bob@example.com' })),
    ).toBeNull();
  });

  it('fits the local part to the username rules', () => {
    expect(
      usernameFromProfile(
        profile({
          email: 'bob+flights.with.a.long.tag@example.com',
          email_verified: true,
        }),
      ),
    ).toBe('bob-flights.with.a.l');
  });
});
