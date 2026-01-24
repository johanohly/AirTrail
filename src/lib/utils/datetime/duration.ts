import { quantify } from '$lib/utils/string';

export class Duration {
  readonly days: number;
  readonly hours: number;
  readonly minutes: number;
  readonly seconds: number;

  constructor(days: number, hours: number, minutes: number, seconds: number) {
    this.days = days;
    this.hours = hours;
    this.minutes = minutes;
    this.seconds = seconds;
  }

  static fromSeconds(seconds: number): Duration {
    const days = Math.floor(seconds / 86400);
    seconds -= days * 86400;
    const hours = Math.floor(seconds / 3600);
    seconds -= hours * 3600;
    const minutes = Math.floor(seconds / 60);
    seconds -= minutes * 60;
    return new Duration(days, hours, minutes, seconds);
  }

  toString(includeDays: boolean = false): string {
    if (includeDays) {
      const parts: string[] = [];
      if (this.days > 0) {
        parts.push(`${this.days}d`);
      }
      if (this.hours > 0) {
        parts.push(`${this.hours}h`);
      }
      if (this.minutes > 0 || parts.length === 0) {
        parts.push(`${this.minutes}m`);
      }
      return parts.join(' ');
    }
    const hours = this.days * 24 + this.hours;
    if (hours > 0) {
      return `${hours}h ${this.minutes}m`;
    }
    return `${this.minutes}m`;
  }

  toHuman(): string {
    if (this.days > 0) {
      return quantify(this.days, 'day');
    } else if (this.hours > 0) {
      return quantify(this.hours, 'hour');
    } else if (this.minutes > 0) {
      return quantify(this.minutes, 'minute');
    } else if (this.seconds > 0) {
      return quantify(this.seconds, 'second');
    } else {
      return 'no time';
    }
  }
}

export const estimateFlightDuration = (distance: number) => {
  const durationHours = distance / 805 + 0.5; // 805 km/h is the average speed of a commercial jet, add 0.5 hours for takeoff and landing
  return Math.round(durationHours * 3600);
};
