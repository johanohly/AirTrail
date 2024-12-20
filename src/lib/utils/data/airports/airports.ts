import { parseCsv } from '$lib/utils';
import { airportSchema } from '$lib/zod/airport';

export const fetchAirports = async () => {
  const resp = await fetch(
    'https://davidmegginson.github.io/ourairports-data/airports.csv',
  );
  const text = await resp.text();
  const [data, error] = parseCsv(text, airportSchema);
  if (error) {
    return [];
  }

  const airports = [];
  for (const airport of data) {
    airports.push({
      ...airport,
      // tz: geo-tz
    });
  }

  return data;
};
