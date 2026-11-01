import { describe, expect, it } from 'vitest';

import { describeDelay } from './delay';

const at = (utc: string) => new Date(utc);

describe('describeDelay', () => {
  it('reports on time for equal instants', () => {
    const info = describeDelay(
      at('2024-01-16T03:00:00.000Z'),
      at('2024-01-16T03:00:00.000Z'),
    );
    expect(info).toEqual({
      status: 'on-time',
      seconds: 0,
      label: 'on time',
    });
  });

  it('describes a late departure', () => {
    const info = describeDelay(
      at('2024-01-16T03:30:00.000Z'),
      at('2024-01-16T03:00:00.000Z'),
    );
    expect(info.status).toBe('late');
    expect(info.seconds).toBe(1800);
    expect(info.label).toBe('30m late');
  });

  it('describes an early arrival', () => {
    const info = describeDelay(
      at('2024-01-16T09:45:00.000Z'),
      at('2024-01-16T10:00:00.000Z'),
    );
    expect(info.status).toBe('early');
    expect(info.seconds).toBe(-900);
    expect(info.label).toBe('15m early');
  });

  it('formats hour and minute components', () => {
    const info = describeDelay(
      at('2024-01-16T04:05:00.000Z'),
      at('2024-01-16T03:00:00.000Z'),
    );
    expect(info.status).toBe('late');
    expect(info.label).toBe('1h 5m late');
  });

  it('collapses deviations within the tolerance into on time', () => {
    const info = describeDelay(
      at('2024-01-16T03:00:30.000Z'),
      at('2024-01-16T03:00:00.000Z'),
      60,
    );
    expect(info.status).toBe('on-time');
    expect(info.seconds).toBe(30);
    expect(info.label).toBe('on time');
  });

  it('labels sub-minute deviations without tolerance (why the tooltip passes 60)', () => {
    const info = describeDelay(
      at('2024-01-16T03:00:30.000Z'),
      at('2024-01-16T03:00:00.000Z'),
    );
    expect(info.status).toBe('late');
    expect(info.label).toBe('0m late');
  });
});
