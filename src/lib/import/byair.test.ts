import { beforeEach, describe, expect, it, vi } from 'vitest';

import { processByAirFile } from './byair';

const { getAirportByIata } = vi.hoisted(() => ({
  getAirportByIata: vi.fn(async (iata: string) => ({
    id: iata,
    iata,
    tz: iata === 'HND' ? 'Asia/Tokyo' : 'America/Los_Angeles',
  })),
}));

vi.mock('$app/state', () => ({
  page: { data: { user: { id: 'user-1' } } },
}));

vi.mock('$lib/utils/data/airports/cache', () => ({ getAirportByIata }));

vi.mock('$lib/utils/data/airlines', () => ({
  getAirlineByIata: vi.fn(),
  getAirlineByIcao: vi.fn(),
}));

describe('processByAirFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps incomplete actual times and uses scheduled duration', async () => {
    const content = `Flight Code,Departure Airport Code,Arrival Airport Code,Booking Code,Seat Number,Seat Type,Seat Class,Purpose,Notes,Ownership,byAir Flight ID,byAir Codeshare ID,Scheduled Departure,Scheduled Arrival,Actual Departure,Actual Arrival
NH123,HND,LAX,,4A,window,business,business,,mine,,,2025-06-03 00:30,2025-06-02 18:30,2025-06-03 00:40,`;

    const result = await processByAirFile(content, {
      filterOwner: false,
      airlineFromFlightNumber: false,
      importMode: 'personal',
    });

    expect(result.skippedRows).toBe(0);
    expect(result.flights).toHaveLength(1);
    expect(result.flights[0]).toMatchObject({
      date: '2025-06-03',
      departure: '2025-06-02T15:40:00.000+00:00',
      arrival: null,
      departureScheduled: '2025-06-02T15:30:00.000+00:00',
      arrivalScheduled: '2025-06-03T01:30:00.000+00:00',
      duration: 36000,
    });
  });

  it('keeps time-only exports and overnight inference working', async () => {
    const content = `Flight Code,Departure Airport Code,Arrival Airport Code,Booking Code,Seat Number,Seat Type,Seat Class,Purpose,Notes,Ownership,byAir Flight ID,byAir Codeshare ID,Flight Date,Departure Time,Arrival Time
NH123,LAX,LAX,,4A,window,business,business,,mine,,,2025-06-07,23:00,01:00`;

    const result = await processByAirFile(content, {
      filterOwner: false,
      airlineFromFlightNumber: false,
      importMode: 'personal',
    });

    expect(result.skippedRows).toBe(0);
    expect(result.flights).toHaveLength(1);
    expect(result.flights[0]).toMatchObject({
      date: '2025-06-07',
      departure: '2025-06-08T06:00:00.000+00:00',
      arrival: '2025-06-08T08:00:00.000+00:00',
      departureScheduled: null,
      arrivalScheduled: null,
      duration: 7200,
    });
  });
});
