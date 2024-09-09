import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';

dayjs.extend(duration);

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
  return dayjs.duration(seconds, 'seconds').format('D[d] H[h] m[m]');
};
