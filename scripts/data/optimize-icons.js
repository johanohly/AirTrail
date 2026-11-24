/**
 * Optimizes airline SVG icons that the current branch adds or changes,
 * using SVGO (multipass, default preset).
 *
 * Icons are compared against the merge base with the upstream main branch
 * (or `base`, when given), including uncommitted and untracked files.
 * Icons the branch doesn't touch are left alone. SVGs that embed a raster
 * `<image>` are skipped, since SVGO can shift their rendering.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { optimize } from 'svgo';

const ICONS_PATH = 'data/icons/airlines';
const DEFAULT_BASE_REFS = ['upstream/main', 'origin/main'];
const RASTER_IMAGE = /<image[\s>/]/i;

const git = (args, cwd) =>
  execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();

const paths = (output) => output.split('\0').filter(Boolean);

const resolveBase = (root, base) => {
  if (base) return base;

  for (const ref of DEFAULT_BASE_REFS) {
    try {
      return git(['merge-base', 'HEAD', ref], root);
    } catch {
      // Ref doesn't exist in this clone; try the next one.
    }
  }

  console.log(
    `Note: none of ${DEFAULT_BASE_REFS.join(', ')} found; only checking uncommitted icons.`,
  );
  return 'HEAD';
};

const getChangedIcons = (root, base) => {
  const changed = paths(
    git(
      [
        'diff',
        '-z',
        '--name-only',
        '--diff-filter=ACMR',
        base,
        '--',
        ICONS_PATH,
      ],
      root,
    ),
  );
  // No `--exclude-standard`: the root `.gitignore` has `Icon?`, which on
  // case-insensitive file systems (macOS) also ignores `data/icons`.
  const untracked = paths(
    git(['ls-files', '-z', '--others', '--', ICONS_PATH], root),
  );

  return [...new Set([...changed, ...untracked])]
    .filter((file) => file.toLowerCase().endsWith('.svg'))
    .sort();
};

const kb = (bytes) => `${(bytes / 1024).toFixed(1)}KB`;

/**
 * @param {{ check?: boolean, base?: string }} options
 * @returns {{ changed: string[], errors: string[] }}
 */
export const optimizeChangedIcons = ({ check = false, base } = {}) => {
  const changed = [];
  const errors = [];

  let root;
  let files;
  try {
    root = git(['rev-parse', '--show-toplevel']);
    files = getChangedIcons(root, resolveBase(root, base));
  } catch (err) {
    errors.push(`Could not determine changed icons: ${err.message}`);
    return { changed, errors };
  }

  if (files.length === 0) {
    console.log('No changed SVG icons');
    return { changed, errors };
  }

  for (const file of files) {
    const filePath = join(root, file);

    try {
      const content = readFileSync(filePath, 'utf8');

      if (RASTER_IMAGE.test(content)) {
        console.log(`Skipped (embeds raster image): ${file}`);
        continue;
      }

      const { data } = optimize(content, { path: filePath, multipass: true });

      if (data === content) {
        console.log(`OK: ${file}`);
      } else if (check) {
        changed.push(file);
      } else {
        writeFileSync(filePath, data);
        console.log(
          `Optimized: ${file} (${kb(Buffer.byteLength(content))} → ${kb(Buffer.byteLength(data))})`,
        );
      }
    } catch (err) {
      errors.push(`Error optimizing ${file}: ${err.message}`);
    }
  }

  return { changed, errors };
};
