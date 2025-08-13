import { format, isToday, isTomorrow, isYesterday, isValid } from 'date-fns';

export const formatRelativeDate = (date: Date) => {
  if (!isValid(date)) return '';

  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  if (isTomorrow(date)) return 'Tomorrow';

  return format(date, 'PP');
};
