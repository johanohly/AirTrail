export type PlatformOptions = {
  filterOwner: boolean;
  airlineFromFlightNumber: boolean;
};

export const platforms = [
  {
    name: 'FlightRadar24',
    value: 'fr24',
    options: {
      filterOwner: false,
      airlineFromFlightNumber: false,
    },
  },
  {
    name: 'App in the Air',
    value: 'aita',
    options: {
      filterOwner: true,
      airlineFromFlightNumber: true,
    },
  },
  {
    name: 'JetLog',
    value: 'jetlog',
    options: {
      filterOwner: false,
      airlineFromFlightNumber: true,
    },
  },
  {
    name: 'AirTrail',
    value: 'airtrail',
    options: {
      filterOwner: false,
      airlineFromFlightNumber: false,
    },
  },
] as const;
