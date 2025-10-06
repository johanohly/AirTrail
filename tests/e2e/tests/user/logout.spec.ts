import { usersFactory } from '@test/factories/users';
import { login } from '@test/helpers/auth';
import { expect, test } from '@test/index';

test.describe('Logout', () => {
  test('logs out user and redirects to login', async ({ page }) => {
    const { user } = await usersFactory.create();

    await login(page, user);

    await expect(page).toHaveURL('/');

    await page.locator('id=settings-button').click();
    await page.getByRole('button', { name: 'Log out' }).click();

    await page.waitForURL(/\/login(\?|$)/u);

    await page.goto('/');
    await page.waitForURL(/\/login(\?|$)/u);
  });
});
