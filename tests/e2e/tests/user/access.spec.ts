import { usersFactory } from '@test/factories/users';
import { isPathname } from '@test/fixtures/url';
import { login } from '@test/helpers/auth';
import { expect, test } from '@test/index';

test.describe('Authentication', () => {
  test('no unauthorized access', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL(isPathname('/login'));
  });

  test('can sign in', async ({ page }) => {
    const { user } = await usersFactory.create();

    await login(page, user);

    await page.locator('id=settings-button').click();
    const userName = await page.getByText(user.displayName).textContent();
    expect(userName).toBe(user.displayName);
  });

  test('authenticated user can access home', async ({ page }) => {
    const { user } = await usersFactory.create();

    await login(page, user);
    await page.goto('/');

    await page.waitForURL(isPathname('/'));

    await page.locator('id=settings-button').click();
    const userName = await page.getByText(user.displayName).textContent();
    expect(userName).toBe(user.displayName);
  });
});
