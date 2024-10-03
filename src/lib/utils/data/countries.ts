import { COUNTRIES } from '$lib/data/countries';

export type Country = (typeof COUNTRIES)[number];

export const countryFromAlpha = (alpha: string): Country | undefined => {
  return COUNTRIES.find((country) => country.alpha === alpha);
};

export const countryFromNumeric = (numeric: number): Country | undefined => {
  return COUNTRIES.find((country) => country.numeric === numeric);
};
