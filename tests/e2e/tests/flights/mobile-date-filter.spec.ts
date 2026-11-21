import type { Page } from '@playwright/test';
import { airportsFactory } from '@test/factories/airports';
import { flightsFactory } from '@test/factories/flights';
import { usersFactory } from '@test/factories/users';
import { JFK, LHR } from '@test/fixtures/airports';
import { login } from '@test/helpers/auth';
import { expect, test } from '@test/index';

test.use({ viewport: { width: 360, height: 800 } });

const openDateFilter = async (page: Page) => {
  const { user } = await usersFactory.create();
  const { airport: from } = await airportsFactory.getOrCreate(JFK);
  const { airport: to } = await airportsFactory.getOrCreate(LHR);
  await flightsFactory.create({
    userId: user.id,
    date: '2025-06-15',
    fromId: from.id,
    toId: to.id,
  });
  await login(page, user);
  await page.goto('/flights');
  await page.getByRole('button', { name: 'Filters' }).click();
  await page.getByRole('button', { name: /^Date/ }).click();
};

const day = (page: Page, n: number) =>
  page.locator('[data-bits-day]:not([data-outside-month])', {
    hasText: new RegExp(`^${n}$`),
  });

test('selects a date range on mobile', async ({ page }) => {
  await openDateFilter(page);
  const range = page.getByRole('button', { name: 'Range', exact: true });
  await range.click();
  await expect(range).toHaveAttribute('aria-pressed', 'true');

  await day(page, 10).click();
  await expect(range).toHaveAttribute('aria-pressed', 'true');
  await day(page, 17).click();
  await expect(range).toHaveAttribute('aria-pressed', 'true');

  await expect(day(page, 10)).toHaveAttribute('data-selection-start', '');
  await expect(day(page, 17)).toHaveAttribute('data-selection-end', '');
  await expect(day(page, 13)).toHaveAttribute('data-selected', '');
});

test('moves the exact date to the tapped day on mobile', async ({ page }) => {
  await openDateFilter(page);
  await day(page, 10).click();
  await day(page, 17).click();

  await expect(
    page.getByRole('button', { name: 'Exact', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(day(page, 17)).toHaveAttribute('data-selected', '');
  await expect(day(page, 10)).not.toHaveAttribute('data-selected', '');
});
