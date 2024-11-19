import type { Page } from '@playwright/test';

export const signin = async (
  page: Page,
  username = 'test',
  password = 'password',
) => {
  await page.goto('/login');
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');

  await page.waitForURL('/');
};
