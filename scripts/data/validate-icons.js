#!/usr/bin/env node

/**
 * Validates airline icon files.
 * - Ensures icon filenames match airline IDs in airlines.json
 * - Reports orphaned icons (no matching airline)
 * - Optionally reports airlines without icons (--show-missing)
 *
 * Usage:
 *   bun scripts/data/validate-icons.js [--show-missing]
 *
 * Exit codes:
 *   0 - All validations passed
 *   1 - Orphaned icons found (icons without matching airline)
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, parse } from 'node:path';

const DATA_DIR = join(import.meta.dirname, '../../data');
const ICONS_DIR = join(DATA_DIR, 'icons/airlines');
const SHOW_MISSING = process.argv.includes('--show-missing');

const ALLOWED_EXTENSIONS = ['.svg', '.png', '.jpg', '.jpeg', '.webp'];

function loadAirlineIds() {
  const content = readFileSync(join(DATA_DIR, 'airlines.json'), 'utf8');
  const airlines = JSON.parse(content);
  return new Set(airlines.map((a) => a.id));
}

function getIconFiles() {
  try {
    return readdirSync(ICONS_DIR).filter((f) => {
      const ext = parse(f).ext.toLowerCase();
      return ALLOWED_EXTENSIONS.includes(ext);
    });
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.log('Icons directory does not exist yet');
      return [];
    }
    throw e;
  }
}

const airlineIds = loadAirlineIds();
const iconFiles = getIconFiles();

const orphanedIcons = [];
const matchedIcons = new Set();

for (const file of iconFiles) {
  const { name } = parse(file);

  if (airlineIds.has(name)) {
    matchedIcons.add(name);
  } else {
    orphanedIcons.push(file);
  }
}

console.log(
  `Found ${iconFiles.length} icon(s) for ${airlineIds.size} airline(s)\n`,
);

if (orphanedIcons.length > 0) {
  console.log(
    `❌ ${orphanedIcons.length} orphaned icon(s) (no matching airline):`,
  );
  orphanedIcons.forEach((icon) => {
    console.log(`   - ${icon}`);
  });
  console.log(
    '\nTo fix: Either add the airline to airlines.json or rename the icon to match an existing airline ID.\n',
  );
}

if (SHOW_MISSING) {
  const missingIcons = [...airlineIds].filter((id) => !matchedIcons.has(id));
  if (missingIcons.length > 0) {
    console.log(`ℹ️  ${missingIcons.length} airline(s) without icons:`);
    missingIcons.slice(0, 20).forEach((id) => {
      console.log(`   - ${id}`);
    });
    if (missingIcons.length > 20) {
      console.log(`   ... and ${missingIcons.length - 20} more`);
    }
    console.log('');
  }
}

if (orphanedIcons.length > 0) {
  process.exit(1);
} else {
  console.log('✅ All icons match airline IDs');
}
