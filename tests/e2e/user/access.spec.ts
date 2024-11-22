import { expect, test } from '@playwright/test';

import { signin } from '../fixtures/authentication';
import { isPathname } from '../fixtures/url';

test('no unauthorized access', async ({ page }) => {
  await page.goto('/');
  await page.waitForURL(isPathname('/login'));
});

test('can sign in', async ({ page }) => {
  await signin(page);

  await page.locator('id=settings-button').click();
  const userName = await page.getByText('Test User').textContent();
  expect(userName).toBe('Test User');
});
