import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  testDir: './tests/e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? '100%' : undefined,
  reporter: process.env.CI
    ? [['list'], ['github'], ['html']]
    : [['list'], ['html']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'en-US',
    timezoneId: 'UTC',
  },

  expect: { timeout: 30000, toPass: { timeout: 30000 } },
  timeout: 30000,

  webServer: {
    command: 'bun tests/e2e/oauth/fake-oidc-server.ts',
    url: 'http://127.0.0.1:3001/.well-known/openid-configuration',
    reuseExistingServer: true,
    stdout: 'pipe',
    stderr: 'pipe',
  },

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
