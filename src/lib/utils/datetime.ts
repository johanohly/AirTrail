import dayjs from 'dayjs';
import { distanceBetween } from '$lib/utils/distance';
import type { LngLatLike } from 'maplibre-gl';

/**
 * Format a Dayjs object to a string in ISO format.
 * Cant use the built-in toISOString() because it returns the date in local time.
 */
export const toISOString = (d: dayjs.Dayjs) => {
  return d.format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');
};

export const isUsingAmPm = () => {
  return new Date().toLocaleTimeString().match(/am|pm/i) !== null;
};

export const estimateDuration = (from: LngLatLike, to: LngLatLike) => {
  const distance = distanceBetween(from, to) / 1000;
  const durationHours = distance / 805 + 0.5; // 805 km/h is the average speed of a commercial jet, add 0.5 hours for takeoff and landing
  return Math.round(dayjs.duration(durationHours, 'hours').asSeconds());
};
