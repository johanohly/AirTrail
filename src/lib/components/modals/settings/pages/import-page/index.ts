import type { Airline, Airport } from '$lib/db/types';

export type PlatformOptions = {
  filterOwner: boolean;
  airlineFromFlightNumber: boolean;
  airportMapping?: Record<string, Airport>;
  airlineMapping?: Record<string, Airline>;
};

export const platforms = [
  {
    name: 'FlightRadar24',
    value: 'fr24',
    description: 'CSV export from MyFlightRadar24 settings.',
    extensions: ['.csv'],
    options: {
      filterOwner: false,
      airlineFromFlightNumber: false,
    },
  },
  {
    name: 'App in the Air',
    value: 'aita',
    description: 'Text export from App in the Air (via email).',
    extensions: ['.txt'],
    options: {
      filterOwner: true,
      airlineFromFlightNumber: true,
    },
  },
  {
    name: 'JetLog',
    value: 'jetlog',
    description: 'CSV export from JetLog settings.',
    extensions: ['.csv'],
    options: {
      filterOwner: false,
      airlineFromFlightNumber: true,
    },
  },
  {
    name: 'TripIt (ICS)',
    value: 'tripit',
    description: 'Trip export from TripIt as an ICS file.',
    extensions: ['.ics'],
    options: {
      filterOwner: false,
      airlineFromFlightNumber: true,
    },
  },
  {
    name: 'Flighty',
    value: 'flighty',
    description: 'CSV export from Flighty flight tracker app.',
    extensions: ['.csv'],
    options: {
      filterOwner: false,
      airlineFromFlightNumber: false,
    },
  },
  {
    name: 'AirTrail',
    value: 'airtrail',
    description: 'JSON export from AirTrail (re-import your data).',
    extensions: ['.json'],
    options: {
      filterOwner: false,
      airlineFromFlightNumber: false,
    },
  },
  {
    name: 'AirTrail (pre-v3)',
    value: 'legacy-airtrail',
    description:
      'JSON export from AirTrail (exported from a pre-v3 version of AirTrail).',
    extensions: ['.json'],
    options: {
      filterOwner: false,
      airlineFromFlightNumber: false,
    },
  },
] as const;
