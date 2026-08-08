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
    name: 'byAir',
    value: 'byair',
    description: 'CSV export from byAir flight tracker.',
    extensions: ['.csv'],
    options: {
      filterOwner: true,
      airlineFromFlightNumber: true,
    },
  },
  {
    name: 'JetLovers',
    value: 'jetlovers',
    description: 'CSV export from JetLovers flight tracker.',
    extensions: ['.csv'],
    options: {
      filterOwner: false,
      airlineFromFlightNumber: true,
    },
  },
  {
    name: 'OpenFlights',
    value: 'openflights',
    description: 'CSV backup from OpenFlights.',
    extensions: ['.csv'],
    options: {
      filterOwner: false,
      airlineFromFlightNumber: true,
    },
  },
  {
    name: 'Miles & More',
    value: 'milesandmore',
    description: 'JSON export from Miles & More flight history.',
    extensions: ['.json'],
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

export type Platform = (typeof platforms)[number];
export type PlatformValue = Platform['value'];
