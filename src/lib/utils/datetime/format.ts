export const formatAsMonth = (date: Date, tzId: string) =>
  new Intl.DateTimeFormat(undefined, {
    timeZone: tzId,
    month: 'short',
  }).format(date);
export const formatAsDate = (date: Date, tzId: string, monthAsNumber = false, includeYear = false) =>
  new Intl.DateTimeFormat(undefined, {
    timeZone: tzId,
    day: 'numeric',
    month: monthAsNumber ? 'numeric' : 'short',
    year: includeYear ? 'numeric' : undefined,
  }).format(date);
export const formatAsDateTime = (date: Date, tzId: string) =>
  new Intl.DateTimeFormat(undefined, {
    timeZone: tzId,
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: 'numeric',
  }).format(date);
export const formatAsTime = (date: Date, tzId: string) =>
  new Intl.DateTimeFormat(undefined, {
    timeZone: tzId,
    hour: 'numeric',
    minute: 'numeric',
  }).format(date);
