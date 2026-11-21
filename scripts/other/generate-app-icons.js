#!/usr/bin/env bun
// Generates every PNG of the logo from static/favicon.svg: the favicons, the
// PWA / home-screen icons, the docs site icons and the map's tower marker.
// The logo is Lucide's tower-control icon: https://lucide.dev/icons/tower-control
// Run after changing the logo: bun scripts/other/generate-app-icons.js

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const sharpModule = await import(process.env.SHARP_PATH ?? 'sharp').catch(
  () => {
    throw new Error(
      'sharp is required to generate app icons. Install it locally or set SHARP_PATH to an installed sharp module.',
    );
  },
);
const sharp = sharpModule.default;

const ROOT = process.cwd();

// `scale` is the logo height as a fraction of the icon height; without it the
// SVG is used as-is, with its own padding. Maskable icons are cropped by the
// launcher to a shape that always contains the centre 80% circle, so the logo
// must stay inside it. `background: null` keeps the icon transparent.
const ICONS = [
  { file: 'static/favicon.png', size: 96, background: null },
  { file: 'static/icon-192.png', size: 192, scale: 0.68 },
  { file: 'static/icon-512.png', size: 512, scale: 0.68 },
  { file: 'static/icon-512-maskable.png', size: 512, scale: 0.63 },
  { file: 'static/apple-touch-icon.png', size: 180, scale: 0.68 },
  { file: 'docs/app/icon.png', size: 256, background: null },
  { file: 'docs/public/logo.png', size: 256, background: null },
  // Control-tower marker on the map (airport-style sprite, @1x and @2x).
  { file: 'static/airport-style/tower.png', size: 24, background: null },
  { file: 'static/airport-style/tower@2x.png', size: 48, background: null },
];

const svg = readFileSync(join(ROOT, 'static/favicon.svg'));

for (const { file, size, scale, background = '#000000' } of ICONS) {
  const height = scale ? Math.round(size * scale) : size;
  // Render well above the target size, then downscale. With a scale, trim to
  // the logo first so the logo itself is `scale` of the icon height.
  let logo = sharp(svg, { density: 72 * Math.ceil((height * 4) / 24) });
  if (scale) logo = logo.trim();
  logo = await logo.resize({ height }).toBuffer();
  const { width } = await sharp(logo).metadata();

  let icon = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: background ?? { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([
    {
      input: logo,
      left: Math.round((size - width) / 2),
      top: Math.round((size - height) / 2),
    },
  ]);
  if (background) icon = icon.removeAlpha();
  await icon.png({ compressionLevel: 9 }).toFile(join(ROOT, file));

  console.log(
    `${file}: ${size}x${size}, logo ${width}x${height}, ${background ?? 'transparent'}`,
  );
}
