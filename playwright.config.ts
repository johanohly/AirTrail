import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  testDir: './tests/e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? '100%' : undefined,
  reporter: process.env.CI ? [['list'], ['github'], ['html']] : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'en-US',
    timezoneId: 'UTC',
  },

  expect: { timeout: 30000, toPass: { timeout: 30000 } },
  timeout: process.env.CI ? 30000 : 120000,

  projects: [
    {
      name: 'setup',
      testMatch: /setup\/.+\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
      fullyParallel: false,
    },
    {
      name: 'chromium',
      testIgnore: /setup\/.+\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],
});
