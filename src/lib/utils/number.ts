import { Duration } from '$lib/utils/datetime';

const formatter = new Intl.NumberFormat();

export const formatNumber = (n: number) => {
  return formatter.format(n);
};

export const formatDuration = (seconds: number) => {
  return Duration.fromSeconds(seconds).toString(true);
};

export const round = (n: number, decimals = 0) => {
  return Math.round(n * Math.pow(10, decimals)) / Math.pow(10, decimals);
};
