import type { Page } from '@playwright/test';
import type { User } from '@test/factories/users';

export const login = async (page: Page, user: User) => {
  await page.goto('/login');
  await page.fill('input[name="username"]', user.username);
  await page.fill('input[name="password"]', user.password);
  await page.click('button[type="submit"]');

  await page.waitForURL('/');
};
