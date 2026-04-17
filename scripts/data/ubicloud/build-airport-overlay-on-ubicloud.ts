#!/usr/bin/env bun

import {
  cancel,
  confirm,
  intro,
  isCancel,
  log,
  note,
  outro,
  select,
  spinner,
  text,
} from '@clack/prompts';
import { execFile } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const DEFAULT_LOCATION = 'eu-central-h1';
const DEFAULT_OUTPUT_PATH = resolve(
  process.cwd(),
  'static/airport-overlay.pmtiles',
);
const REMOTE_ARCHIVE_PATH = '/tmp/airtrail-build-src.tar.gz';
const REMOTE_SCRIPT_PATH = '/tmp/airtrail-airport-overlay-build.sh';
const REMOTE_BUILD_ROOT = '$HOME/airtrail-build';
const REMOTE_REPO_DIR = '$HOME/airtrail-build/repo';
const REMOTE_DOWNLOAD_DIR = '$HOME/airtrail-build/downloads';
const REMOTE_TMP_DIR = '$HOME/airtrail-build/tmp';
const REMOTE_STATUS_FILE = '$HOME/airtrail-build/airport-overlay-build.status';
const REMOTE_LOG_FILE = '$HOME/airtrail-build/airport-overlay-build.log';
const REMOTE_PID_FILE = '$HOME/airtrail-build/airport-overlay-build.pid';
const REMOTE_OUTPUT_PATH = '/home/ubi/airport-overlay.pmtiles';
const VM_SIZES = [
  'standard-2',
  'standard-4',
  'standard-8',
  'standard-16',
  'standard-30',
  'standard-60',
  'burstable-1',
  'burstable-2',
] as const;
const STORAGE_SIZES = [
  '10',
  '20',
  '40',
  '80',
  '160',
  '320',
  '600',
  '640',
  '1200',
  '2400',
] as const;

type DatasetChoice = {
  id: string;
  label: string;
  urls: string[];
  recommendedSize: (typeof VM_SIZES)[number];
  recommendedStorage: (typeof STORAGE_SIZES)[number];
  description: string;
};

type VmInfo = {
  id: string;
  name: string;
  location: string;
  ref: string;
  ip4: string | null;
  state: string;
  size: string;
  storageSizeGib: string | null;
  unixUser: string;
};

type SshKeyPair = {
  privateKeyPath: string;
  publicKey: string;
  label: string;
};

type RemoteBuildStatus = {
  running: boolean;
  pid: string | null;
  stage: string | null;
  message: string | null;
  dataset: string | null;
  updatedAt: string | null;
  outputSize: number | null;
};

type RemoteBuildActivity = {
  subprocess: string | null;
  elapsedSeconds: number | null;
  cpuPercent: number | null;
  rssBytes: number | null;
  tempDirBytes: number | null;
  tempFiles: Map<string, number>;
};

const DATASETS: DatasetChoice[] = [
  {
    id: 'dk-se',
    label: 'Denmark + Sweden',
    urls: [
      'https://download.geofabrik.de/europe/denmark-latest.osm.pbf',
      'https://download.geofabrik.de/europe/sweden-latest.osm.pbf',
    ],
    recommendedSize: 'standard-8',
    recommendedStorage: '160',
    description: 'Fast validation build for the current regional test set.',
  },
  {
    id: 'nordics',
    label: 'Nordics',
    urls: [
      'https://download.geofabrik.de/europe/denmark-latest.osm.pbf',
      'https://download.geofabrik.de/europe/sweden-latest.osm.pbf',
      'https://download.geofabrik.de/europe/norway-latest.osm.pbf',
      'https://download.geofabrik.de/europe/finland-latest.osm.pbf',
      'https://download.geofabrik.de/europe/iceland-latest.osm.pbf',
    ],
    recommendedSize: 'standard-8',
    recommendedStorage: '160',
    description: 'Broader regional build while keeping runtime manageable.',
  },
  {
    id: 'planet',
    label: 'Full planet',
    urls: ['https://planet.openstreetmap.org/pbf/planet-latest.osm.pbf'],
    recommendedSize: 'standard-16',
    recommendedStorage: '320',
    description:
      'Full-world build with resumable download and detached execution.',
  },
];

const sleep = (ms: number) =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

const formatBytes = (value: number | null) => {
  if (!value || value < 1024) {
    return value === null ? '0 B' : `${value} B`;
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

const formatDuration = (seconds: number | null) => {
  if (seconds === null || !Number.isFinite(seconds)) {
    return null;
  }

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return remainingSeconds > 0
      ? `${minutes}m ${remainingSeconds}s`
      : `${minutes}m`;
  }

  return `${seconds}s`;
};

const shellQuote = (value: string) => `'${value.replaceAll("'", `'"'"'`)}'`;

const ensure = <T>(value: T | symbol, message = 'Operation cancelled.') => {
  if (isCancel(value)) {
    cancel(message);
    process.exit(1);
  }

  return value;
};

const runCapture = async (
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
) => {
  const { stdout } = await execFileAsync(command, args, {
    cwd: options.cwd,
    env: options.env,
    maxBuffer: 10 * 1024 * 1024,
  });

  return stdout.trimEnd();
};

const run = async (
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
) => {
  await execFileAsync(command, args, {
    cwd: options.cwd,
    env: options.env,
    maxBuffer: 10 * 1024 * 1024,
  });
};

const ensureLocalCommand = async (command: string, hint: string) => {
  try {
    await run('bash', [
      '-lc',
      `command -v ${shellQuote(command)} >/dev/null 2>&1`,
    ]);
  } catch {
    throw new Error(`${command} is required. ${hint}`);
  }
};

const parseKeyValueLines = (value: string) => {
  const entries = new Map<string, string>();
  for (const line of value.split('\n')) {
    const match = /^([a-z0-9-]+):\s*(.*)$/i.exec(line);
    if (!match) {
      continue;
    }

    entries.set(match[1], match[2]);
  }

  return entries;
};

const detectSshKeyPair = async (): Promise<SshKeyPair> => {
  const sshDir = join(homedir(), '.ssh');
  const preferredPrivateKeys = ['id_ed25519', 'Personal Hetzner', 'id_rsa'].map(
    (fileName) => join(sshDir, fileName),
  );

  const tryPrivateKey = async (privateKeyPath: string) => {
    if (!existsSync(privateKeyPath)) {
      return null;
    }

    try {
      const publicKey = await runCapture('ssh-keygen', [
        '-y',
        '-f',
        privateKeyPath,
      ]);
      if (!publicKey.trim()) {
        return null;
      }

      return {
        privateKeyPath,
        publicKey: publicKey.trim(),
        label: privateKeyPath,
      } satisfies SshKeyPair;
    } catch {
      return null;
    }
  };

  for (const privateKeyPath of preferredPrivateKeys) {
    const pair = await tryPrivateKey(privateKeyPath);
    if (pair) {
      return pair;
    }
  }

  if (existsSync(sshDir)) {
    const entries = readdirSync(sshDir)
      .filter((entry) => !entry.endsWith('.pub'))
      .filter(
        (entry) =>
          !['authorized_keys', 'config'].includes(entry) &&
          !entry.startsWith('known_hosts'),
      )
      .map((entry) => join(sshDir, entry));

    for (const privateKeyPath of entries) {
      const pair = await tryPrivateKey(privateKeyPath);
      if (pair) {
        return pair;
      }
    }
  }

  throw new Error(
    'No usable SSH keypair found. Create one in ~/.ssh or update the builder to use an explicit key.',
  );
};

const sshCliOptions = (knownHostsFile: string, privateKeyPath: string) => [
  '-o',
  'StrictHostKeyChecking=accept-new',
  '-o',
  `UserKnownHostsFile=${knownHostsFile}`,
  '-o',
  'IdentitiesOnly=yes',
  '-i',
  privateKeyPath,
];

const sshCapture = async (
  token: string,
  vm: VmInfo,
  knownHostsFile: string,
  privateKeyPath: string,
  remoteCommand: string,
) => {
  return runCapture(
    'ubi',
    [
      'vm',
      vm.ref,
      'ssh',
      ...sshCliOptions(knownHostsFile, privateKeyPath),
      '--',
      `bash -lc ${shellQuote(remoteCommand)}`,
    ],
    { env: { ...process.env, UBI_TOKEN: token } },
  );
};

const ssh = async (
  token: string,
  vm: VmInfo,
  knownHostsFile: string,
  privateKeyPath: string,
  remoteCommand: string,
) => {
  await run(
    'ubi',
    [
      'vm',
      vm.ref,
      'ssh',
      ...sshCliOptions(knownHostsFile, privateKeyPath),
      '--',
      `bash -lc ${shellQuote(remoteCommand)}`,
    ],
    { env: { ...process.env, UBI_TOKEN: token } },
  );
};

const scpToRemote = async (
  token: string,
  vm: VmInfo,
  knownHostsFile: string,
  privateKeyPath: string,
  localPath: string,
  remotePath: string,
) => {
  await run(
    'ubi',
    [
      'vm',
      vm.ref,
      'scp',
      ...sshCliOptions(knownHostsFile, privateKeyPath),
      localPath,
      `:${remotePath}`,
    ],
    { env: { ...process.env, UBI_TOKEN: token } },
  );
};

const scpFromRemote = async (
  token: string,
  vm: VmInfo,
  knownHostsFile: string,
  privateKeyPath: string,
  remotePath: string,
  localPath: string,
) => {
  await run(
    'ubi',
    [
      'vm',
      vm.ref,
      'scp',
      ...sshCliOptions(knownHostsFile, privateKeyPath),
      `:${remotePath}`,
      localPath,
    ],
    { env: { ...process.env, UBI_TOKEN: token } },
  );
};

const listVms = async (token: string): Promise<VmInfo[]> => {
  const output = await runCapture(
    'ubi',
    ['vm', 'list', '--no-headers', '--fields=location,name,id,ip4'],
    { env: { ...process.env, UBI_TOKEN: token } },
  );

  if (!output.trim()) {
    return [];
  }

  const rows = output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\s{2,}/));

  const vmDetails = await Promise.all(
    rows.map(async (parts) => {
      const [location, name, id, ip4 = ''] = parts;
      const ref = `${location}/${name}`;
      const showOutput = await runCapture('ubi', ['vm', ref, 'show'], {
        env: { ...process.env, UBI_TOKEN: token },
      });
      const values = parseKeyValueLines(showOutput);

      return {
        id,
        name,
        location,
        ref,
        ip4: ip4 || null,
        state: values.get('state') ?? 'unknown',
        size: values.get('size') ?? 'unknown',
        storageSizeGib: values.get('storage-size-gib') ?? null,
        unixUser: values.get('unix-user') ?? 'ubi',
      } satisfies VmInfo;
    }),
  );

  return vmDetails.sort((left, right) => left.name.localeCompare(right.name));
};

const chooseDataset = async (): Promise<DatasetChoice> => {
  const choice = ensure(
    await select({
      message: 'Choose the source dataset',
      options: [
        ...DATASETS.map((dataset) => ({
          value: dataset.id,
          label: dataset.label,
          hint: `${dataset.description} Recommended: ${dataset.recommendedSize}, ${dataset.recommendedStorage} GiB`,
        })),
        {
          value: 'custom',
          label: 'Custom URLs',
          hint: 'Paste one or more direct .osm.pbf URLs',
        },
      ],
    }),
  );

  if (choice !== 'custom') {
    return DATASETS.find((dataset) => dataset.id === choice)!;
  }

  const urlsInput = ensure(
    await text({
      message: 'Enter one or more direct .osm.pbf URLs',
      placeholder:
        'https://download.geofabrik.de/europe/denmark-latest.osm.pbf, ...',
      validate(value) {
        if (!value.trim()) {
          return 'At least one URL is required.';
        }
      },
    }),
  );

  const urls = urlsInput
    .split(/[\n,\s]+/)
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    id: 'custom',
    label: 'Custom URLs',
    urls,
    recommendedSize: 'standard-8',
    recommendedStorage: '160',
    description: `${urls.length} custom input URL${urls.length === 1 ? '' : 's'}`,
  };
};

const chooseVm = async (
  token: string,
  dataset: DatasetChoice,
): Promise<{ vm: VmInfo; created: boolean }> => {
  const vms = await listVms(token);

  const choice = ensure(
    await select({
      message: 'Choose a VM',
      options: [
        ...vms.map((vm) => ({
          value: vm.ref,
          label: vm.name,
          hint: `${vm.location} | ${vm.state} | ${vm.size} | ${vm.storageSizeGib ?? '?'} GiB${vm.ip4 ? ` | ${vm.ip4}` : ''}`,
        })),
        {
          value: '__create__',
          label: 'Create new VM',
          hint: `${DEFAULT_LOCATION} | recommended ${dataset.recommendedSize} / ${dataset.recommendedStorage} GiB`,
        },
      ],
    }),
  );

  if (choice !== '__create__') {
    return { vm: vms.find((vm) => vm.ref === choice)!, created: false };
  }

  const defaultName = `airtrail-airport-build-${new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, '')
    .slice(0, 14)}`;
  const vmName = ensure(
    await text({
      message: 'Name for the new VM',
      initialValue: defaultName,
      validate(value) {
        if (!value.trim()) {
          return 'VM name is required.';
        }
      },
    }),
  );
  const vmSize = ensure(
    await select({
      message: 'VM size',
      initialValue: dataset.recommendedSize,
      options: VM_SIZES.map((value) => ({
        value,
        label: value,
        hint: value === dataset.recommendedSize ? 'recommended' : undefined,
      })),
    }),
  ) as (typeof VM_SIZES)[number];
  const storageSize = ensure(
    await select({
      message: 'Storage size (GiB)',
      initialValue: dataset.recommendedStorage,
      options: STORAGE_SIZES.map((value) => ({
        value,
        label: `${value} GiB`,
        hint: value === dataset.recommendedStorage ? 'recommended' : undefined,
      })),
    }),
  ) as (typeof STORAGE_SIZES)[number];

  return {
    vm: {
      id: '',
      name: vmName.trim(),
      location: DEFAULT_LOCATION,
      ref: `${DEFAULT_LOCATION}/${vmName.trim()}`,
      ip4: null,
      state: 'creating',
      size: vmSize,
      storageSizeGib: storageSize,
      unixUser: 'ubi',
    },
    created: true,
  };
};

const createVm = async (token: string, vm: VmInfo, keyPair: SshKeyPair) => {
  await run(
    'ubi',
    [
      'vm',
      vm.ref,
      'create',
      `--size=${vm.size}`,
      `--storage-size=${vm.storageSizeGib ?? '160'}`,
      keyPair.publicKey,
    ],
    {
      env: { ...process.env, UBI_TOKEN: token },
    },
  );
};

const refreshVm = async (token: string, ref: string) => {
  const showOutput = await runCapture('ubi', ['vm', ref, 'show'], {
    env: { ...process.env, UBI_TOKEN: token },
  });
  const values = parseKeyValueLines(showOutput);
  return {
    id: values.get('id') ?? '',
    name: values.get('name') ?? ref.split('/')[1],
    location: values.get('location') ?? ref.split('/')[0],
    ref,
    ip4: values.get('ip4') ?? null,
    state: values.get('state') ?? 'unknown',
    size: values.get('size') ?? 'unknown',
    storageSizeGib: values.get('storage-size-gib') ?? null,
    unixUser: values.get('unix-user') ?? 'ubi',
  } satisfies VmInfo;
};

const ensureVmRunning = async (token: string, vm: VmInfo) => {
  if (vm.state === 'running') {
    return vm;
  }

  const shouldStart = ensure(
    await confirm({
      message: `VM ${vm.name} is ${vm.state}. Start it?`,
      initialValue: true,
    }),
  );
  if (!shouldStart) {
    throw new Error(`VM ${vm.name} must be running to continue.`);
  }

  await run('ubi', ['vm', vm.ref, 'start'], {
    env: { ...process.env, UBI_TOKEN: token },
  });

  return refreshVm(token, vm.ref);
};

const waitForSsh = async (
  token: string,
  vm: VmInfo,
  knownHostsFile: string,
  privateKeyPath: string,
) => {
  const s = spinner();
  s.start(`Waiting for SSH on ${vm.ref}`);

  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      await sshCapture(token, vm, knownHostsFile, privateKeyPath, 'true');
      s.stop(`SSH ready on ${vm.ref}`);
      return;
    } catch {
      await sleep(10_000);
    }
  }

  s.stop(`Timed out waiting for SSH on ${vm.ref}`);
  throw new Error(`Timed out waiting for SSH on ${vm.ref}.`);
};

const buildRemoteScript = (dataset: DatasetChoice) => {
  const urls = dataset.urls.map((url) => `  ${shellQuote(url)}`).join('\n');

  return `#!/usr/bin/env bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive
BUILD_ROOT="${REMOTE_BUILD_ROOT}"
REPO_DIR="${REMOTE_REPO_DIR}"
DOWNLOAD_DIR="${REMOTE_DOWNLOAD_DIR}"
TMP_DIR="${REMOTE_TMP_DIR}"
STATUS_FILE="${REMOTE_STATUS_FILE}"
LOG_FILE="${REMOTE_LOG_FILE}"
PID_FILE="${REMOTE_PID_FILE}"
OUTPUT_PATH="${REMOTE_OUTPUT_PATH}"
DATASET_LABEL=${shellQuote(dataset.label)}
URLS=(
${urls}
)
CURRENT_STAGE="setup"

log() {
  printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"
}

write_status() {
  {
    printf 'stage\t%s\n' "$1"
    printf 'message\t%s\n' "$2"
    printf 'dataset\t%s\n' "$DATASET_LABEL"
    printf 'updated_at\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  } > "$STATUS_FILE"
}

cleanup() {
  local exit_code=$?
  if [[ $exit_code -ne 0 ]]; then
    write_status "failed" "Build failed during $CURRENT_STAGE"
    log "Build failed during $CURRENT_STAGE"
  fi

  rm -f "$PID_FILE"
  exit $exit_code
}
trap cleanup EXIT

printf '%s\n' "$$" > "$PID_FILE"
mkdir -p "$BUILD_ROOT" "$DOWNLOAD_DIR"

install_base_packages() {
  if command -v curl >/dev/null 2>&1 && command -v git >/dev/null 2>&1 && command -v osmium >/dev/null 2>&1; then
    return
  fi

  write_status "setup" "Installing system packages"
  log "Installing system packages"
  sudo apt-get update
  sudo apt-get install -y curl git unzip ca-certificates build-essential pkg-config libsqlite3-dev zlib1g-dev osmium-tool
}

install_tippecanoe() {
  if command -v tippecanoe >/dev/null 2>&1; then
    return
  fi

  write_status "setup" "Building tippecanoe"
  log "Building tippecanoe from source"
  rm -rf /tmp/tippecanoe-src
  git clone --depth=1 https://github.com/felt/tippecanoe.git /tmp/tippecanoe-src
  make -C /tmp/tippecanoe-src -j"$(nproc)"
  sudo make -C /tmp/tippecanoe-src install
}

install_bun() {
  if command -v bun >/dev/null 2>&1; then
    return
  fi

  write_status "setup" "Installing Bun"
  log "Installing Bun"
  curl -fsSL https://bun.sh/install | bash
}

remote_size_bytes() {
  curl -fsSLI "$1" | tr -d '\r' | awk '/^[Cc]ontent-[Ll]ength:/ {print $2}' | tail -n1 || true
}

download_input() {
  local url="$1"
  local filename target remote_size local_size
  filename="$(basename -- "$(printf '%s\n' "$url" | cut -d'?' -f1)")"
  target="$DOWNLOAD_DIR/$filename"

  CURRENT_STAGE="download"
  write_status "download" "Checking $filename"
  remote_size="$(remote_size_bytes "$url")"
  local_size=""
  if [[ -f "$target" ]]; then
    local_size="$(wc -c < "$target" | tr -d ' ')"
  fi

  if [[ -n "$local_size" && -n "$remote_size" && "$local_size" == "$remote_size" ]]; then
    log "Using cached $filename ($(numfmt --to=iec "$local_size" 2>/dev/null || printf '%s bytes' "$local_size"))"
  elif [[ -n "$local_size" && "$local_size" != "0" ]]; then
    write_status "download" "Resuming $filename"
    log "Resuming $filename from byte $local_size"
    curl -L --fail -C - --output "$target" "$url"
  else
    write_status "download" "Downloading $filename"
    log "Downloading $filename"
    curl -L --fail --output "$target" "$url"
  fi

  INPUT_ARGS+=("--input=$target")
}

CURRENT_STAGE="setup"
write_status "setup" "Preparing remote build environment"
log "Preparing remote build environment"
install_base_packages
install_tippecanoe
install_bun

export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

rm -rf "$REPO_DIR" "$TMP_DIR"
mkdir -p "$REPO_DIR" "$TMP_DIR"
tar -xzf "${REMOTE_ARCHIVE_PATH}" -C "$REPO_DIR"
cd "$REPO_DIR"

CURRENT_STAGE="setup"
write_status "setup" "Installing Bun dependencies"
log "Running bun install --frozen-lockfile"
bun install --frozen-lockfile

INPUT_ARGS=()
for url in "\${URLS[@]}"; do
  download_input "$url"
done

CURRENT_STAGE="build"
write_status "build" "Generating airport overlay"
log "Starting overlay generation"
bun scripts/data/generate-airport-overlay.js --temp-dir="$TMP_DIR" --output="$OUTPUT_PATH" "\${INPUT_ARGS[@]}"

CURRENT_STAGE="done"
write_status "done" "Build completed"
log "Build completed: $OUTPUT_PATH"
`;
};

const bundleWorkspace = async (tempDir: string) => {
  const archivePath = join(tempDir, 'airtrail-build-src.tar.gz');
  await run('tar', [
    '--exclude=.git',
    '--exclude=node_modules',
    '--exclude=.svelte-kit',
    '--exclude=.cache/geofabrik',
    '--exclude=static/airport-overlay.pmtiles',
    '--exclude=scripts/data/ubicloud/node_modules',
    '--exclude=scripts/data/ubicloud/bun.lock',
    '-czf',
    archivePath,
    '.',
  ]);
  return archivePath;
};

const writeRemoteScript = (tempDir: string, dataset: DatasetChoice) => {
  const scriptPath = join(tempDir, 'airtrail-airport-overlay-build.sh');
  writeFileSync(scriptPath, buildRemoteScript(dataset));
  return scriptPath;
};

const getRemoteBuildStatus = async (
  token: string,
  vm: VmInfo,
  knownHostsFile: string,
  privateKeyPath: string,
): Promise<RemoteBuildStatus> => {
  const output = await sshCapture(
    token,
    vm,
    knownHostsFile,
    privateKeyPath,
    `pid=""; running=0
if [[ -f ${REMOTE_PID_FILE} ]]; then pid="$(cat ${REMOTE_PID_FILE})"; fi
if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then running=1; fi
printf 'running\t%s\n' "$running"
printf 'pid\t%s\n' "$pid"
if [[ -f ${REMOTE_OUTPUT_PATH} ]]; then printf 'output_size\t%s\n' "$(wc -c < ${REMOTE_OUTPUT_PATH} | tr -d ' ')"; fi
if [[ -f ${REMOTE_STATUS_FILE} ]]; then cat ${REMOTE_STATUS_FILE}; fi`,
  );

  const values = new Map<string, string>();
  for (const line of output.split('\n').filter(Boolean)) {
    const [key, ...rest] = line.split('\t');
    values.set(key, rest.join('\t'));
  }

  return {
    running: values.get('running') === '1',
    pid: values.get('pid') || null,
    stage: values.get('stage') || null,
    message: values.get('message') || null,
    dataset: values.get('dataset') || null,
    updatedAt: values.get('updated_at') || null,
    outputSize: values.get('output_size')
      ? Number(values.get('output_size'))
      : null,
  };
};

const getRemoteDownloadSizes = async (
  token: string,
  vm: VmInfo,
  knownHostsFile: string,
  privateKeyPath: string,
  fileNames: string[],
) => {
  if (!fileNames.length) {
    return new Map<string, number>();
  }

  const remoteLoop = fileNames
    .map((fileName) => {
      const remotePath = `${REMOTE_DOWNLOAD_DIR}/${fileName}`;
      return `if [[ -f ${remotePath} ]]; then printf ${shellQuote(`${fileName}\t%s\n`)} "$(wc -c < ${remotePath} | tr -d ' ')"; fi`;
    })
    .join('\n');

  const output = await sshCapture(
    token,
    vm,
    knownHostsFile,
    privateKeyPath,
    remoteLoop,
  );

  const sizes = new Map<string, number>();
  for (const line of output.split('\n').filter(Boolean)) {
    const [fileName, size] = line.split('\t');
    sizes.set(fileName, Number(size));
  }
  return sizes;
};

const getRemoteLogTail = async (
  token: string,
  vm: VmInfo,
  knownHostsFile: string,
  privateKeyPath: string,
) => {
  return sshCapture(
    token,
    vm,
    knownHostsFile,
    privateKeyPath,
    `tail -n 8 ${REMOTE_LOG_FILE} 2>/dev/null || true`,
  );
};

const getRemoteBuildActivity = async (
  token: string,
  vm: VmInfo,
  knownHostsFile: string,
  privateKeyPath: string,
): Promise<RemoteBuildActivity> => {
  const output = await sshCapture(
    token,
    vm,
    knownHostsFile,
    privateKeyPath,
    `export AIRTRAIL_TMP_DIR=${shellQuote(REMOTE_TMP_DIR)}
ps -eo etimes,pcpu,rss,args | awk '
/osmium tags-filter/ && index($0, ENVIRON["AIRTRAIL_TMP_DIR"]) { print "proc\tosmium tags-filter\t" $1 "\t" $2 "\t" $3; found=1; exit }
/osmium export/ && index($0, ENVIRON["AIRTRAIL_TMP_DIR"]) { print "proc\tosmium export\t" $1 "\t" $2 "\t" $3; found=1; exit }
/tippecanoe/ && index($0, ENVIRON["AIRTRAIL_TMP_DIR"]) { print "proc\ttippecanoe\t" $1 "\t" $2 "\t" $3; found=1; exit }
/bun scripts\/data\/generate-airport-overlay\.js/ && index($0, ENVIRON["AIRTRAIL_TMP_DIR"]) { print "proc\tnormalize\t" $1 "\t" $2 "\t" $3; found=1; exit }
END { if (!found) print "proc\t\t\t\t" }
'
if [[ -d ${REMOTE_TMP_DIR} ]]; then
  printf 'tmpdir\t%s\n' "$(du -sk ${REMOTE_TMP_DIR} | awk '{print $1 * 1024}')"
fi
for file in ${REMOTE_TMP_DIR}/*.filtered.osm.pbf ${REMOTE_TMP_DIR}/*.geojsonseq ${REMOTE_TMP_DIR}/*.ndjson; do
  if [[ -f "$file" ]]; then
    printf 'tmp\t%s\t%s\n' "$(basename "$file")" "$(wc -c < "$file" | tr -d ' ')"
  fi
done`,
  );

  let subprocess: string | null = null;
  let elapsedSeconds: number | null = null;
  let cpuPercent: number | null = null;
  let rssBytes: number | null = null;
  let tempDirBytes: number | null = null;
  const tempFiles = new Map<string, number>();

  for (const line of output.split('\n').filter(Boolean)) {
    const [kind, first, second, third, fourth] = line.split('\t');
    if (kind === 'proc') {
      subprocess = first || null;
      elapsedSeconds = second ? Number(second) : null;
      cpuPercent = third ? Number(third) : null;
      rssBytes = fourth ? Number(fourth) * 1024 : null;
      continue;
    }

    if (kind === 'tmpdir') {
      tempDirBytes = first ? Number(first) : null;
      continue;
    }

    if (kind === 'tmp' && first && second) {
      tempFiles.set(first, Number(second));
    }
  }

  return {
    subprocess,
    elapsedSeconds,
    cpuPercent,
    rssBytes,
    tempDirBytes,
    tempFiles,
  };
};

const formatTempFileProgress = (
  currentFiles: Map<string, number>,
  previousFiles: Map<string, number>,
) => {
  const interestingFiles = [...currentFiles.entries()]
    .filter(
      ([fileName]) =>
        fileName.endsWith('.filtered.osm.pbf') ||
        fileName.endsWith('.geojsonseq'),
    )
    .sort(([left], [right]) => left.localeCompare(right));

  return interestingFiles
    .map(([fileName, size]) => {
      const previousSize = previousFiles.get(fileName) ?? 0;
      const delta = size - previousSize;
      const deltaLabel = delta > 0 ? ` (+${formatBytes(delta)})` : '';
      return `${fileName}: ${formatBytes(size)}${deltaLabel}`;
    })
    .join(' | ');
};

const stopRemoteBuild = async (
  token: string,
  vm: VmInfo,
  knownHostsFile: string,
  privateKeyPath: string,
) => {
  await ssh(
    token,
    vm,
    knownHostsFile,
    privateKeyPath,
    `if [[ -f ${REMOTE_PID_FILE} ]]; then kill "$(cat ${REMOTE_PID_FILE})" 2>/dev/null || true; fi`,
  );
};

const startRemoteBuild = async (
  token: string,
  vm: VmInfo,
  knownHostsFile: string,
  privateKeyPath: string,
  archivePath: string,
  remoteScriptPath: string,
) => {
  await scpToRemote(
    token,
    vm,
    knownHostsFile,
    privateKeyPath,
    archivePath,
    REMOTE_ARCHIVE_PATH,
  );
  await scpToRemote(
    token,
    vm,
    knownHostsFile,
    privateKeyPath,
    remoteScriptPath,
    REMOTE_SCRIPT_PATH,
  );

  return sshCapture(
    token,
    vm,
    knownHostsFile,
    privateKeyPath,
    `mkdir -p ${REMOTE_BUILD_ROOT}
if [[ -f ${REMOTE_PID_FILE} ]] && kill -0 "$(cat ${REMOTE_PID_FILE})" 2>/dev/null; then
  echo "already-running"
  exit 10
fi
: > ${REMOTE_LOG_FILE}
nohup bash ${REMOTE_SCRIPT_PATH} >> ${REMOTE_LOG_FILE} 2>&1 < /dev/null &
pid=$!
printf '%s\n' "$pid" > ${REMOTE_PID_FILE}
printf '%s\n' "$pid"`,
  );
};

const watchRemoteBuild = async (
  token: string,
  vm: VmInfo,
  knownHostsFile: string,
  privateKeyPath: string,
  dataset: DatasetChoice,
) => {
  const s = spinner();
  const trackedFiles = dataset.urls.map((url) => basename(url.split('?')[0]));
  let previousTempFiles = new Map<string, number>();
  let interrupted = false;
  const onSigint = () => {
    interrupted = true;
  };

  process.on('SIGINT', onSigint);
  s.start(`Watching remote build on ${vm.name}`);

  try {
    let lastMessage = '';
    while (true) {
      if (interrupted) {
        s.stop('Stopped watching. Remote build continues on the VM.');
        log.info(`Re-run the builder and pick ${vm.name} to reattach.`);
        return 'detached' as const;
      }

      const status = await getRemoteBuildStatus(
        token,
        vm,
        knownHostsFile,
        privateKeyPath,
      );
      const downloadSizes = await getRemoteDownloadSizes(
        token,
        vm,
        knownHostsFile,
        privateKeyPath,
        trackedFiles,
      );
      const activity = await getRemoteBuildActivity(
        token,
        vm,
        knownHostsFile,
        privateKeyPath,
      );

      const fileProgress = trackedFiles
        .map((fileName) => {
          const size = downloadSizes.get(fileName);
          return size ? `${fileName}: ${formatBytes(size)}` : null;
        })
        .filter(Boolean)
        .join(' | ');
      const subprocessLabel = activity.subprocess
        ? `${activity.subprocess}${activity.elapsedSeconds !== null ? ` (${formatDuration(activity.elapsedSeconds)})` : ''}${activity.cpuPercent !== null ? ` | CPU ${Math.round(activity.cpuPercent)}%` : ''}${activity.rssBytes !== null ? ` | RSS ${formatBytes(activity.rssBytes)}` : ''}`
        : null;
      const tempProgress = formatTempFileProgress(
        activity.tempFiles,
        previousTempFiles,
      );
      const tempDirProgress = activity.tempDirBytes
        ? `tmp dir: ${formatBytes(activity.tempDirBytes)}`
        : null;
      previousTempFiles = activity.tempFiles;

      const message = [
        status.stage,
        status.message,
        subprocessLabel,
        tempDirProgress,
        tempProgress,
        fileProgress,
      ]
        .filter(Boolean)
        .join(' | ');

      if (message && message !== lastMessage) {
        s.message(message);
        lastMessage = message;
      }

      if (!status.running) {
        if (status.stage === 'done' || status.outputSize) {
          s.stop(`Remote build finished on ${vm.name}`);
          return 'completed' as const;
        }

        if (status.stage === 'failed') {
          s.stop(`Remote build failed on ${vm.name}`);
          const tail = await getRemoteLogTail(
            token,
            vm,
            knownHostsFile,
            privateKeyPath,
          );
          throw new Error(tail || status.message || 'Remote build failed.');
        }

        s.stop(`Remote build stopped on ${vm.name}`);
        return 'stopped' as const;
      }

      await sleep(5_000);
    }
  } finally {
    process.off('SIGINT', onSigint);
  }
};

const downloadArtifact = async (
  token: string,
  vm: VmInfo,
  knownHostsFile: string,
  privateKeyPath: string,
  outputPath: string,
  tempDir: string,
) => {
  const s = spinner();
  s.start(`Downloading ${REMOTE_OUTPUT_PATH} from ${vm.name}`);
  const tempOutputPath = join(tempDir, 'airport-overlay.pmtiles');
  await scpFromRemote(
    token,
    vm,
    knownHostsFile,
    privateKeyPath,
    REMOTE_OUTPUT_PATH,
    tempOutputPath,
  );

  writeFileSync(outputPath, readFileSync(tempOutputPath));
  s.stop(`Saved overlay to ${outputPath}`);
};

const main = async () => {
  const token = process.argv[2]?.trim();
  if (!token) {
    console.error(
      'Usage: bun scripts/data/ubicloud/build-airport-overlay-on-ubicloud.ts <UBI_TOKEN>',
    );
    process.exit(1);
  }

  await ensureLocalCommand(
    'ubi',
    'Install it with: brew install ubicloud/cli/ubi',
  );
  await ensureLocalCommand(
    'tar',
    'Install GNU tar or ensure tar is available on PATH.',
  );
  await ensureLocalCommand(
    'ssh-keygen',
    'Install OpenSSH so the script can detect your SSH keypair.',
  );

  intro('AirTrail airport overlay builder');

  const keyPair = await detectSshKeyPair();
  const dataset = await chooseDataset();
  const vmChoice = await chooseVm(token, dataset);
  let vm = vmChoice.vm;

  note(
    [
      `Dataset: ${dataset.label}`,
      `SSH key: ${keyPair.label}`,
      `Output: ${DEFAULT_OUTPUT_PATH}`,
    ].join('\n'),
    'Build plan',
  );

  const knownHostsDir = mkdtempSync(
    join(tmpdir(), 'airtrail-ubicloud-known-hosts-'),
  );
  const knownHostsFile = join(knownHostsDir, 'known_hosts');
  writeFileSync(knownHostsFile, '');

  const tempDir = mkdtempSync(join(tmpdir(), 'airtrail-ubicloud-'));
  let shouldDestroyVm = false;

  try {
    if (vmChoice.created) {
      const s = spinner();
      s.start(`Creating VM ${vm.ref}`);
      await createVm(token, vm, keyPair);
      s.stop(`Created VM ${vm.ref}`);
      vm = await refreshVm(token, vm.ref);
      shouldDestroyVm = ensure(
        await confirm({
          message: 'Destroy the VM automatically after a successful download?',
          initialValue: false,
        }),
      );
    }

    vm = await ensureVmRunning(token, vm);
    await waitForSsh(token, vm, knownHostsFile, keyPair.privateKeyPath);

    const existingStatus = await getRemoteBuildStatus(
      token,
      vm,
      knownHostsFile,
      keyPair.privateKeyPath,
    );

    if (existingStatus.running) {
      const action = ensure(
        await select({
          message: `A remote build is already running on ${vm.name}`,
          options: [
            {
              value: 'attach',
              label: 'Attach to current build',
              hint:
                existingStatus.message ?? existingStatus.dataset ?? undefined,
            },
            {
              value: 'restart',
              label: 'Stop current build and start a new one',
            },
            { value: 'cancel', label: 'Cancel' },
          ],
        }),
      );

      if (action === 'cancel') {
        cancel('No changes made.');
        process.exit(0);
      }

      if (action === 'attach') {
        const result = await watchRemoteBuild(
          token,
          vm,
          knownHostsFile,
          keyPair.privateKeyPath,
          dataset,
        );

        if (result === 'completed') {
          await downloadArtifact(
            token,
            vm,
            knownHostsFile,
            keyPair.privateKeyPath,
            DEFAULT_OUTPUT_PATH,
            tempDir,
          );
        }

        outro(`Finished with VM ${vm.ref}`);
        return;
      }

      await stopRemoteBuild(token, vm, knownHostsFile, keyPair.privateKeyPath);
      await sleep(2_000);
    }

    const bundleSpinner = spinner();
    bundleSpinner.start('Packing local workspace');
    const archivePath = await bundleWorkspace(tempDir);
    const remoteScriptPath = writeRemoteScript(tempDir, dataset);
    bundleSpinner.stop('Packed local workspace');

    const uploadSpinner = spinner();
    uploadSpinner.start(`Uploading workspace to ${vm.name}`);
    await startRemoteBuild(
      token,
      vm,
      knownHostsFile,
      keyPair.privateKeyPath,
      archivePath,
      remoteScriptPath,
    );
    uploadSpinner.stop(`Started detached remote build on ${vm.name}`);

    const result = await watchRemoteBuild(
      token,
      vm,
      knownHostsFile,
      keyPair.privateKeyPath,
      dataset,
    );

    if (result === 'completed') {
      await downloadArtifact(
        token,
        vm,
        knownHostsFile,
        keyPair.privateKeyPath,
        DEFAULT_OUTPUT_PATH,
        tempDir,
      );
    }

    if (shouldDestroyVm) {
      const destroy = spinner();
      destroy.start(`Destroying ${vm.ref}`);
      await run('bash', [
        '-lc',
        `printf '%s\n' ${shellQuote(vm.name)} | UBI_TOKEN=${shellQuote(token)} ubi vm ${shellQuote(vm.ref)} destroy >/dev/null`,
      ]);
      destroy.stop(`Destroyed ${vm.ref}`);
    } else {
      log.info(`VM kept alive: ${vm.ref}`);
    }

    outro(`Overlay builder finished for ${dataset.label}`);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
    rmSync(knownHostsDir, { recursive: true, force: true });
  }
};

main().catch((error) => {
  cancel(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
