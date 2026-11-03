/** Upload-only context. Never include this in FlightTrackInput or persisted data. */
export type TrackMetadata = {
  flightIdentifiers: string[];
  originCodes: string[];
  destinationCodes: string[];
};

export const extractKmlMetadata = (document: Document): TrackMetadata => {
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
  // FR24's document description links identify the route in order.
  const airportCode = (direction: string) => {
    const match = new RegExp(`/airport/([a-z0-9]{3,4})/${direction}`, 'i').exec(
      description,
    );
    return match ? [match[1]!.toUpperCase()] : [];
  };
  return {
    flightIdentifiers,
    originCodes: airportCode('departures'),
    destinationCodes: airportCode('arrivals'),
  };
};
