import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  testDir: './tests/e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  reporter: process.env.CI ? 'github' : 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },

  timeout: 30_000,

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

    // {
    //   name: 'firefox',
    //   testIgnore: /setup\/.+\.spec\.ts/,
    //   use: { ...devices['Desktop Firefox'] },
    //   dependencies: ['setup'],
    // },

    // {
    //   name: 'webkit',
    //   testIgnore: /setup\/.+\.spec\.ts/,
    //   use: { ...devices['Desktop Safari'] },
    //   dependencies: ['setup'],
    // },
  ],
});
