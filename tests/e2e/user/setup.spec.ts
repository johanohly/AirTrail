import { SEED_USER } from '../../../prisma/seed/user';
import { test } from '../fixtures/db';

test('can complete set up', async ({ page, db }) => {
  await db.deleteFrom('user').execute();

  await page.goto('/');
  await page.waitForURL(/\/setup/);

  await page.fill('input[name="username"]', SEED_USER.username);
  await page.fill('input[name="password"]', SEED_USER.password);
  await page.fill('input[name="displayName"]', SEED_USER.displayName);
  await page.click('button[type="submit"]');

  await page.waitForURL((url) => url.pathname === '/');
});
