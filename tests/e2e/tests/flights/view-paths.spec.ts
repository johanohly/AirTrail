import { airportsFactory } from '@test/factories/airports';
import { flightsFactory } from '@test/factories/flights';
import { usersFactory } from '@test/factories/users';
import { JFK, LHR } from '@test/fixtures/airports';
import { login } from '@test/helpers/auth';
import { expect, test } from '@test/index';

test.describe('View paths', () => {
  test.beforeEach(async ({ page }) => {
    const { user } = await usersFactory.create();
    const { airport: from } = await airportsFactory.getOrCreate(JFK);
    const { airport: to } = await airportsFactory.getOrCreate(LHR);
    await flightsFactory.create({
      userId: user.id,
      date: '2024-01-15',
      fromId: from.id,
      toId: to.id,
    });
    await login(page, user);
  });

  test('opens the flight list from /flights', async ({ page }) => {
    await page.goto('/flights');
    await expect(page.getByText('All Flights')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByText('All Flights')).toBeHidden();
    await expect(page).toHaveURL('/');
    await expect(page.getByTestId('list-flights-button')).toBeVisible();
  });

  test('reopens the list with the forward button after closing it', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByTestId('list-flights-button').click();
    await expect(page).toHaveURL('/flights');

    await page.keyboard.press('Escape');
    await expect(page).toHaveURL('/');
    await expect(page.getByText('All Flights')).toBeHidden();
    await expect(page.getByTestId('list-flights-button')).toBeVisible();

    await page.goForward();
    await expect(page).toHaveURL('/flights');
    await expect(page.getByText('All Flights')).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL('/');
    await expect(page.getByText('All Flights')).toBeHidden();
    await expect(page.getByTestId('list-flights-button')).toBeVisible();
  });

  test('updates the dock after following a link from the map', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'More' }).click();
    await page.getByRole('link', { name: 'Visited countries' }).click();
    await expect(page).toHaveURL('/visited-countries');

    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(nav.locator('a[href="/"]')).toBeVisible();
    await expect(page.getByTestId('list-flights-button')).toBeHidden();
  });
});
