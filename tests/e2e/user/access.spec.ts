import { expect, test } from '@playwright/test';

import { signin } from '../fixtures/authentication';

test('no unauthorized access', async ({ page }) => {
  await page.goto('/');
  const url = new URL(page.url());
  expect(url.pathname).toBe('/login');
});

test('can sign in', async ({ page }) => {
  await signin(page);

  await page.locator('id=settings-button').click();
  const userName = await page.getByText('Test User').textContent();
  expect(userName).toBe('Test User');
});
