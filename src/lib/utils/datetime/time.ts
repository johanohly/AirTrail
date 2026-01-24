import { Time } from '@internationalized/date';

const timePartsRegex = /^(\d{1,2})(?::|\.|)(\d{2})(?:\s?(am|pm))?$/i;

export const parseTimeValue = (value: string) => {
  const match = value.trim().match(timePartsRegex);
  if (!match) return undefined;

  const [, hourPart, minutePart, ampm] = match;
  if (!hourPart || !minutePart) return undefined;

  let hours = Number(hourPart);
  const minutes = Number(minutePart);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return undefined;

  if (ampm) {
    const period = ampm.toLowerCase();
    if (period === 'pm' && hours < 12) {
      hours += 12;
    }
    if (period === 'am' && hours === 12) {
      hours = 0;
    }
  }

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return undefined;
  }

  return new Time(hours, minutes);
};

export const formatTimeValue = (value: Time) => {
  const pad = (part: number) => part.toString().padStart(2, '0');
  return `${pad(value.hour)}:${pad(value.minute)}`;
};
