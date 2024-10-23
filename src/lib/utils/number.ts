import { Duration } from '$lib/utils/datetime';

const formatter = new Intl.NumberFormat();

export const formatNumber = (n: number) => {
  return formatter.format(n);
};

export const kmToMiles = (km: number) => {
  return km * 0.6214;
};

export const formatDistance = (km: number, metric = true) => {
  return new Intl.NumberFormat(undefined, {
    style: 'unit',
    unit: metric ? 'kilometer' : 'mile',
    unitDisplay: 'short',
    maximumFractionDigits: 0,
  }).format(metric ? km : kmToMiles(km));
};

export const formatDuration = (seconds: number) => {
  return Duration.fromSeconds(seconds).toString(true);
};
