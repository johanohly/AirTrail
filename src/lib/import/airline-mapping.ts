// Keys also label the mapping picker. Include the source name and both codes
// so a choice for a defunct airline does not affect an airline reusing its code.
export const getAirlineMappingKey = (source: {
  name: string | null;
  iata: string | null;
  icao: string | null;
}): string | null => {
  const name = source.name?.trim() || null;
  const iata = source.iata?.trim().toUpperCase() || '';
  const icao = source.icao?.trim().toUpperCase() || '';
  if (!iata && !icao) return name;

  const codes = `${iata}/${icao}`;
  return name ? `${name} (${codes})` : codes;
};
