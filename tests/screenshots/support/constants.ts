import { join } from 'node:path';

export const DEMO_TIMEZONE = 'Europe/Copenhagen';

const OUTPUT_DIR = join(import.meta.dirname, '..', '.output');

/** Raw captures, before encoding and diffing. */
export const RAW_DIR = join(OUTPUT_DIR, 'raw');

/** Saved session for a demo account, written by the global setup. */
export const authStatePath = (account: string) =>
  join(OUTPUT_DIR, 'auth', `${account}.json`);
