import type { UserInfoResponse } from 'openid-client';

/*
 * Not every provider sends `preferred_username`; Google doesn't. A verified
 * email's local part is the next best name, cut to what usernames allow.
 */
export const usernameFromProfile = (
  profile: UserInfoResponse,
): string | null => {
  if (profile.preferred_username) return profile.preferred_username;
  if (!profile.email || profile.email_verified !== true) return null;

  const localPart = profile.email.split('@')[0] ?? '';
  return localPart.replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 20) || null;
};
