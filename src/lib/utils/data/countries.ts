import { COUNTRIES } from '$lib/data/countries';

export type Country = (typeof COUNTRIES)[number];

export const countryFromAlpha2 = (alpha: string): Country | undefined => {
  return COUNTRIES.find((country) => country.alpha2 === alpha);
};

export const countryFromAlpha3 = (alpha: string): Country | undefined => {
  return COUNTRIES.find((country) => country.alpha3 === alpha);
};

export const countryFromNumeric = (numeric: number): Country | undefined => {
  return COUNTRIES.find((country) => country.numeric === numeric);
};
