import type { PageUser, PublicUser, User } from '$lib/db/types';

export { publicUserFields as publicUserSelect } from '$lib/db/types';

export const toPublicUser = (user: PublicUser): PublicUser => {
  const {
    id,
    username,
    displayName,
    role,
    distanceUnit,
    windSpeedUnit,
    temperatureUnit,
    pressureUnit,
    timeFormat,
    dateFormat,
    weekStartsOn,
    flightTimeDisplay,
  } = user;

  return {
    id,
    username,
    displayName,
    role,
    distanceUnit,
    windSpeedUnit,
    temperatureUnit,
    pressureUnit,
    timeFormat,
    dateFormat,
    weekStartsOn,
    flightTimeDisplay,
  };
};

export const toPageUser = (user: User): PageUser => ({
  ...toPublicUser(user),
  hasOAuthLinked: Boolean(user.oauthId),
});
