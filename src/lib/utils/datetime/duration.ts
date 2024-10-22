import type { LngLatLike } from 'maplibre-gl';
import { distanceBetween } from '$lib/utils';

export class Duration {
  private hours: number;
  private minutes: number;

  constructor(hours: number, minutes: number) {
    this.hours = hours;
    this.minutes = minutes;
  }

  static fromSeconds(seconds: number): Duration {
    const totalMinutes = Math.floor(seconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return new Duration(hours, minutes);
  }

  toString(): string {
    return `${this.hours}h ${this.minutes}m`;
  }
}

export const estimateFlightDuration = (from: LngLatLike, to: LngLatLike) => {
  const distance = distanceBetween(from, to) / 1000;
  const durationHours = distance / 805 + 0.5; // 805 km/h is the average speed of a commercial jet, add 0.5 hours for takeoff and landing
  return Math.round(durationHours * 3600);
};
