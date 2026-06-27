import { publicUserFields, type PublicUser } from '$lib/db/types';

export const publicUserSelect = publicUserFields;

export const toPublicUser = (user: PublicUser): PublicUser => {
  const {
    id,
    username,
    displayName,
    role,
    oauthId,
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
    oauthId,
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
