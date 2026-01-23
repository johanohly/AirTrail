import { usersFactory } from '@test/factories/users';
import { login } from '@test/helpers/auth';
import { expect, test } from '@test/index';

test.describe('Onboarding', () => {
  test('opens import flow from onboarding', async ({ page }) => {
    const { user } = await usersFactory.create();
    await login(page, user);

    await page.goto('/?onboarding');

    const onboardingHeading = page.getByRole('heading', {
      level: 2,
      name: /bring your flights into airtrail/i,
    });
    await expect(onboardingHeading).toBeVisible();

    await page.getByRole('button', { name: /start import/i }).click();

    await expect(onboardingHeading).not.toBeVisible();
    await expect(
      page.getByRole('heading', { level: 3, name: /import/i }),
    ).toBeVisible();
  });

  test('opens add flight modal from onboarding', async ({ page }) => {
    const { user } = await usersFactory.create();
    await login(page, user);

    await page.goto('/?onboarding');

    await expect(
      page.getByRole('heading', {
        level: 2,
        name: /bring your flights into airtrail/i,
      }),
    ).toBeVisible();

    await page.getByRole('button', { name: /add flight/i }).click();

    await expect(
      page.getByRole('heading', { level: 3, name: /new flight/i }),
    ).toBeVisible();
  });
});
