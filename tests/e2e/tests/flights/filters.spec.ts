import type { Page } from '@playwright/test';
import { airportsFactory } from '@test/factories/airports';
import { flightsFactory } from '@test/factories/flights';
import { usersFactory } from '@test/factories/users';
import { CDG, JFK, LHR } from '@test/fixtures/airports';
import { login } from '@test/helpers/auth';
import { expect, test } from '@test/index';

const daysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
};

/*
 * Three flights: BA100 to London for business, AF200 to Paris last week to
 * visit family, AF300 to New York with no reason.
 */
const seedFlights = async (page: Page) => {
  const { user } = await usersFactory.create();
  const { airport: jfk } = await airportsFactory.getOrCreate(JFK);
  const { airport: lhr } = await airportsFactory.getOrCreate(LHR);
  const { airport: cdg } = await airportsFactory.getOrCreate(CDG);
  const flights = [
    { flightNumber: 'BA100', fromId: jfk.id, toId: lhr.id, date: '2024-03-01' },
    { flightNumber: 'AF200', fromId: lhr.id, toId: cdg.id, date: daysAgo(7) },
    { flightNumber: 'AF300', fromId: cdg.id, toId: jfk.id, date: '2024-05-01' },
  ];
  const reasons = ['business', 'Visiting family', null];
  for (const [index, flight] of flights.entries()) {
    await flightsFactory.create({
      userId: user.id,
      ...flight,
      passenger: { flightReason: reasons[index] },
    });
  }
  await login(page, user);
  await page.goto('/flights');
  await expect(flightRow(page, 'AF300')).toBeVisible();
};

// Mobile rows space the flight number: "AF 300".
const flightRow = (page: Page, flightNumber: string) =>
  page.getByText(
    new RegExp(`^${flightNumber.slice(0, 2)}\\s?${flightNumber.slice(2)}$`),
  );

const expectFlights = async (page: Page, visible: string[]) => {
  for (const flightNumber of ['BA100', 'AF200', 'AF300']) {
    const row = flightRow(page, flightNumber);
    if (visible.includes(flightNumber)) {
      await expect(row).toBeVisible();
    } else {
      await expect(row).toHaveCount(0);
    }
  }
};

test.describe('Flight filters', () => {
  test('groups the filter menu and finds a country by name', async ({
    page,
  }) => {
    await seedFlights(page);
    await page.getByRole('button', { name: 'Filter', exact: true }).click();
    const menu = page.locator('[data-filter-menu-content]');
    await expect(
      menu.locator('[data-filter-menu-group-heading]').first(),
    ).toHaveText('Location');

    await menu.getByRole('combobox').fill('france');
    await menu
      .getByRole('menuitemcheckbox', { name: 'Arrival country / France' })
      .click();

    await expectFlights(page, ['AF200']);
  });

  test('offers and filters by a custom flight reason', async ({ page }) => {
    await seedFlights(page);
    await page.getByRole('button', { name: 'Filter', exact: true }).click();
    const menu = page.locator('[data-filter-menu-content]');
    await menu.getByRole('combobox').fill('visiting');
    await menu
      .getByRole('menuitemcheckbox', {
        name: 'Flight reason / Visiting family',
      })
      .click();

    await expectFlights(page, ['AF200']);
  });

  test('filters to a quick date range', async ({ page }) => {
    await seedFlights(page);
    await page.getByRole('button', { name: 'Filter', exact: true }).click();
    const menu = page.locator('[data-filter-menu-content]');
    await menu.getByRole('option', { name: 'Quick date' }).hover();
    await page.getByRole('menuitemcheckbox', { name: 'Past 30 days' }).click();

    await expectFlights(page, ['AF200']);
  });

  test.describe('on mobile', () => {
    test.use({ viewport: { width: 360, height: 800 } });

    test('filters by departure country from the grouped list', async ({
      page,
    }) => {
      await seedFlights(page);
      await page.getByRole('button', { name: 'Filters' }).click();
      await expect(page.getByText('Location', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: /^Departure country/ }).click();
      await page.getByRole('button', { name: /^France/ }).click();
      await page.getByRole('button', { name: /^Done/ }).click();
      await page.getByRole('button', { name: /^Done/ }).click();

      await expectFlights(page, ['AF300']);
    });
  });
});
