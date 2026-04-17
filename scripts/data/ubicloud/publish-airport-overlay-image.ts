#!/usr/bin/env bun

import {
  cancel,
  confirm,
  intro,
  isCancel,
  log,
  outro,
  text,
} from '@clack/prompts';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const DEFAULT_INPUT_PATH = resolve(
  process.cwd(),
  'static/airport-overlay.pmtiles',
);
const DEFAULT_IMAGE = 'johly/airtrail-airport-overlay';
const DEFAULT_PLATFORMS = 'linux/amd64,linux/arm64';
const DEFAULT_BUILDER = 'airtrail-builder';

type Options = {
  input: string;
  image: string;
  tag?: string;
  publishLatest: boolean;
  yes: boolean;
};

const parseArgs = (argv: string[]): Options => {
  const options: Options = {
    input: DEFAULT_INPUT_PATH,
    image: DEFAULT_IMAGE,
    publishLatest: true,
    yes: false,
  };

  for (const arg of argv) {
    if (arg === '--yes') {
      options.yes = true;
      continue;
    }

    if (arg === '--no-latest') {
      options.publishLatest = false;
      continue;
    }

    const [flag, rawValue] = arg.split('=', 2);
    if (!rawValue) {
      throw new Error(`Expected --flag=value format, received '${arg}'`);
    }

    switch (flag) {
      case '--input':
        options.input = resolve(process.cwd(), rawValue);
        break;
      case '--image':
        options.image = rawValue;
        break;
      case '--tag':
        options.tag = rawValue;
        break;
      default:
        throw new Error(`Unknown option '${flag}'`);
    }
  }

  return options;
};

const formatBytes = (value: number) => {
  if (value < 1024) {
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

const defaultTag = () => {
  const now = new Date();
  return `${now.getFullYear()}.${now.getMonth() + 1}.${now.getDate()}`;
};

const promptValue = async (
  value: string | undefined,
  prompt: string,
  fallback?: string,
) => {
  if (value) {
    return value;
  }

  const response = await text({
    message: prompt,
    placeholder: fallback,
    defaultValue: fallback,
    validate: (input) =>
      (input ?? fallback ?? '').trim() ? undefined : 'Value is required',
  });

  if (isCancel(response)) {
    cancel('Cancelled');
    process.exit(1);
  }

  return (response ?? fallback ?? '').trim();
};

const runCommand = (command: string, args: string[]) =>
  new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
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

const commandSucceeds = (command: string, args: string[]) => {
  const result = spawnSync(command, args, {
    stdio: 'ignore',
  });

  return result.status === 0;
};

const ensureBuildxBuilder = async (builder: string) => {
  if (!commandSucceeds('docker', ['buildx', 'inspect', builder])) {
    log.info(`Creating buildx builder '${builder}'`);
    await runCommand('docker', [
      'buildx',
      'create',
      '--name',
      builder,
      '--driver',
      'docker-container',
    ]);
  }

  await runCommand('docker', ['buildx', 'inspect', '--bootstrap', builder]);
};

const hashFile = (filePath: string) =>
  new Promise<string>((resolvePromise, rejectPromise) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);

    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', rejectPromise);
    stream.on('end', () => resolvePromise(hash.digest('hex')));
  });

const main = async () => {
  const options = parseArgs(process.argv.slice(2));

  intro('AirTrail airport overlay image publisher');

  if (!existsSync(options.input)) {
    throw new Error(
      `Missing PMTiles file at ${options.input}. Generate it first with bun run data:generate-airport-overlay:ubicloud.`,
    );
  }

  const tag = await promptValue(options.tag, 'Image tag', defaultTag());
  const image = await promptValue(options.image, 'Docker image', DEFAULT_IMAGE);
  const stats = statSync(options.input);
  const digest = await hashFile(options.input);

  log.info(`Using ${options.input}`);
  log.info(`Size: ${formatBytes(stats.size)}`);
  log.info(`SHA256: ${digest}`);

  let shouldPublishLatest = options.publishLatest;
  if (options.publishLatest && !options.yes) {
    const publishLatest = await confirm({
      message: 'Also update the latest tag?',
      initialValue: true,
    });

    if (isCancel(publishLatest)) {
      cancel('Cancelled');
      process.exit(1);
    }

    shouldPublishLatest = publishLatest;
  }

  if (!options.yes) {
    const confirmed = await confirm({
      message: `Push ${image}:${tag}${shouldPublishLatest ? ` and ${image}:latest` : ''}?`,
      initialValue: true,
    });

    if (isCancel(confirmed) || !confirmed) {
      cancel('Cancelled');
      process.exit(1);
    }
  }

  await runCommand('docker', ['version']);
  await runCommand('docker', ['buildx', 'version']);
  await ensureBuildxBuilder(DEFAULT_BUILDER);

  const tags = [`${image}:${tag}`];
  if (shouldPublishLatest && tag !== 'latest') {
    tags.push(`${image}:latest`);
  }

  const args = [
    'buildx',
    'build',
    '--builder',
    DEFAULT_BUILDER,
    '--platform',
    DEFAULT_PLATFORMS,
    '--file',
    'docker/airport-overlay.Dockerfile',
    '--push',
    '--label',
    'org.opencontainers.image.title=AirTrail Airport Overlay',
    '--label',
    'org.opencontainers.image.description=Airport overlay PMTiles data image for AirTrail',
    '--label',
    `io.airtrail.airport-overlay.sha256=${digest}`,
    '--label',
    `io.airtrail.airport-overlay.size-bytes=${stats.size}`,
  ];

  for (const imageTag of tags) {
    args.push('--tag', imageTag);
  }

  args.push('.');

  await runCommand('docker', args);

  log.success(`Published ${tags.join(', ')}`);
  log.info(`App image can now use ${image}:${tag}`);
  outro('Airport overlay image publish finished');
};

main().catch((error) => {
  cancel(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
