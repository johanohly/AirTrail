import { usersFactory } from '@test/factories/users';
import { isPathname } from '@test/fixtures/url';
import { db, test } from '@test/index';
import { generateId } from 'lucia';

test('can complete set up', async ({ page }) => {
  await db.deleteFrom('user').execute();

  const testUser = {
    username: `setup_user_${generateId(8)}`,
    password: 'testPassword123',
    displayName: 'Setup Test User',
  };

  await page.goto('/');
  await page.waitForURL(/\/setup/);

  await page.fill('input[name="username"]', testUser.username);
  await page.fill('input[name="password"]', testUser.password);
  await page.fill('input[name="displayName"]', testUser.displayName);
  await page.click('button[type="submit"]');

  await page.waitForURL(isPathname('/'));

  await db
    .deleteFrom('user')
    .where('username', '=', testUser.username)
    .execute();
});

test('cannot complete set up if user already exists', async ({ page }) => {
  await usersFactory.create();

  await page.goto('/setup');
  await page.waitForURL(isPathname('/login'));
});
