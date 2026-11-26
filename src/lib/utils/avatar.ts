/** Where a stored profile picture is served. The hash busts caches. */
export const avatarUrl = (userId: string, hash: string) =>
  `/api/users/${encodeURIComponent(userId)}/avatar/${encodeURIComponent(hash)}`;
