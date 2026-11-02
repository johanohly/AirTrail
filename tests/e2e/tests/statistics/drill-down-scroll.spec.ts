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
  await expect(scroller).toBeVisible();

  // The "Not recorded" airline row opens a chart drill-down.
  const row = scroller.getByRole('button', { name: /^Not recorded/ }).first();
  await scroller.evaluate((el) => (el.scrollTop = el.scrollHeight));
  await row.click();
  const sheet = page.getByTestId('statistics-drill-down');
  await expect(sheet).toBeVisible();
  return {
    scroller,
    sheet,
    scrollTop: await scroller.evaluate((el) => el.scrollTop),
  };
}

test('closing a drill-down keeps the statistics scroll position', async ({
  page,
}) => {
  const { scroller, sheet, scrollTop } =
    await openDrillDownFromBottomOfStatistics(page);
  expect(scrollTop).toBeGreaterThan(100);

  await sheet
    .getByRole('button', { name: 'Back to statistics' })
    .first()
    .click();
  await expect(sheet).toHaveCount(0);
  expect(await scroller.evaluate((el) => el.scrollTop)).toBe(scrollTop);
});

test('dismissing a drill-down with Escape keeps the statistics scroll position', async ({
  page,
}) => {
  const { scroller, sheet, scrollTop } =
    await openDrillDownFromBottomOfStatistics(page);
  expect(scrollTop).toBeGreaterThan(100);

  // Focus a control in the sheet, as a keyboard user browsing it would be,
  // so closing it removes the focused element from the DOM.
  await sheet
    .getByRole('button', { name: 'Back to statistics' })
    .first()
    .focus();
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  // The statistics stay open behind the dismissed sheet.
  await expect(page.getByTestId('statistics-scroll')).toBeVisible();
  expect(await scroller.evaluate((el) => el.scrollTop)).toBe(scrollTop);
});
