import { beforeEach, describe, expect, it, vi } from 'vitest';

import { processJetLoversFile } from './jetlovers';

const { getAirportByIata, getAirlineByName, getAircraftByName } = vi.hoisted(
  () => ({
    getAirportByIata: vi.fn(async (iata: string) => ({
      id: iata,
      iata,
      tz: 'UTC',
    })),
    getAirlineByName: vi.fn(async (name: string) => ({ id: name, name })),
    getAircraftByName: vi.fn(async (name: string) => ({ id: name, name })),
  }),
);

vi.mock('$app/state', () => ({
  page: {
    data: {
      user: {
        id: 'user-1',
      },
    },
  },
}));

vi.mock('$lib/utils/data/airports/cache', () => ({
  getAirportByIata,
}));

vi.mock('$lib/utils/data/airlines', () => ({
  getAirlineByIata: vi.fn(),
  getAirlineByIcao: vi.fn(),
  getAirlineByName,
}));

vi.mock('$lib/utils/data/aircraft', () => ({
  getAircraftByName,
}));

describe('processJetLoversFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('imports the JetLovers CSV export shape', async () => {
    const content =
      'id,date,from,to,miles,airline,flightnum,aircraft,aircraft_reg,class,reason,seat_type,seat\n' +
      '3918815,2024-06-14,CDG,SNN,561,Aer Lingus,EI909,Airbus A321neo,EI-LRA,B,L,W,3K';

    const result = await processJetLoversFile(content, {
      filterOwner: false,
      airlineFromFlightNumber: true,
      importMode: 'personal',
    });

    expect(result.flights).toHaveLength(1);
    expect(result.skippedRows).toBe(0);
    expect(getAirportByIata).toHaveBeenCalledWith('CDG');
    expect(getAirportByIata).toHaveBeenCalledWith('SNN');
    expect(getAirlineByName).toHaveBeenCalledWith('Aer Lingus');
    expect(getAircraftByName).toHaveBeenCalledWith('Airbus A321neo');

    const flight = result.flights[0]!;
    expect(flight.date).toBe('2024-06-14');
    expect(flight.flightNumber).toBe('EI909');
    expect(flight.aircraftReg).toBe('EI-LRA');
    expect(flight.flightReason).toBe('leisure');
    expect(flight.passengers[0]).toMatchObject({
      userId: 'user-1',
      seat: 'window',
      seatClass: 'business',
      seatNumber: '3K',
    });
  });
});
