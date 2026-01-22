#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { createWriteStream, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const SOURCE_URL =
  'https://gisco-services.ec.europa.eu/distribution/v2/countries/geojson/CNTR_RG_01M_2024_4326.geojson';
const TEMP_GEOJSON = join(tmpdir(), 'countries-01m.geojson');
const OUTPUT_PMTILES = join(process.cwd(), 'static/countries.pmtiles');
const OUTPUT_BOUNDS = join(process.cwd(), 'static/countries-bounds.json');

const downloadGeojson = async () => {
  const response = await fetch(SOURCE_URL);
  if (!response.ok) {
    throw new Error(
      `Failed to download GeoJSON: ${response.status} ${response.statusText}`,
    );
  }

  await pipeline(response.body, createWriteStream(TEMP_GEOJSON));
};

const runTippecanoe = async () => {
  await execFileAsync('tippecanoe', [
    '--force',
    '-o',
    OUTPUT_PMTILES,
    '-l',
    'countries',
    '-Z0',
    '-z5',
    '--drop-densest-as-needed',
    '--simplify-only-low-zooms',
    '-y',
    'ISO3_CODE',
    '-s',
    'EPSG:4326',
    TEMP_GEOJSON,
  ]);
};

const walkCoords = (coords, bounds) => {
  if (!coords) return;

  if (typeof coords[0] === 'number') {
    const [x, y] = coords;
    bounds.minX = Math.min(bounds.minX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.maxY = Math.max(bounds.maxY, y);
    return;
  }

  for (const coord of coords) {
    walkCoords(coord, bounds);
  }
};

const generateBounds = () => {
  const data = JSON.parse(readFileSync(TEMP_GEOJSON, 'utf8'));
  const bounds = {};

  for (const feature of data.features ?? []) {
    const code = feature?.properties?.ISO3_CODE;
    if (!code) continue;
    const result = {
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity,
    };

    walkCoords(feature?.geometry?.coordinates, result);
    if (!Number.isFinite(result.minX)) continue;
    bounds[code] = [result.minX, result.minY, result.maxX, result.maxY];
  }

  writeFileSync(OUTPUT_BOUNDS, `${JSON.stringify(bounds, null, 2)}\n`);
};

const main = async () => {
  try {
    await execFileAsync('tippecanoe', ['--version']);
  } catch (error) {
    console.error(
      'tippecanoe is required. Install it with: brew install tippecanoe',
    );
    process.exit(1);
  }

  console.log('Downloading GeoJSON...');
  await downloadGeojson();

  console.log('Generating PMTiles...');
  await runTippecanoe();

  console.log('Generating bounds JSON...');
  generateBounds();

  console.log('Done.');
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
