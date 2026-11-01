import type { Airline, Airport } from '$lib/db/types';
import { COUNTRIES } from '$lib/data/countries';
import {
  codeForAirport,
  routeLabelForFlight,
  type FlightChartKey,
} from '$lib/stats/aggregations';
import type { FlightData } from '$lib/utils';

export type BreakdownDetails = {
  airline?: Airline;
  airport?: Airport;
  route?: { first: Airport | null; second: Airport | null };
  /** ISO 3166 alpha-2 code, for the country behind a row. */
  countryCode?: string;
  /** What the row's code means, such as the aircraft behind a registration. */
  description?: string;
  /** Where a drill-down row says more than the list row has room for. */
  subtitle?: string;
};

export const CHART_NOUNS: Record<FlightChartKey, [string, string]> = {
  'seat-class': ['seat class', 'seat classes'],
  seat: ['seat position', 'seat positions'],
  reason: ['reason', 'reasons'],
  continents: ['continent', 'continents'],
  airlines: ['airline', 'airlines'],
  'aircraft-models': ['aircraft type', 'aircraft types'],
  'aircraft-regs': ['aircraft', 'aircraft'],
  airports: ['airport', 'airports'],
  countries: ['country', 'countries'],
  routes: ['route', 'routes'],
};

const cityOf = (airport: Airport | null | undefined) =>
  airport?.municipality || airport?.name || 'Unknown';

const countryNameOf = (code: string) =>
  COUNTRIES.find((country) => country.alpha2 === code.toUpperCase())?.name;

/* Everything a breakdown row can say about its key, looked up once per render. */
export const createDetailsLookup = (
  chartKey: FlightChartKey,
  flights: FlightData[],
) => {
  const details = new Map<string, BreakdownDetails>();
  const add = (
    key: string | null | undefined,
    make: () => BreakdownDetails,
  ) => {
    if (key && !details.has(key)) details.set(key, make());
  };

  for (const flight of flights) {
    switch (chartKey) {
      case 'airlines':
        add(flight.airline?.name, () => ({
          airline: flight.airline ?? undefined,
          subtitle: [flight.airline?.iata, flight.airline?.icao]
            .filter(Boolean)
            .join(' / '),
        }));
        break;
      case 'aircraft-models':
        add(flight.aircraft?.name, () => ({
          subtitle: flight.aircraft?.icao ?? undefined,
        }));
        break;
      case 'aircraft-regs':
        add(flight.aircraftReg, () => ({
          description: flight.aircraft?.name,
        }));
        break;
      case 'airports':
        for (const airport of [flight.from, flight.to]) {
          add(codeForAirport(airport), () => ({
            airport: airport ?? undefined,
            description: cityOf(airport),
            subtitle: airport?.name,
          }));
        }
        break;
      case 'countries':
        for (const country of [flight.from?.country, flight.to?.country]) {
          add(country?.toUpperCase(), () => ({
            countryCode: country!.toUpperCase(),
            description: countryNameOf(country!),
          }));
        }
        break;
      case 'routes': {
        add(routeLabelForFlight(flight), () => {
          const inOrder =
            (codeForAirport(flight.from) ?? '') <=
            (codeForAirport(flight.to) ?? '');
          const first = inOrder ? flight.from : flight.to;
          const second = inOrder ? flight.to : flight.from;
          return {
            route: { first, second },
            subtitle: `${cityOf(first)} and ${cityOf(second)}`,
          };
        });
        break;
      }
    }
  }

  return (key: string) => details.get(key) ?? {};
};
