import { defineConfig } from '@playwright/test';

import { DEMO_TIMEZONE } from './support/constants';

/*
 * Captures documentation screenshots. Run through `bun run screenshots`, which
 * starts an isolated database and app and sets SCREENSHOTS_BASE_URL; see
 * tests/screenshots/run.ts. Each shot runs once per colour scheme.
 */
export default defineConfig({
  testDir: './shots',
  testMatch: '*.shot.ts',
  globalSetup: './support/global-setup.ts',
  outputDir: './.output/playwright',
  fullyParallel: true,
  workers: 2,
  retries: 0,
  timeout: 90_000,
  reporter: [['list']],
  use: {
    baseURL: process.env.SCREENSHOTS_BASE_URL,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    locale: 'en-US',
    timezoneId: DEMO_TIMEZONE,
  },
  projects: [
    { name: 'light', use: { colorScheme: 'light' } },
    { name: 'dark', use: { colorScheme: 'dark' } },
  ],
});
