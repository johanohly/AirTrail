export type PlatformOptions = {
  filterOwner: boolean;
  airlineFromFlightNumber: boolean;
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
] as const;
