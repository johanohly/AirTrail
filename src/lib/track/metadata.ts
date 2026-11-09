import type { FlightFormData } from '$lib/zod/flight';

/** Upload-only context. Never include this in FlightTrackInput or persisted data. */
export type TrackMetadata = {
  flightIdentifiers: string[];
  originCodes: string[];
  destinationCodes: string[];
};

export type TrackMismatch = {
  field: 'departure' | 'arrival' | 'flightNumber';
  label: string;
  track: string;
  entered: string;
};

/*
 * Only FlightAware and FR24 exports are read. Other KML names are free text,
 * where tail numbers, aircraft types and hex ids look like flight numbers.
 */
export const extractKmlMetadata = (
  document: Document,
): TrackMetadata | null => {
  const root = document.getElementsByTagName('Document')[0];
  const children = root ? Array.from(root.childNodes) : [];
  const text = (name: string) =>
    children.find((node) => node.nodeName === name)?.textContent ?? '';
  const name = text('name');
  const description = text('description');
  const flightIdentifiers = Array.from(
    name
      .toUpperCase()
      .matchAll(/\b(?:[A-Z][A-Z0-9]|[0-9][A-Z])[A-Z]?\d+[A-Z0-9]*\b/g),
    (match) => match[0],
  );
  // FlightAware names contain (MAN / EGCC-HKG / VHHH).
  const route =
    /\(([A-Z]{3})\s*\/\s*([A-Z]{4})\s*-\s*([A-Z]{3})\s*\/\s*([A-Z]{4})\)/.exec(
      name,
    );
  if (route) {
    return {
      flightIdentifiers,
      originCodes: [route[1]!, route[2]!],
      destinationCodes: [route[3]!, route[4]!],
    };
  }
  // FR24's document description links to the departure and arrival airports.
  const airportCode = (direction: string) => {
    const match = new RegExp(`/airport/([a-z0-9]{3,4})/${direction}`, 'i').exec(
      description,
    );
    return match ? [match[1]!.toUpperCase()] : [];
  };
  const originCodes = airportCode('departures');
  const destinationCodes = airportCode('arrivals');
  if (!originCodes.length && !destinationCodes.length) return null;
  return { flightIdentifiers, originCodes, destinationCodes };
};

const normalize = (value: string) => value.toUpperCase().replace(/\s/g, '');

// IATA flight numbers and ICAO callsigns share the number (CX216, CPA216), but
// many airlines fly alphanumeric callsigns (RYR1MK) that can't be compared.
const flightNumberOf = (value: string) =>
  /^(?:[A-Z]{3}|[A-Z][A-Z0-9]|[0-9][A-Z])?(\d+)[A-Z]?$/
    .exec(normalize(value))?.[1]
    ?.replace(/^0+/, '') ?? null;

export const findTrackMismatches = (
  metadata: TrackMetadata | null,
  form: FlightFormData,
): TrackMismatch[] => {
  if (!metadata) return [];
  const mismatches: TrackMismatch[] = [];
  for (const departure of [true, false]) {
    const codes = departure ? metadata.originCodes : metadata.destinationCodes;
    const airport = departure ? form.from : form.to;
    const entered = airport?.iata || airport?.icao;
    if (
      entered &&
      codes.length &&
      !codes.some((code) =>
        [airport.iata, airport.icao].some(
          (value) => value && normalize(value) === normalize(code),
        ),
      )
    ) {
      mismatches.push({
        field: departure ? 'departure' : 'arrival',
        label: departure ? 'Departure airport' : 'Arrival airport',
        track: codes.join(' / '),
        entered,
      });
    }
  }
  const entered = form.flightNumber && flightNumberOf(form.flightNumber);
  const numbers = metadata.flightIdentifiers
    .map(flightNumberOf)
    .filter((value) => value !== null);
  if (entered && numbers.length && !numbers.includes(entered)) {
    mismatches.push({
      field: 'flightNumber',
      label: 'Flight number',
      track: metadata.flightIdentifiers.join(' / '),
      entered: form.flightNumber!,
    });
  }
  return mismatches;
};
