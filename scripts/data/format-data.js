#!/usr/bin/env node

/**
 * Formats and sorts the airline and aircraft JSON data files.
 * - Sorts entries alphabetically by `id`
 * - Ensures consistent JSON formatting (2-space indent)
 *
 * Usage:
 *   bun scripts/data/format-data.js [--check]
 *
 * Options:
 *   --check  Check if files are formatted (exit 1 if not)
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DATA_DIR = join(import.meta.dirname, '../../data');
const CHECK_MODE = process.argv.includes('--check');

const DATA_FILES = [
  { path: 'airlines.json', sortKey: 'id' },
  { path: 'aircraft.json', sortKey: 'id' },
];

let hasErrors = false;

for (const { path, sortKey } of DATA_FILES) {
  const filePath = join(DATA_DIR, path);

  try {
    const content = readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);

    if (!Array.isArray(data)) {
      console.error(`Error: ${path} is not an array`);
      hasErrors = true;
      continue;
    }

    const sorted = [...data].sort((a, b) =>
      String(a[sortKey]).localeCompare(String(b[sortKey])),
    );

    const formatted = JSON.stringify(sorted, null, 2) + '\n';

    if (CHECK_MODE) {
      if (content !== formatted) {
        console.error(`Error: ${path} is not properly formatted or sorted`);
        hasErrors = true;
      } else {
        console.log(`OK: ${path}`);
      }
    } else {
      if (content !== formatted) {
        writeFileSync(filePath, formatted);
        console.log(`Formatted: ${path}`);
      } else {
        console.log(`Already formatted: ${path}`);
      }
    }
  } catch (err) {
    console.error(`Error processing ${path}:`, err.message);
    hasErrors = true;
  }
}

if (hasErrors) {
  process.exit(1);
}
