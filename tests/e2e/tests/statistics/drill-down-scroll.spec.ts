import type { Page } from '@playwright/test';
import { airportsFactory } from '@test/factories/airports';
import { flightsFactory } from '@test/factories/flights';
import { usersFactory } from '@test/factories/users';
import { JFK, LHR } from '@test/fixtures/airports';
import { login } from '@test/helpers/auth';
import { expect, test } from '@test/index';

async function openDrillDownFromBottomOfStatistics(page: Page) {
  const { user } = await usersFactory.create();
  const { airport: from } = await airportsFactory.getOrCreate(JFK);
  const { airport: to } = await airportsFactory.getOrCreate(LHR);
  for (let i = 0; i < 8; i++) {
    await flightsFactory.create({
      userId: user.id,
      date: `${2023 + (i % 3)}-06-15`,
      fromId: from.id,
      toId: to.id,
    });
  }
  await login(page, user);
  await page.getByTestId('statistics-button').click();
  const scroller = page.getByTestId('statistics-scroll');
  // Opening focuses the filter button, which would undo scrolling done before.
  await expect(scroller.getByRole('button', { name: 'Filter' })).toBeFocused();

  // None of the flights has a reason, so the last "Not recorded" row opens a
  // drill-down listing all of them from the bottom of the page.
  const row = scroller.getByRole('button', { name: /^Not recorded/ }).last();
  await scroller.evaluate((el) => (el.scrollTop = el.scrollHeight));
  await row.click();
  const sheet = page.getByTestId('statistics-drill-down');
  await expect(sheet).toBeVisible();
  const scrollTop = await scroller.evaluate((el) => el.scrollTop);
  expect(scrollTop).toBeGreaterThan(100);
  return { row, scroller, sheet, scrollTop };
}

test('closing a drill-down keeps the statistics scroll position', async ({
  page,
}) => {
  const { row, scroller, sheet, scrollTop } =
    await openDrillDownFromBottomOfStatistics(page);

  await sheet.getByRole('button', { name: 'Back to statistics' }).click();
  await expect(sheet).toHaveCount(0);
  expect(await scroller.evaluate((el) => el.scrollTop)).toBe(scrollTop);
  // Keyboard users resume on the row that opened the drill-down.
  await expect(row).toBeFocused();
});

test('dismissing a drill-down with Escape keeps the statistics scroll position', async ({
  page,
}) => {
  const { row, scroller, sheet, scrollTop } =
    await openDrillDownFromBottomOfStatistics(page);

  // Focus a control in the sheet, as a keyboard user browsing it would be,
  // so closing it removes the focused element from the DOM.
  await sheet.getByRole('button', { name: 'Back to statistics' }).focus();
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  // The statistics stay open behind the dismissed sheet.
  await expect(scroller).toBeVisible();
  expect(await scroller.evaluate((el) => el.scrollTop)).toBe(scrollTop);
  await expect(row).toBeFocused();
});

test('returning from a flight keeps focus on it in the drill-down', async ({
  page,
}) => {
  const { sheet } = await openDrillDownFromBottomOfStatistics(page);

  const flight = sheet.getByRole('button', { name: /JFK.*LHR/ }).first();
  await flight.click();
  // The flight list opens on top of the statistics.
  await expect(page.getByRole('dialog')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(sheet).toBeVisible();
  await expect(flight).toBeFocused();
});
