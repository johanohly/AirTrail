#!/usr/bin/env node

import {
  area,
  bearing,
  centroid,
  destination,
  distance,
  point,
  pointOnFeature,
} from '@turf/turf';
import { spawn } from 'node:child_process';
import {
  appendFileSync,
  createReadStream,
  mkdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

const DEFAULT_OUTPUT_PMTILES = join(
  process.cwd(),
  'static/airport-overlay.pmtiles',
);
const DEFAULT_TEMP_DIR = join(
  tmpdir(),
  `airtrail-airport-overlay-${process.pid}`,
);
const FILTER_EXPRESSIONS = [
  'aeroway=runway,taxiway,apron,terminal,gate,parking_position,jet_bridge,aerodrome,marking,windsock,tower',
  'navigationaid',
];
const LAYER_IDS = ['airport', 'airport_labels', 'airport_nodes', 'aerodrome'];
const FLUSH_EVERY_FEATURES = 500;
const PROGRESS_LOG_INTERVAL_MS = 10_000;

const printHelp = () => {
  console.log(`Generate an AirTrail airport overlay PMTiles file from one or more .osm.pbf extracts.

Usage:
  bun scripts/data/generate-airport-overlay.js --input=PATH [--input=PATH ...]

Options:
  --input=PATH              Input .osm.pbf file. Repeat for multiple extracts.
  --output=PATH             PMTiles output path (default: static/airport-overlay.pmtiles)
  --temp-dir=PATH           Temporary working directory
  --help                    Show this help

Example:
  bun scripts/data/generate-airport-overlay.js \
    --input=.cache/geofabrik/denmark-latest.osm.pbf \
    --input=.cache/geofabrik/norway-latest.osm.pbf \
    --input=.cache/geofabrik/sweden-latest.osm.pbf \
    --input=.cache/geofabrik/finland-latest.osm.pbf \
    --input=.cache/geofabrik/iceland-latest.osm.pbf
`);
};

const parseArgs = (argv) => {
  const options = {
    inputs: [],
    output: DEFAULT_OUTPUT_PMTILES,
    tempDir: DEFAULT_TEMP_DIR,
  };

  for (const arg of argv) {
    if (arg === '--help') {
      options.help = true;
      continue;
    }

    const separatorIndex = arg.indexOf('=');
    if (separatorIndex === -1) {
      throw new Error(`Expected --flag=value format, received '${arg}'`);
    }

    const flag = arg.slice(0, separatorIndex);
    const rawValue = arg.slice(separatorIndex + 1);
    if (!rawValue) {
      throw new Error(`Expected --flag=value format, received '${arg}'`);
    }

    switch (flag) {
      case '--input':
        options.inputs.push(resolve(process.cwd(), rawValue));
        break;
      case '--output':
        options.output = resolve(process.cwd(), rawValue);
        break;
      case '--temp-dir':
        options.tempDir = resolve(process.cwd(), rawValue);
        break;
      default:
        throw new Error(`Unknown option '${flag}'`);
    }
  }

  if (!options.help && options.inputs.length === 0) {
    throw new Error('At least one --input=.osm.pbf file is required.');
  }

  return options;
};

const formatBytes = (value) => {
  if (!Number.isFinite(value) || value < 1024) {
    return `${value} B`;
  }

  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unitIndex = -1;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
};

const runCommand = (command, args, options = {}) => {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      stdio: options.stdio ?? 'inherit',
      cwd: options.cwd,
      env: options.env,
    });

    child.on('error', rejectPromise);
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(
        new Error(
          `${command} ${args.join(' ')} failed with ${signal ? `signal ${signal}` : `exit code ${code}`}`,
        ),
      );
    });
  });
};

const ensureCommand = async (command, installHint) => {
  try {
    await runCommand(command, ['--version'], { stdio: 'ignore' });
  } catch {
    console.error(`${command} is required. ${installHint}`);
    process.exit(1);
  }
};

const geometryType = (rawFeature) => rawFeature.geometry?.type;

const osmId = (rawFeature) => {
  const type = rawFeature.properties?.['@type'];
  const id = rawFeature.properties?.['@id'];
  if (!type || id === undefined) {
    return undefined;
  }

  return `${type}/${id}`;
};

const parseMeters = (value) => {
  if (!value) return undefined;

  const trimmed = String(value).trim().toLowerCase();
  const number = parseFloat(trimmed);
  if (!Number.isFinite(number)) {
    return undefined;
  }

  if (trimmed.endsWith('ft') || trimmed.endsWith('feet')) {
    return Math.round(number * 0.3048 * 100) / 100;
  }

  return number;
};

const toAirportLabelName = (name) => {
  if (!name) return undefined;

  return String(name)
    .replace(/\s+international airport$/i, '')
    .replace(/\s+airport$/i, '')
    .trim();
};

const labelName = (rawFeature) =>
  rawFeature.properties?.ref ??
  rawFeature.properties?.gate ??
  rawFeature.properties?.name;

// turf's lineOffset uses planar/Mercator math and produces results that are
// off by cos(lat) for non-N-S lines; at lat 55, a 22.5m offset comes out as
// ~20m. Use Haversine destination() per vertex instead, which is geodesically
// exact. Vertex perpendicular is the bisector of incoming/outgoing bearings;
// for the runways we buffer (mostly straight), this matches the segment
// perpendicular within rounding.
const offsetVertex = (coords, i, side, halfWidthM) => {
  const cur = point(coords[i]);
  let segBearing;
  if (i === 0) {
    segBearing = bearing(cur, point(coords[1]));
  } else if (i === coords.length - 1) {
    segBearing = bearing(point(coords[i - 1]), cur);
  } else {
    const incoming = bearing(point(coords[i - 1]), cur);
    const outgoing = bearing(cur, point(coords[i + 1]));
    let delta = outgoing - incoming;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    segBearing = incoming + delta / 2;
  }
  const perp = side > 0 ? segBearing + 90 : segBearing - 90;
  return destination(cur, halfWidthM, perp, { units: 'meters' }).geometry
    .coordinates;
};

const bufferLineString = (coordinates, halfWidthM) => {
  if (!coordinates || coordinates.length < 2) return null;
  try {
    const left = coordinates.map((_, i) =>
      offsetVertex(coordinates, i, -1, halfWidthM),
    );
    const right = coordinates.map((_, i) =>
      offsetVertex(coordinates, i, 1, halfWidthM),
    );
    return [...left, ...right.slice().reverse(), left[0]];
  } catch {
    return null;
  }
};

const computeBbox = (geometry) => {
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;
  const walk = (c) => {
    if (typeof c[0] === 'number') {
      if (c[0] < minLng) minLng = c[0];
      if (c[0] > maxLng) maxLng = c[0];
      if (c[1] < minLat) minLat = c[1];
      if (c[1] > maxLat) maxLat = c[1];
    } else {
      for (const x of c) walk(x);
    }
  };
  walk(geometry.coordinates);
  return [minLng, minLat, maxLng, maxLat];
};

const bboxesIntersect = (a, b) =>
  !(a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1]);

const generateRunwayEndpointFeatures = (rawFeature, widthM) => {
  const features = [];
  if (!widthM || widthM <= 0) return features;
  const geom = rawFeature.geometry;
  if (!geom || geom.type !== 'LineString') return features;
  const coords = geom.coordinates;
  if (coords.length < 2) return features;

  const startPt = point(coords[0]);
  const endPt = point(coords[coords.length - 1]);
  const startBearing = bearing(startPt, point(coords[1]));
  const endBearing = bearing(point(coords[coords.length - 2]), endPt);
  const half = widthM / 2;
  const id = osmId(rawFeature);

  for (const [pt, bear] of [
    [startPt, startBearing],
    [endPt, endBearing],
  ]) {
    const left = destination(pt, half, bear - 90, { units: 'meters' }).geometry
      .coordinates;
    const right = destination(pt, half, bear + 90, { units: 'meters' }).geometry
      .coordinates;
    features.push(
      feature(
        { type: 'LineString', coordinates: [left, right] },
        { aeroway: 'runway_threshold', osm_id: id },
        { minzoom: 13, maxzoom: 14 },
      ),
    );
  }

  const ref = rawFeature.properties?.ref;
  if (!ref || !ref.includes('/')) return features;
  const parts = ref.split('/').map((s) => s.trim());
  if (parts.length !== 2) return features;

  const headingOf = (d) => {
    const m = d.match(/(\d+)/);
    return m ? parseInt(m[1], 10) * 10 : null;
  };
  const h0 = headingOf(parts[0]);
  const h1 = headingOf(parts[1]);
  if (h0 == null || h1 == null) return features;

  const angleDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
  const startDes =
    angleDiff(startBearing, h0) < angleDiff(startBearing, h1)
      ? parts[0]
      : parts[1];
  const endDes = startDes === parts[0] ? parts[1] : parts[0];

  // Place designator ~60m inside the runway from each endpoint.
  const startDesPt = destination(startPt, 60, startBearing, {
    units: 'meters',
  }).geometry;
  const endDesPt = destination(endPt, 60, endBearing - 180, {
    units: 'meters',
  }).geometry;

  features.push(
    feature(
      startDesPt,
      {
        aeroway: 'runway_designator',
        ref: startDes,
        bearing: startBearing,
        osm_id: id,
      },
      { minzoom: 13, maxzoom: 14 },
    ),
    feature(
      endDesPt,
      {
        aeroway: 'runway_designator',
        ref: endDes,
        bearing: endBearing,
        osm_id: id,
      },
      { minzoom: 13, maxzoom: 14 },
    ),
  );

  return features;
};

const bufferedLinePolygon = (rawFeature, widthM) => {
  if (!widthM || widthM <= 0) return null;
  const half = widthM / 2;
  const geom = rawFeature.geometry;
  if (!geom) return null;

  if (geom.type === 'LineString') {
    const ring = bufferLineString(geom.coordinates, half);
    if (!ring) return null;
    return { type: 'Polygon', coordinates: [ring] };
  }

  if (geom.type === 'MultiLineString') {
    const polygons = [];
    for (const coords of geom.coordinates) {
      const ring = bufferLineString(coords, half);
      if (ring) polygons.push([ring]);
    }
    if (!polygons.length) return null;
    return { type: 'MultiPolygon', coordinates: polygons };
  }

  return null;
};

const pointGeometry = (rawFeature) => {
  if (!rawFeature.geometry) {
    return null;
  }

  if (rawFeature.geometry.type === 'Point') {
    return rawFeature.geometry;
  }

  try {
    return pointOnFeature(rawFeature).geometry;
  } catch {
    return null;
  }
};

const feature = (geometry, properties, tippecanoe) => ({
  type: 'Feature',
  geometry,
  properties,
  ...(tippecanoe ? { tippecanoe } : {}),
});

const airportFeatureProperties = (rawFeature, kind) => ({
  kind,
  aeroway: kind,
  ref: rawFeature.properties?.ref,
  name: rawFeature.properties?.name,
  'name:en': rawFeature.properties?.['name:en'],
  iata: rawFeature.properties?.iata,
  icao: rawFeature.properties?.icao,
  surface: rawFeature.properties?.surface,
  width_m: parseMeters(rawFeature.properties?.width),
  length_m: parseMeters(rawFeature.properties?.length),
  terminal: rawFeature.properties?.terminal,
  gate: rawFeature.properties?.gate,
  marking: rawFeature.properties?.marking,
  osm_id: osmId(rawFeature),
});

const airportLabelProperties = (rawFeature, type) => ({
  type,
  name: labelName(rawFeature),
  'name:en': rawFeature.properties?.['name:en'],
  ref: rawFeature.properties?.ref,
  iata: rawFeature.properties?.iata,
  icao: rawFeature.properties?.icao,
  terminal: rawFeature.properties?.terminal,
  gate: rawFeature.properties?.gate,
  rank: undefined,
  osm_id: osmId(rawFeature),
});

const airportNodeRank = (rawFeature) => {
  const properties = rawFeature.properties ?? {};

  let rank = 1000;
  if (properties.iata) rank -= 300;
  if (properties.icao) rank -= 200;
  if (properties.name) rank -= 75;

  if (['Polygon', 'MultiPolygon'].includes(geometryType(rawFeature))) {
    rank -= Math.min(Math.round(area(rawFeature) / 100_000), 200);
  }

  return Math.max(0, rank);
};

const airportNodeFeature = (rawFeature) => {
  if (!['Polygon', 'MultiPolygon'].includes(geometryType(rawFeature))) {
    return null;
  }

  const geometry = pointGeometry(rawFeature);
  if (!geometry) {
    return null;
  }

  const name =
    rawFeature.properties?.name ??
    rawFeature.properties?.['name:en'] ??
    rawFeature.properties?.icao ??
    rawFeature.properties?.iata;
  if (!name) {
    return null;
  }

  return feature(
    geometry,
    {
      class: 'aerodrome',
      name,
      label_name: toAirportLabelName(
        rawFeature.properties?.['name:en'] ??
          rawFeature.properties?.name ??
          name,
      ),
      'name:en': rawFeature.properties?.['name:en'],
      iata: rawFeature.properties?.iata,
      icao: rawFeature.properties?.icao,
      rank: airportNodeRank(rawFeature),
      osm_id: osmId(rawFeature),
    },
    { minzoom: 0, maxzoom: 14 },
  );
};

const airportNodeDedupKey = (rawFeature) => {
  const properties = rawFeature.properties ?? {};

  return (
    properties.iata ??
    properties.icao ??
    properties['name:en'] ??
    properties.name ??
    null
  );
};

const normalizeRawFeature = (
  rawFeature,
  seenAirportNodes,
  markingBboxes,
  seenTowers,
) => {
  const layers = {
    airport: [],
    airport_labels: [],
    airport_nodes: [],
    aerodrome: [],
  };

  const navigationaid = rawFeature.properties?.navigationaid;
  if (navigationaid && rawFeature.geometry?.type === 'Point') {
    const lightDirection = parseFloat(
      rawFeature.properties?.['light:direction'] ?? '',
    );
    layers.airport.push(
      feature(
        rawFeature.geometry,
        {
          aeroway: 'navigationaid',
          navigationaid,
          light_colour:
            rawFeature.properties?.['light:colour'] ??
            rawFeature.properties?.['light:color'],
          light_shape: rawFeature.properties?.['light:shape'],
          light_direction: Number.isFinite(lightDirection)
            ? lightDirection
            : undefined,
          osm_id: osmId(rawFeature),
        },
        { minzoom: 14, maxzoom: 14 },
      ),
    );
  }

  const aeroway = rawFeature.properties?.aeroway;
  if (!aeroway) {
    return layers;
  }

  if (aeroway === 'windsock' && rawFeature.geometry?.type === 'Point') {
    layers.airport.push(
      feature(
        rawFeature.geometry,
        {
          aeroway: 'windsock',
          osm_id: osmId(rawFeature),
        },
        { minzoom: 13, maxzoom: 14 },
      ),
    );
    return layers;
  }

  if (aeroway === 'tower') {
    // For tower outlines / building footprints, use the centroid so the icon
    // sits at the middle of the structure rather than on its boundary
    // (pointOnFeature would land somewhere along the perimeter).
    let geom = null;
    if (rawFeature.geometry?.type === 'Point') {
      geom = rawFeature.geometry;
    } else if (rawFeature.geometry) {
      try {
        geom = centroid(rawFeature).geometry;
      } catch {
        geom = pointGeometry(rawFeature);
      }
    }
    if (geom) {
      // OSM commonly tags the same physical tower as both a closed/open way
      // and a multipolygon relation, plus sometimes a separate node, so the
      // raw feed has 2-4 features per tower. Dedupe by haversine proximity
      // within 20m, which preserves distinct towers (e.g. CPH's two ATC towers
      // sit ~26m apart).
      const [lon, lat] = geom.coordinates;
      const isDuplicate = seenTowers?.some(([oLon, oLat]) => {
        return (
          distance(point([oLon, oLat]), point([lon, lat]), {
            units: 'meters',
          }) < 20
        );
      });
      if (!isDuplicate) {
        seenTowers?.push([lon, lat]);
        layers.airport.push(
          feature(
            geom,
            {
              aeroway: 'tower',
              name: rawFeature.properties?.name,
              osm_id: osmId(rawFeature),
            },
            { minzoom: 12, maxzoom: 14 },
          ),
        );
      }
    }
    return layers;
  }

  const rawGeometryType = geometryType(rawFeature);

  if (
    aeroway === 'parking_position' &&
    ['LineString', 'MultiLineString'].includes(rawGeometryType)
  ) {
    layers.airport.push(
      feature(rawFeature.geometry, {
        aeroway: 'parking_position',
        ref: rawFeature.properties?.ref,
        name: rawFeature.properties?.name,
        osm_id: osmId(rawFeature),
      }),
    );
  }

  if (
    (aeroway === 'runway' ||
      aeroway === 'taxiway' ||
      aeroway === 'jet_bridge') &&
    ['LineString', 'MultiLineString'].includes(rawGeometryType)
  ) {
    const isRunway = aeroway === 'runway';
    const runwayBbox = isRunway ? computeBbox(rawFeature.geometry) : null;
    const hasOsmMarkings =
      isRunway && markingBboxes?.some((mb) => bboxesIntersect(runwayBbox, mb));

    const props = airportFeatureProperties(
      rawFeature,
      aeroway === 'jet_bridge' ? 'jet_bridge' : aeroway,
    );
    if (hasOsmMarkings) props.has_osm_markings = true;

    layers.airport.push(feature(rawFeature.geometry, props));

    if (aeroway === 'runway' || aeroway === 'taxiway') {
      const widthM = parseMeters(rawFeature.properties?.width);
      const polygon = bufferedLinePolygon(rawFeature, widthM);
      if (polygon) {
        const polyProps = airportFeatureProperties(rawFeature, aeroway);
        if (hasOsmMarkings) polyProps.has_osm_markings = true;
        layers.airport.push(feature(polygon, polyProps));
      }

      if (isRunway && !hasOsmMarkings) {
        layers.airport.push(
          ...generateRunwayEndpointFeatures(rawFeature, widthM),
        );
      }
    }
  }

  if (
    (aeroway === 'apron' || aeroway === 'terminal') &&
    ['Polygon', 'MultiPolygon'].includes(rawGeometryType)
  ) {
    layers.airport.push(
      feature(
        rawFeature.geometry,
        airportFeatureProperties(rawFeature, aeroway),
      ),
    );
  }

  if (aeroway === 'runway' && rawFeature.properties?.ref) {
    layers.airport_labels.push(
      feature(
        rawFeature.geometry,
        airportLabelProperties(rawFeature, 'runway'),
      ),
    );
  }

  if (aeroway === 'taxiway' && labelName(rawFeature)) {
    layers.airport_labels.push(
      feature(
        rawFeature.geometry,
        airportLabelProperties(rawFeature, 'taxiway'),
      ),
    );
  }

  if (
    aeroway === 'terminal' &&
    ['Polygon', 'MultiPolygon'].includes(rawGeometryType) &&
    labelName(rawFeature)
  ) {
    const geometry = pointGeometry(rawFeature);
    if (geometry) {
      layers.airport_labels.push(
        feature(geometry, airportLabelProperties(rawFeature, 'terminal')),
      );
    }
  }

  if (aeroway === 'gate' && labelName(rawFeature)) {
    const geometry = pointGeometry(rawFeature);
    if (geometry) {
      layers.airport_labels.push(
        feature(geometry, airportLabelProperties(rawFeature, 'gate')),
      );
    }
  }

  if (aeroway === 'marking') {
    if (['Polygon', 'MultiPolygon'].includes(rawGeometryType)) {
      layers.airport.push(
        feature(
          rawFeature.geometry,
          airportFeatureProperties(rawFeature, 'marking'),
          { minzoom: 14, maxzoom: 14 },
        ),
      );
    } else if (['LineString', 'MultiLineString'].includes(rawGeometryType)) {
      layers.airport.push(
        feature(
          rawFeature.geometry,
          airportFeatureProperties(rawFeature, 'marking'),
          { minzoom: 14, maxzoom: 14 },
        ),
      );
    }
  }

  if (aeroway === 'aerodrome') {
    if (['Polygon', 'MultiPolygon'].includes(rawGeometryType)) {
      layers.aerodrome.push(
        feature(rawFeature.geometry, {
          class: 'aerodrome',
          name: rawFeature.properties?.name,
          label_name: toAirportLabelName(
            rawFeature.properties?.['name:en'] ?? rawFeature.properties?.name,
          ),
          'name:en': rawFeature.properties?.['name:en'],
          iata: rawFeature.properties?.iata,
          icao: rawFeature.properties?.icao,
          area_rank: airportNodeRank(rawFeature),
          osm_id: osmId(rawFeature),
        }),
      );
    }

    const airportNode = airportNodeFeature(rawFeature);
    const dedupKey = airportNodeDedupKey(rawFeature);
    if (airportNode && (!dedupKey || !seenAirportNodes.has(dedupKey))) {
      layers.airport_nodes.push(airportNode);
      if (dedupKey) {
        seenAirportNodes.add(dedupKey);
      }
    }
  }

  return layers;
};

const layerNdjsonPaths = (tempDir) =>
  Object.fromEntries(
    LAYER_IDS.map((layerId) => [layerId, join(tempDir, `${layerId}.ndjson`)]),
  );

const resetLayerFiles = (layerFiles) => {
  for (const filePath of Object.values(layerFiles)) {
    writeFileSync(filePath, '');
  }
};

const appendLayerNdjson = (filePath, features) => {
  if (!features.length) {
    return;
  }

  appendFileSync(
    filePath,
    `${features.map((value) => JSON.stringify(value)).join('\n')}\n`,
  );
};

const flushLayerBatches = (layerFiles, layerBatches, totals) => {
  for (const layerId of LAYER_IDS) {
    const features = layerBatches[layerId];
    if (!features.length) {
      continue;
    }

    appendLayerNdjson(layerFiles[layerId], features);
    totals[layerId] += features.length;
    layerBatches[layerId] = [];
  }
};

const createLayerBatches = () =>
  Object.fromEntries(LAYER_IDS.map((layerId) => [layerId, []]));

const maybeLogNormalizationProgress = (state) => {
  const now = Date.now();
  if (now - state.lastLoggedAt < PROGRESS_LOG_INTERVAL_MS) {
    return;
  }

  const totalSuffix = state.totalBytes
    ? ` / ${formatBytes(state.totalBytes)}`
    : '';
  console.log(
    `Normalizing ${state.baseName}: ${formatBytes(state.bytesRead)}${totalSuffix}, ${state.featureCount.toLocaleString()} features`,
  );
  state.lastLoggedAt = now;
};

const geoJsonSeqRecords = async function* (filePath, state) {
  const stream = createReadStream(filePath, { encoding: 'utf8' });
  let buffer = '';

  for await (const chunk of stream) {
    buffer += chunk;
    state.bytesRead += Buffer.byteLength(chunk, 'utf8');

    const parts = buffer.split('\u001e');
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      const record = part.trim();
      if (!record) {
        continue;
      }

      yield JSON.parse(record);
    }
  }

  const record = buffer.trim();
  if (record) {
    yield JSON.parse(record);
  }
};

const runOsmiumPipeline = async (input, tempDir) => {
  const baseName = basename(input)
    .replace(/\.[^.]+$/u, '')
    .replace(/\.[^.]+$/u, '');
  const filteredPath = join(tempDir, `${baseName}.filtered.osm.pbf`);
  const exportPath = join(tempDir, `${baseName}.geojsonseq`);

  console.log(`Filtering airport features from ${baseName}...`);
  await runCommand('osmium', [
    'tags-filter',
    '-O',
    '-o',
    filteredPath,
    input,
    ...FILTER_EXPRESSIONS,
  ]);

  console.log(`Exporting ${baseName} to GeoJSONSeq...`);
  await runCommand('osmium', [
    'export',
    '-O',
    '-f',
    'geojsonseq',
    '-a',
    'type,id',
    '-o',
    exportPath,
    filteredPath,
  ]);

  return { baseName, exportPath, filteredPath };
};

const collectMarkingBboxes = async (exportPath, baseName) => {
  const state = {
    baseName,
    bytesRead: 0,
    totalBytes: statSync(exportPath).size,
    featureCount: 0,
    lastLoggedAt: Date.now(),
  };
  const bboxes = [];
  for await (const f of geoJsonSeqRecords(exportPath, state)) {
    if (f.properties?.aeroway === 'marking' && f.geometry?.coordinates) {
      bboxes.push(computeBbox(f.geometry));
    }
  }
  return bboxes;
};

const processExport = async (exportPath, layerFiles, totals, baseName) => {
  console.log(`Scanning ${baseName} for existing OSM markings...`);
  const markingBboxes = await collectMarkingBboxes(exportPath, baseName);
  console.log(
    `  Found ${markingBboxes.length} OSM markings; runways near these will skip synthesized markings`,
  );

  const state = {
    baseName,
    bytesRead: 0,
    totalBytes: statSync(exportPath).size,
    featureCount: 0,
    lastLoggedAt: Date.now(),
  };
  const layerBatches = createLayerBatches();
  const seenAirportNodes = new Set();
  const seenTowers = [];

  console.log(
    `Normalizing ${baseName} from ${formatBytes(state.totalBytes)} of GeoJSONSeq...`,
  );

  for await (const rawFeature of geoJsonSeqRecords(exportPath, state)) {
    state.featureCount += 1;
    const layers = normalizeRawFeature(
      rawFeature,
      seenAirportNodes,
      markingBboxes,
      seenTowers,
    );

    for (const layerId of LAYER_IDS) {
      if (!layers[layerId].length) {
        continue;
      }

      layerBatches[layerId].push(...layers[layerId]);
    }

    if (state.featureCount % FLUSH_EVERY_FEATURES === 0) {
      flushLayerBatches(layerFiles, layerBatches, totals);
      maybeLogNormalizationProgress(state);
    }
  }

  flushLayerBatches(layerFiles, layerBatches, totals);
  console.log(
    `Finished ${baseName}: ${state.featureCount.toLocaleString()} features normalized`,
  );
};

const runTippecanoe = async (output, layerFiles, tempDir) => {
  const args = [
    '--force',
    '--read-parallel',
    '--temporary-directory',
    tempDir,
    '-o',
    output,
    '-Z9',
    '-z14',
    '--simplify-only-low-zooms',
    '--drop-densest-as-needed',
    '--no-tile-size-limit',
    '--no-feature-limit',
  ];

  for (const [layerId, filePath] of Object.entries(layerFiles)) {
    args.push('-L', `${layerId}:${filePath}`);
  }

  console.log('Packaging PMTiles with tippecanoe...');
  await runCommand('tippecanoe', args);
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  await ensureCommand('osmium', 'Install it with: brew install osmium-tool');
  await ensureCommand('tippecanoe', 'Install it with: brew install tippecanoe');

  mkdirSync(options.tempDir, { recursive: true });
  mkdirSync(join(process.cwd(), 'static'), { recursive: true });

  const layerFiles = layerNdjsonPaths(options.tempDir);
  resetLayerFiles(layerFiles);
  const totals = Object.fromEntries(LAYER_IDS.map((layerId) => [layerId, 0]));

  for (const input of options.inputs) {
    const { baseName, exportPath, filteredPath } = await runOsmiumPipeline(
      input,
      options.tempDir,
    );

    await processExport(exportPath, layerFiles, totals, baseName);
    rmSync(filteredPath, { force: true });
    rmSync(exportPath, { force: true });
  }

  console.log(
    `Layer counts: ${Object.entries(totals)
      .map(([layerId, count]) => `${layerId}=${count}`)
      .join(', ')}`,
  );
  await runTippecanoe(options.output, layerFiles, options.tempDir);
  console.log(`Wrote ${options.output}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
