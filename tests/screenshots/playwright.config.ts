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
  /*
   * Shots in `*.mutating.shot.ts` change demo data and undo it afterwards.
   * They run after every other shot, so no other capture sees the change.
   */
  projects: [
    {
      name: 'light',
      testIgnore: '*.mutating.shot.ts',
      use: { colorScheme: 'light' },
    },
    {
      name: 'dark',
      testIgnore: '*.mutating.shot.ts',
      use: { colorScheme: 'dark' },
    },
    {
      // Captures both themes itself, so one test holds the change at a time.
      name: 'mutating',
      testMatch: '*.mutating.shot.ts',
      dependencies: ['light', 'dark'],
    },
  ],
});
