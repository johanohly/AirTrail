import { COUNTRIES } from '$lib/data/countries';

type Country = (typeof COUNTRIES)[number];

export const countryFromAlpha = (alpha: string): Country | undefined => {
  return COUNTRIES.find((country) => country.alpha === alpha);
};
