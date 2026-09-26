import { existsSync, readdirSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import pixelmatch from 'pixelmatch';
import sharp from 'sharp';

import { RAW_DIR } from './support/constants';

const ROOT = join(import.meta.dirname, '..', '..');
const DOCS_SCREENSHOTS = join(ROOT, 'docs', 'public', 'screenshots');

/** Shots with fixed destinations outside the docs screenshot folder. */
const SPECIAL: Record<string, (theme: string) => string> = {
  // The landing page swaps these with the site theme.
  hero: (theme) => join(ROOT, 'docs', 'public', `${theme}.png`),
};

/**
 * Up to this many changed pixels, the existing file is kept. pixelmatch already
 * ignores anti-aliasing, so this only absorbs encoder noise; a changed word
 * is well over it.
 */
const CHANGE_THRESHOLD = 200;

type Result = 'written' | 'unchanged';

const decode = (input: string | Buffer) =>
  sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

/** Whether `next` differs visibly from the image already at `path`. */
const hasChanged = async (path: string, next: Buffer) => {
  if (!existsSync(path)) return true;
  const [before, after] = await Promise.all([decode(path), decode(next)]);
  if (
    before.info.width !== after.info.width ||
    before.info.height !== after.info.height
  )
    return true;
  const { width, height } = after.info;
  const changed = pixelmatch(before.data, after.data, null, width, height, {
    threshold: 0.1,
  });
  if (process.env.SCREENSHOTS_DEBUG) console.log(`  ${path}: ${changed} px`);
  return changed > CHANGE_THRESHOLD;
};

const writeIfChanged = async (path: string, image: Buffer): Promise<Result> => {
  if (!(await hasChanged(path, image))) return 'unchanged';
  await mkdir(dirname(path), { recursive: true });
  await sharp(image).toFile(path);
  return 'written';
};

const encode = (raw: string, path: string) =>
  path.endsWith('.webp')
    ? sharp(raw).webp({ quality: 88, effort: 6 }).toBuffer()
    : sharp(raw).png({ compressionLevel: 9, palette: false }).toBuffer();

/** The README image: the light capture on the left, dark on the right. */
const splitImage = async (light: string, dark: string) => {
  const { width, height } = await sharp(light).metadata();
  const half = Math.round(width! / 2);
  const right = await sharp(dark)
    .extract({ left: half, top: 0, width: width! - half, height: height! })
    .toBuffer();
  return sharp(light)
    .composite([{ input: right, left: half, top: 0 }])
    .png({ compressionLevel: 9 })
    .toBuffer();
};

export const processScreenshots = async () => {
  const results: { file: string; result: Result }[] = [];
  const raws = readdirSync(RAW_DIR).filter((file) => file.endsWith('.png'));

  for (const file of raws) {
    const [name, theme] = file.replace(/\.png$/, '').split('.');
    const target =
      SPECIAL[name]?.(theme) ?? join(DOCS_SCREENSHOTS, `${name}.${theme}.webp`);
    const image = await encode(join(RAW_DIR, file), target);
    results.push({
      file: target.slice(ROOT.length + 1),
      result: await writeIfChanged(target, image),
    });
  }

  const light = join(RAW_DIR, 'hero.light.png');
  const dark = join(RAW_DIR, 'hero.dark.png');
  if (existsSync(light) && existsSync(dark)) {
    const target = join(ROOT, 'static', 'showcase', 'toggle.png');
    results.push({
      file: target.slice(ROOT.length + 1),
      result: await writeIfChanged(target, await splitImage(light, dark)),
    });
  }

  return results;
};
