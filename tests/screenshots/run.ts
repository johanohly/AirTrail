/**
 * Regenerates the documentation screenshots against a throwaway instance.
 *
 *   bun run screenshots                 all shots
 *   bun run screenshots settings        shots whose test title matches
 *   bun run screenshots --skip-build    reuse the existing ./build
 *   bun run screenshots --keep          leave the app and database running
 *
 * It never touches the development database: Postgres runs in its own
 * container on port 55432 and the app on port 3999.
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import { processScreenshots } from './postprocess';
import { RAW_DIR } from './support/constants';

const ROOT = join(import.meta.dirname, '..', '..');
const DB_CONTAINER = 'airtrail-screenshots-db';
const DB_PORT = 55432;
const APP_PORT = 3999;
const BASE_URL = `http://localhost:${APP_PORT}`;
const UPLOADS_DIR = join(ROOT, 'tests', 'screenshots', '.output', 'uploads');
const DB_URL = `postgres://airtrail:airtrail@localhost:${DB_PORT}/airtrail`;

const args = process.argv.slice(2);
const skipBuild = args.includes('--skip-build');
const keep = args.includes('--keep');
const filters = args.filter((arg) => !arg.startsWith('--'));

const step = (message: string) => console.log(`\n▸ ${message}`);

const run = (command: string, commandArgs: string[], env = {}) => {
  const result = spawnSync(command, commandArgs, {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  if (result.status !== 0)
    throw new Error(`${command} ${commandArgs.join(' ')} failed`);
};

const waitFor = async (
  check: () => Promise<boolean>,
  what: string,
  ms: number,
) => {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await check().catch(() => false)) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for ${what}`);
};

const stopDatabase = () =>
  spawnSync('docker', ['rm', '-f', DB_CONTAINER], { stdio: 'ignore' });

let app: ChildProcess | undefined;

const main = async () => {
  step('Starting a throwaway Postgres');
  stopDatabase();
  run('docker', [
    'run',
    '-d',
    '--rm',
    '--name',
    DB_CONTAINER,
    '-e',
    'POSTGRES_USER=airtrail',
    '-e',
    'POSTGRES_PASSWORD=airtrail',
    '-e',
    'POSTGRES_DB=airtrail',
    '-p',
    `${DB_PORT}:5432`,
    'postgres:16-alpine',
  ]);
  await waitFor(
    async () =>
      spawnSync('docker', [
        'exec',
        DB_CONTAINER,
        'pg_isready',
        '-h',
        '127.0.0.1',
        '-U',
        'airtrail',
      ]).status === 0,
    'Postgres',
    60_000,
  );

  step('Applying migrations');
  run('node', ['docker/migrate.js'], { DB_URL });

  if (!skipBuild || !existsSync(join(ROOT, 'build'))) {
    step('Building AirTrail');
    run('bun', ['run', 'build']);
  }

  rmSync(UPLOADS_DIR, { recursive: true, force: true });
  mkdirSync(UPLOADS_DIR, { recursive: true });

  step('Starting AirTrail (it downloads airport data and seeds the demo)');
  app = spawn('node', ['build'], {
    cwd: ROOT,
    stdio: ['ignore', 'inherit', 'inherit'],
    env: {
      ...process.env,
      DB_URL,
      // Seeds the demo world on start, with dates as written.
      DEMO_MODE: 'screenshots',
      ORIGIN: BASE_URL,
      PORT: String(APP_PORT),
      BODY_SIZE_LIMIT: '20M',
      // Its own folder, so airline logos come from a fresh icon sync rather
      // than whatever a development .env points at.
      UPLOAD_LOCATION: UPLOADS_DIR,
    },
  });
  await waitFor(
    async () => (await fetch(`${BASE_URL}/login`)).ok,
    'AirTrail',
    180_000,
  );

  step('Capturing');
  rmSync(RAW_DIR, { recursive: true, force: true });
  const grep = filters.length ? ['--grep', filters.join('|')] : [];
  const capture = spawnSync(
    'bunx',
    [
      'playwright',
      'test',
      '-c',
      'tests/screenshots/playwright.config.ts',
      ...grep,
    ],
    {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env, SCREENSHOTS_BASE_URL: BASE_URL },
    },
  );

  step('Encoding and comparing');
  mkdirSync(RAW_DIR, { recursive: true });
  const results = await processScreenshots();
  for (const { file, result } of results)
    console.log(`  ${result === 'written' ? '✎' : '·'} ${file}`);
  const written = results.filter((r) => r.result === 'written').length;
  console.log(`  ${written} updated, ${results.length - written} unchanged`);

  if (capture.status !== 0) throw new Error('Some shots failed');
};

const cleanup = async () => {
  if (keep) {
    console.log(
      `\nLeft running: ${BASE_URL} (docker rm -f ${DB_CONTAINER} to stop the database)`,
    );
    return;
  }
  // Stop the app first so it doesn't crash on the vanishing database.
  if (app && app.exitCode === null) {
    const exited = new Promise((resolve) => app!.once('exit', resolve));
    app.kill();
    await exited;
  }
  stopDatabase();
};

main()
  .then(async () => {
    await cleanup();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error(`\n✗ ${error instanceof Error ? error.message : error}`);
    await cleanup();
    process.exit(1);
  });
