import type { Preferences } from '$lib/zod/user';

export const defaultPreferences: Preferences = {
  distanceUnit: 'km',
  windSpeedUnit: 'kt',
  temperatureUnit: 'c',
  pressureUnit: 'hpa',
  timeFormat: 'auto',
  dateFormat: 'auto',
  weekStartsOn: 'auto',
  flightTimeDisplay: 'airport',
};

type UserLike = Partial<Preferences> | null | undefined;

export function getPreferences(user: UserLike): Preferences {
  if (!user) return defaultPreferences;
  return {
    distanceUnit: user.distanceUnit ?? defaultPreferences.distanceUnit,
    windSpeedUnit: user.windSpeedUnit ?? defaultPreferences.windSpeedUnit,
    temperatureUnit: user.temperatureUnit ?? defaultPreferences.temperatureUnit,
    pressureUnit: user.pressureUnit ?? defaultPreferences.pressureUnit,
    timeFormat: user.timeFormat ?? defaultPreferences.timeFormat,
    dateFormat: user.dateFormat ?? defaultPreferences.dateFormat,
    weekStartsOn: user.weekStartsOn ?? defaultPreferences.weekStartsOn,
    flightTimeDisplay:
      user.flightTimeDisplay ?? defaultPreferences.flightTimeDisplay,
  };
}
