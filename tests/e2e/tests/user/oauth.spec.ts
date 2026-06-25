import { usersFactory } from '@test/factories/users';
import { isPathname } from '@test/fixtures/url';
import { db, expect, test } from '@test/index';

const fakeOidcProfileUrl = 'http://127.0.0.1:3001/__test/profile';

test.describe('OAuth', () => {
  test('requires local password verification before linking an existing account', async ({
    page,
  }) => {
    const { user } = await usersFactory.create({ password: 'testPassword123' });
    const oauthSub = `oauth-sub-${user.id}`;

    await fetch(fakeOidcProfileUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sub: oauthSub,
        preferred_username: user.username,
        name: user.displayName,
      }),
    });

    await page.goto('/login');
    await page.getByRole('button', { name: 'Log in with SSO' }).click();

    await expect(
      page.getByText(
        'Log in with your AirTrail password to link this OAuth account.',
      ),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Log in with SSO' }),
    ).toBeHidden();
    await expect(page.locator('input[name="username"]')).toHaveValue(
      user.username,
    );

    let dbUser = await db
      .selectFrom('user')
      .select(['oauthId'])
      .where('id', '=', user.id)
      .executeTakeFirstOrThrow();
    expect(dbUser.oauthId).toBeNull();

    await page.fill('input[name="password"]', user.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(isPathname('/'));

    dbUser = await db
      .selectFrom('user')
      .select(['oauthId'])
      .where('id', '=', user.id)
      .executeTakeFirstOrThrow();
    expect(dbUser.oauthId).toBe(oauthSub);
  });
});
