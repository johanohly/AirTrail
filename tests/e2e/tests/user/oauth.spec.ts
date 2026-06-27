import { usersFactory } from '@test/factories/users';
import { isPathname } from '@test/fixtures/url';
import { db, expect, test } from '@test/index';

const fakeOidcProfileUrl = 'http://127.0.0.1:3001/__test/profile';

test.describe('OAuth', () => {
  const setFakeOidcProfile = async (profile: {
    sub: string;
    preferred_username: string;
    name?: string;
  }) => {
    await fetch(fakeOidcProfileUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(profile),
    });
  };

  test('requires local password verification before linking an existing account', async ({
    page,
  }) => {
    const { user } = await usersFactory.create({ password: 'testPassword123' });
    const oauthSub = `oauth-sub-${user.id}`;

    await setFakeOidcProfile({
      sub: oauthSub,
      preferred_username: user.username,
      name: user.displayName,
    });

    await page.goto('/login');
    const authorizeRequestPromise = page.waitForRequest((request) =>
      request.url().startsWith('http://127.0.0.1:3001/auth?'),
    );
    await page.getByRole('button', { name: 'Log in with SSO' }).click();
    const authorizeUrl = new URL((await authorizeRequestPromise).url());
    expect(authorizeUrl.searchParams.get('code_challenge')).toBeTruthy();
    expect(authorizeUrl.searchParams.get('code_challenge_method')).toBe('S256');
    if (process.env.OAUTH_PROMPT) {
      expect(authorizeUrl.searchParams.get('prompt')).toBe(
        process.env.OAUTH_PROMPT,
      );
    }

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

  test('rejects an OAuth callback when the state does not match', async ({
    page,
  }) => {
    const username = `oauth_state_mismatch_${Date.now()}`;
    await setFakeOidcProfile({
      sub: `oauth-sub-${username}`,
      preferred_username: username,
      name: 'OAuth State Mismatch',
    });

    await page.route('**/api/oauth/callback', async (route) => {
      const body = JSON.parse(route.request().postData() ?? '{}') as {
        url: string;
      };
      const callbackUrl = new URL(body.url);
      callbackUrl.searchParams.set('state', 'tampered-state');

      await route.continue({
        headers: {
          ...route.request().headers(),
          'content-type': 'application/json',
        },
        postData: JSON.stringify({ url: callbackUrl.toString() }),
      });
    });

    await page.goto('/login');
    const callbackResponsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/oauth/callback') &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Log in with SSO' }).click();
    const callbackResponse = await callbackResponsePromise;

    expect(callbackResponse.status()).toBe(400);
    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();

    const dbUser = await db
      .selectFrom('user')
      .select(['id'])
      .where('username', '=', username)
      .executeTakeFirst();
    expect(dbUser).toBeUndefined();
  });
});
