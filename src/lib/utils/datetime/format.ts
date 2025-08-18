import type { TZDate } from '@date-fns/tz';

export const formatAsMonth = (date: TZDate) =>
  new Intl.DateTimeFormat(undefined, {
    timeZone: date.timeZone,
    month: 'short',
  }).format(date);
export const formatAsDate = (
  date: TZDate,
  monthAsNumber = false,
  includeYear = false,
) =>
  new Intl.DateTimeFormat(undefined, {
    timeZone: date.timeZone,
    day: 'numeric',
    month: monthAsNumber ? 'numeric' : 'short',
    year: includeYear ? 'numeric' : undefined,
  }).format(date);
export const formatAsDateTime = (date: TZDate) =>
  new Intl.DateTimeFormat(undefined, {
    timeZone: date.timeZone,
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: 'numeric',
  }).format(date);
export const formatAsTime = (date: TZDate, overrideLocale?: string) =>
  new Intl.DateTimeFormat(overrideLocale, {
    timeZone: date.timeZone,
    hour: 'numeric',
    minute: 'numeric',
  }).format(date);
