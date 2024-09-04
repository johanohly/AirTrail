import dayjs from 'dayjs';

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
