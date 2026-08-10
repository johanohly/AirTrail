// @ts-nocheck -- GeoJSON from external sources is validated at runtime below.

export const COUNTRY_CODE_PROPERTY = 'COUNTRY_CODE';

export const COUNTRY_GEOMETRY_OVERRIDES = [
  { code: 'RS', source: 'nuts', sourceCode: 'RS', sourceProperty: 'NUTS_ID' },
  { code: 'XK', source: 'nuts', sourceCode: 'XK', sourceProperty: 'NUTS_ID' },
  {
    code: 'CN',
    source: 'naturalEarth',
    sourceCode: 'CHN',
    sourceProperty: 'ADM0_A3',
  },
  {
    code: 'TW',
    source: 'naturalEarth',
    sourceCode: 'TWN',
    sourceProperty: 'ADM0_A3',
  },
];

export const COUNTRY_POINT_ASSERTIONS = [
  {
    name: 'Taipei',
    coordinates: [121.5654, 25.033],
    expectedCode: 'TW',
    excludedCodes: ['CN'],
  },
  {
    name: 'Gaza City',
    coordinates: [34.4668, 31.5017],
    expectedCode: 'PS',
    excludedCodes: [],
  },
  {
    name: 'Pristina',
    coordinates: [21.1655, 42.6629],
    expectedCode: 'XK',
    excludedCodes: ['RS'],
  },
  {
    name: 'Belgrade',
    coordinates: [20.4489, 44.7866],
    expectedCode: 'RS',
    excludedCodes: ['XK'],
  },
];

// GISCO uses EU vocabulary identifiers for these countries. AirTrail persists
// ISO 3166-1 alpha-2 codes, except for the EU user-assigned XK code.
const GISCO_TO_COUNTRY_CODE = {
  EL: 'GR',
  UK: 'GB',
};

const countryCodeFromGisco = (code) => GISCO_TO_COUNTRY_CODE[code] ?? code;

const withCountryCode = (feature, code) => ({
  ...feature,
  properties: {
    ...feature.properties,
    [COUNTRY_CODE_PROPERTY]: code,
  },
});

const ringContainsPoint = ([longitude, latitude], ring) => {
  let inside = false;
  for (
    let current = 0, previous = ring.length - 1;
    current < ring.length;
    previous = current++
  ) {
    const [currentLongitude, currentLatitude] = ring[current];
    const [previousLongitude, previousLatitude] = ring[previous];
    const crossesLatitude =
      currentLatitude > latitude !== previousLatitude > latitude;
    const crossingLongitude =
      ((previousLongitude - currentLongitude) * (latitude - currentLatitude)) /
        (previousLatitude - currentLatitude) +
      currentLongitude;
    if (crossesLatitude && longitude < crossingLongitude) inside = !inside;
  }
  return inside;
};

const polygonContainsPoint = (coordinates, location) =>
  ringContainsPoint(location, coordinates[0]) &&
  !coordinates.slice(1).some((ring) => ringContainsPoint(location, ring));

const geometryContainsPoint = (geometry, location) => {
  if (geometry?.type === 'Polygon') {
    return polygonContainsPoint(geometry.coordinates, location);
  }
  if (geometry?.type === 'MultiPolygon') {
    return geometry.coordinates.some((polygon) =>
      polygonContainsPoint(polygon, location),
    );
  }
  return false;
};

export const mergeCountryFeatures = (worldCountries, overrideSources) => {
  const overriddenCodes = new Set(
    COUNTRY_GEOMETRY_OVERRIDES.map((override) => override.code),
  );
  const features = (worldCountries.features ?? [])
    .filter((feature) => {
      const code = feature?.properties?.CNTR_ID;
      return code && !overriddenCodes.has(countryCodeFromGisco(code));
    })
    .map((feature) => {
      const code = feature?.properties?.CNTR_ID;
      if (!code) {
        throw new Error('World country feature is missing CNTR_ID');
      }
      return withCountryCode(feature, countryCodeFromGisco(code));
    });

  for (const override of COUNTRY_GEOMETRY_OVERRIDES) {
    const source = overrideSources[override.source];
    const feature = (source?.features ?? []).find(
      (item) =>
        item?.properties?.[override.sourceProperty] === override.sourceCode,
    );
    if (!feature) {
      throw new Error(
        `${override.source} country data is missing ${override.sourceCode} for ${override.code}`,
      );
    }
    features.push(withCountryCode(feature, override.code));
  }

  const countryCodes = features.map(
    (feature) => feature.properties[COUNTRY_CODE_PROPERTY],
  );
  if (new Set(countryCodes).size !== countryCodes.length) {
    throw new Error('Merged country data contains duplicate country codes');
  }

  return {
    ...worldCountries,
    features,
  };
};

export const validateCountryPointAssignments = (countryCollection) => {
  for (const assertion of COUNTRY_POINT_ASSERTIONS) {
    const matchingCodes = (countryCollection.features ?? [])
      .filter((feature) =>
        geometryContainsPoint(feature?.geometry, assertion.coordinates),
      )
      .map((feature) => feature.properties?.[COUNTRY_CODE_PROPERTY]);

    if (!matchingCodes.includes(assertion.expectedCode)) {
      throw new Error(
        `${assertion.name} must resolve to ${assertion.expectedCode}; found ${matchingCodes.join(', ') || 'nothing'}`,
      );
    }

    const excludedCode = assertion.excludedCodes.find((code) =>
      matchingCodes.includes(code),
    );
    if (excludedCode) {
      throw new Error(
        `${assertion.name} must not overlap ${excludedCode}; found ${matchingCodes.join(', ')}`,
      );
    }
  }
};
