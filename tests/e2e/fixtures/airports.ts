import type { AirportInput } from '@test/factories/airports';

export const JFK: AirportInput = {
  icao: 'KJFK',
  iata: 'JFK',
  name: 'John F Kennedy International Airport',
  municipality: 'New York',
  lat: 40.6413,
  lon: -73.7781,
  country: 'US',
  continent: 'NA',
  tz: 'America/New_York',
  type: 'large_airport',
};

export const LHR: AirportInput = {
  icao: 'EGLL',
  iata: 'LHR',
  name: 'London Heathrow Airport',
  municipality: 'London',
  lat: 51.47,
  lon: -0.4543,
  country: 'GB',
  continent: 'EU',
  tz: 'Europe/London',
  type: 'large_airport',
};
