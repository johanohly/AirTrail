import { COUNTRIES } from '$lib/data/countries';

export type Country = (typeof COUNTRIES)[number];

type FlightCountryEndpoints = {
  from: { country: string } | null;
  to: { country: string } | null;
};

export const countryFromAlpha2 = (alpha: string): Country | undefined => {
  return COUNTRIES.find((country) => country.alpha2 === alpha);
};

export const countryCodesFromFlights = (
  flights: readonly FlightCountryEndpoints[],
): Set<string> => {
  const countryCodes = new Set<string>();

  for (const flight of flights) {
    for (const airport of [flight.from, flight.to]) {
      if (airport && countryFromAlpha2(airport.country)) {
        countryCodes.add(airport.country);
      }
    }
  }

  return countryCodes;
};
