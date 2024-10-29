import type { LngLatLike } from 'maplibre-gl';
import { distanceBetween } from '$lib/utils';

export class Duration {
  readonly days: number;
  readonly hours: number;
  readonly minutes: number;

  constructor(days: number, hours: number, minutes: number) {
    this.days = days;
    this.hours = hours;
    this.minutes = minutes;
  }

  static fromSeconds(seconds: number): Duration {
    const days = Math.floor(seconds / 86400);
    const remainingSeconds = seconds % 86400;
    const hours = Math.floor(remainingSeconds / 3600);
    const remainingMinutes = remainingSeconds % 3600;
    const minutes = Math.floor(remainingMinutes / 60);
    return new Duration(days, hours, minutes);
  }

  toString(includeDays: boolean = false): string {
    if (includeDays) {
      return `${this.days}d ${this.hours}h ${this.minutes}m`;
    }
    const hours = this.days * 24 + this.hours;
    return `${hours}h ${this.minutes}m`;
  }
}

export const estimateFlightDuration = (from: LngLatLike, to: LngLatLike) => {
  const distance = distanceBetween(from, to) / 1000;
  const durationHours = distance / 805 + 0.5; // 805 km/h is the average speed of a commercial jet, add 0.5 hours for takeoff and landing
  return Math.round(durationHours * 3600);
};
