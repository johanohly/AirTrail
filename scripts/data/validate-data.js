#!/usr/bin/env node

/**
 * Validates airline and aircraft JSON data files.
 * - Schema validation (required fields, types)
 * - Duplicate detection (IDs, ICAO codes, IATA codes)
 * - Format validation (slug format for IDs, ICAO/IATA formats, controlled duplicate IATA codes)
 *
 * Usage:
 *   bun scripts/data/validate-data.js
 *
 * Exit codes:
 *   0 - All validations passed
 *   1 - Validation errors found
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DATA_DIR = join(import.meta.dirname, '../../data');

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ICAO_AIRLINE_REGEX = /^[A-Z]{3}$/;
const ICAO_AIRCRAFT_REGEX = /^[A-Z0-9]{2,4}$/;
const IATA_REGEX = /^[A-Z0-9]{2}\*?$/;

const errors = [];
const warnings = [];

function error(file, index, field, message) {
  errors.push({ file, index, field, message });
}

function warn(file, index, field, message) {
  warnings.push({ file, index, field, message });
}

function validateAirlines() {
  const filePath = join(DATA_DIR, 'airlines.json');
  const content = readFileSync(filePath, 'utf8');
  let data;

  try {
    data = JSON.parse(content);
  } catch (e) {
    error('airlines.json', null, null, `Invalid JSON: ${e.message}`);
    return;
  }

  if (!Array.isArray(data)) {
    error('airlines.json', null, null, 'Root must be an array');
    return;
  }

  const seenIds = new Map();
  const seenIcao = new Map();
  const seenIata = new Map();

  data.forEach((airline, index) => {
    const loc = `[${index}] ${airline.id || '(no id)'}`;

    // Required fields
    if (typeof airline.id !== 'string' || !airline.id) {
      error('airlines.json', index, 'id', `${loc}: Missing or invalid 'id'`);
    }
    if (typeof airline.name !== 'string' || !airline.name) {
      error(
        'airlines.json',
        index,
        'name',
        `${loc}: Missing or invalid 'name'`,
      );
    }
    if (typeof airline.icao !== 'string' || !airline.icao) {
      error(
        'airlines.json',
        index,
        'icao',
        `${loc}: Missing or invalid 'icao'`,
      );
    }
    if (airline.iata !== null && typeof airline.iata !== 'string') {
      error(
        'airlines.json',
        index,
        'iata',
        `${loc}: 'iata' must be string or null`,
      );
    }
    if (typeof airline.defunct !== 'boolean') {
      error(
        'airlines.json',
        index,
        'defunct',
        `${loc}: Missing or invalid 'defunct' (must be boolean)`,
      );
    }

    // ID format (slug)
    if (airline.id && !SLUG_REGEX.test(airline.id)) {
      error(
        'airlines.json',
        index,
        'id',
        `${loc}: Invalid ID format. Must be lowercase slug (e.g., 'american-airlines')`,
      );
    }

    // ICAO format
    if (airline.icao && !ICAO_AIRLINE_REGEX.test(airline.icao)) {
      error(
        'airlines.json',
        index,
        'icao',
        `${loc}: Invalid ICAO format '${airline.icao}'. Must be 3 uppercase letters`,
      );
    }

    // IATA format (2 uppercase alphanumeric, optionally followed by * for controlled duplicates)
    if (airline.iata && !IATA_REGEX.test(airline.iata)) {
      error(
        'airlines.json',
        index,
        'iata',
        `${loc}: Invalid IATA format '${airline.iata}'. Must be 2 uppercase alphanumeric, optionally followed by * for controlled duplicates`,
      );
    }

    // Duplicate ID
    if (airline.id) {
      if (seenIds.has(airline.id)) {
        error(
          'airlines.json',
          index,
          'id',
          `${loc}: Duplicate ID (first seen at index ${seenIds.get(airline.id)})`,
        );
      } else {
        seenIds.set(airline.id, index);
      }
    }

    // Duplicate ICAO
    if (airline.icao) {
      if (seenIcao.has(airline.icao)) {
        // Allow duplicate ICAO codes (some defunct airlines share codes with active ones)
        warn(
          'airlines.json',
          index,
          'icao',
          `${loc}: Duplicate ICAO '${airline.icao}' (first seen at index ${seenIcao.get(airline.icao)})`,
        );
      } else {
        seenIcao.set(airline.icao, index);
      }
    }

    // Duplicate IATA detection
    // Bare codes (e.g. "JL") must be unique — error if two airlines share the same bare code.
    // Starred codes (e.g. "JL*") are controlled duplicates of the bare code, so "JL" + "JL*" is expected.
    // Two identical starred codes (e.g. two "FS*") are still flagged as warnings.
    if (airline.iata) {
      if (seenIata.has(airline.iata)) {
        const level = airline.iata.endsWith('*') ? warn : error;
        level(
          'airlines.json',
          index,
          'iata',
          `${loc}: Duplicate IATA '${airline.iata}' (first seen at index ${seenIata.get(airline.iata)})`,
        );
      } else {
        seenIata.set(airline.iata, index);
      }
    }
  });

  console.log(`Validated ${data.length} airlines`);
}

function validateAircraft() {
  const filePath = join(DATA_DIR, 'aircraft.json');
  const content = readFileSync(filePath, 'utf8');
  let data;

  try {
    data = JSON.parse(content);
  } catch (e) {
    error('aircraft.json', null, null, `Invalid JSON: ${e.message}`);
    return;
  }

  if (!Array.isArray(data)) {
    error('aircraft.json', null, null, 'Root must be an array');
    return;
  }

  const seenIds = new Map();
  const seenIcao = new Map();

  data.forEach((aircraft, index) => {
    const loc = `[${index}] ${aircraft.id || '(no id)'}`;

    // Required fields
    if (typeof aircraft.id !== 'string' || !aircraft.id) {
      error('aircraft.json', index, 'id', `${loc}: Missing or invalid 'id'`);
    }
    if (typeof aircraft.name !== 'string' || !aircraft.name) {
      error(
        'aircraft.json',
        index,
        'name',
        `${loc}: Missing or invalid 'name'`,
      );
    }
    if (typeof aircraft.icao !== 'string' || !aircraft.icao) {
      error(
        'aircraft.json',
        index,
        'icao',
        `${loc}: Missing or invalid 'icao'`,
      );
    }

    // ID format (slug)
    if (aircraft.id && !SLUG_REGEX.test(aircraft.id)) {
      error(
        'aircraft.json',
        index,
        'id',
        `${loc}: Invalid ID format. Must be lowercase slug (e.g., 'boeing-737-800')`,
      );
    }

    // ICAO format (aircraft type designators are 2-4 alphanumeric)
    if (aircraft.icao && !ICAO_AIRCRAFT_REGEX.test(aircraft.icao)) {
      error(
        'aircraft.json',
        index,
        'icao',
        `${loc}: Invalid ICAO format '${aircraft.icao}'. Must be 2-4 uppercase alphanumeric`,
      );
    }

    // Duplicate ID
    if (aircraft.id) {
      if (seenIds.has(aircraft.id)) {
        error(
          'aircraft.json',
          index,
          'id',
          `${loc}: Duplicate ID (first seen at index ${seenIds.get(aircraft.id)})`,
        );
      } else {
        seenIds.set(aircraft.id, index);
      }
    }

    // Duplicate ICAO
    if (aircraft.icao) {
      if (seenIcao.has(aircraft.icao)) {
        warn(
          'aircraft.json',
          index,
          'icao',
          `${loc}: Duplicate ICAO '${aircraft.icao}' (first seen at index ${seenIcao.get(aircraft.icao)})`,
        );
      } else {
        seenIcao.set(aircraft.icao, index);
      }
    }
  });

  console.log(`Validated ${data.length} aircraft`);
}

// Run validations
console.log('Validating data files...\n');

validateAirlines();
validateAircraft();

// Output results
console.log('');

if (warnings.length > 0) {
  console.log(`⚠️  ${warnings.length} warning(s):`);
  warnings.forEach((w) => {
    console.log(`   ${w.file}: ${w.message}`);
  });
  console.log('');
}

if (errors.length > 0) {
  console.log(`❌ ${errors.length} error(s):`);
  errors.forEach((e) => {
    console.log(`   ${e.file}: ${e.message}`);
  });
  process.exit(1);
} else {
  console.log('✅ All validations passed');
}
