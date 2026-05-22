#!/usr/bin/env bun
// Generates the airport-style sprite PNGs (chevrons, PAPI bar, windsock).
// Run when adjusting the icon designs.

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const sharpModule = await import(process.env.SHARP_PATH ?? 'sharp').catch(
  () => {
    throw new Error(
      'sharp is required to generate airport style icons. Install it locally or set SHARP_PATH to an installed sharp module.',
    );
  },
);
const sharp = sharpModule.default;

const OUT_DIR = join(process.cwd(), 'static/airport-style');

// All sizes here are at @1x. @2x is rendered by doubling internally.
// Cone/spotlight beam pointing UP in the unrotated SVG. The bulb sits at the
// bottom (rendering anchor) so the geographic point stays under the bulb after
// icon-rotate. Beam fades out with a linear gradient.
const chevron = (color) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 18">
  <defs>
    <linearGradient id="g" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%"  stop-color="${color}" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0.05"/>
    </linearGradient>
  </defs>
  <polygon points="6,16 10,16 15,1 1,1" fill="url(#g)"/>
  <circle cx="8" cy="16" r="2" fill="${color}"/>
</svg>`;

// PAPI: 4-light bar, classic 2-white + 2-red "on glide path" indication.
// Dark stroke makes the white dots visible against light basemaps.
const papi = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 8">
  <circle cx="3"  cy="4" r="2.2" fill="#ffffff" stroke="#1f2937" stroke-width="0.6"/>
  <circle cx="9"  cy="4" r="2.2" fill="#ffffff" stroke="#1f2937" stroke-width="0.6"/>
  <circle cx="15" cy="4" r="2.2" fill="#ef4444" stroke="#1f2937" stroke-width="0.6"/>
  <circle cx="21" cy="4" r="2.2" fill="#ef4444" stroke="#1f2937" stroke-width="0.6"/>
</svg>`;

// AirTrail's own logo: Lucide tower-control. Uses the brand blue.
const tower = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
     stroke="#3c83f6" stroke-width="2"
     stroke-linecap="round" stroke-linejoin="round">
  <path d="M18.2 12.27 20 6H4l1.8 6.27a1 1 0 0 0 .95.73h10.5a1 1 0 0 0 .96-.73Z"/>
  <path d="M8 13v9"/>
  <path d="M16 22v-9"/>
  <path d="m9 6 1 7"/>
  <path d="m15 6-1 7"/>
  <path d="M12 6V2"/>
  <path d="M13 2h-2"/>
</svg>`;

// Windsock: red/white striped cone widening from pole to open end. Dark pole +
// outline keep it readable on both light and dark basemaps.
const windsock = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 16">
  <line x1="3" y1="1" x2="3" y2="15" stroke="#1f2937" stroke-width="1.5"
        stroke-linecap="round"/>
  <circle cx="3" cy="2" r="1.1" fill="#1f2937"/>
  <polygon points="3,5 10,4 10,10 3,9"   fill="#ef4444"/>
  <polygon points="10,4 16,3 16,11 10,10" fill="#ffffff"/>
  <polygon points="16,3 22,2 22,12 16,11" fill="#ef4444"/>
  <path d="M 3,5 L 10,4 L 16,3 L 22,2 L 22,12 L 16,11 L 10,10 L 3,9 Z"
        fill="none" stroke="#1f2937" stroke-width="0.6" stroke-linejoin="round"/>
</svg>`;

const ICONS = [
  { id: 'chevron-white', svg: chevron('#ffffff') },
  { id: 'chevron-blue', svg: chevron('#3b82f6') },
  { id: 'chevron-gray', svg: chevron('#9ca3af') },
  { id: 'chevron-green', svg: chevron('#22c55e') },
  { id: 'chevron-red', svg: chevron('#ef4444') },
  { id: 'chevron-yellow', svg: chevron('#facc15') },
  { id: 'papi', svg: papi },
  { id: 'windsock', svg: windsock },
  { id: 'tower', svg: tower },
];

for (const { id, svg } of ICONS) {
  for (const scale of [1, 2]) {
    const buf = await sharp(Buffer.from(svg.trim()), { density: 72 * scale })
      .png()
      .toBuffer();
    const suffix = scale === 2 ? '@2x' : '';
    const filepath = join(OUT_DIR, `${id}${suffix}.png`);
    writeFileSync(filepath, buf);
    console.log(`Wrote ${filepath} (${buf.length} bytes)`);
  }
}
