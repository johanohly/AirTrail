import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

import { chromium } from '@playwright/test';

import {
  ACCOUNTS,
  DEMO_PASSWORD,
  type DemoAccount,
} from '../../../src/lib/server/demo/accounts';
import { authStatePath } from './constants';

/*
 * Logs every demo account in once and saves its session. Shots reuse these
 * instead of logging in themselves, which would trip the login rate limit.
 */
export default async function globalSetup() {
  const baseURL = process.env.SCREENSHOTS_BASE_URL;
  if (!baseURL) throw new Error('SCREENSHOTS_BASE_URL is not set');

  await mkdir(dirname(authStatePath('x')), { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const account of Object.keys(ACCOUNTS) as DemoAccount[]) {
      const context = await browser.newContext({ baseURL });
      const page = await context.newPage();
      await page.goto('/login');
      await page.fill('input[name="username"]', ACCOUNTS[account].username);
      await page.fill('input[name="password"]', DEMO_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForURL((url) => url.pathname === '/', {
        waitUntil: 'commit',
      });
      await context.storageState({ path: authStatePath(account) });
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
