import { readFileSync } from 'node:fs';

import type { Page } from '@playwright/test';
import { db } from '@test/db';
import { airportsFactory } from '@test/factories/airports';
import { flightsFactory } from '@test/factories/flights';
import { usersFactory } from '@test/factories/users';
import { CDG, JFK, LHR } from '@test/fixtures/airports';
import { login } from '@test/helpers/auth';
import { expect, test } from '@test/index';

/** Three flights known only to July 1998, entered in this order. */
const createJulyTrip = async (userId: string) => {
  const { airport: jfk } = await airportsFactory.getOrCreate(JFK);
  const { airport: lhr } = await airportsFactory.getOrCreate(LHR);
  const { airport: cdg } = await airportsFactory.getOrCreate(CDG);
  const ids: number[] = [];
  for (const [from, to] of [
    [jfk, lhr],
    [lhr, cdg],
    [cdg, jfk],
  ] as const) {
    const { flight } = await flightsFactory.create({
      userId,
      date: '1998-07-01',
      datePrecision: 'month',
      fromId: from.id,
      toId: to.id,
    });
    ids.push(flight.id);
  }
  return ids;
};

const listedFlightIds = async (page: Page) =>
  (
    await page
      .locator('[id^="flight-list-row-"]')
      .evaluateAll((rows) => rows.map((row) => row.id))
  ).map((id) => Number(id.replace('flight-list-row-', '')));

const openFlightList = async (page: Page) => {
  await page.goto('/');
  await page.getByTestId('list-flights-button').click();
};

/** Routes of a user's July flights, newest first, as the app orders them. */
const julyRoutes = async (userId: string) => {
  const rows = await db
    .selectFrom('flight')
    .innerJoin('flightPassenger', 'flightPassenger.flightId', 'flight.id')
    .select(['flight.id', 'flight.sortKey', 'flight.fromId', 'flight.toId'])
    .where('flightPassenger.userId', '=', userId)
    .where('flight.date', '=', '1998-07-01')
    .execute();
  return rows
    .sort((a, b) => (b.sortKey ?? b.id) - (a.sortKey ?? a.id))
    .map((row) => `${row.fromId}-${row.toId}`);
};

test.describe('Moving flights without a time', () => {
  test('moves a flight earlier among flights of the same month', async ({
    page,
  }) => {
    const { user } = await usersFactory.create();
    const [first, second, third] = await createJulyTrip(user.id);
    await login(page, user);
    await openFlightList(page);

    await expect
      .poll(() => listedFlightIds(page))
      .toEqual([third, second, first]);

    const newest = page.locator(`#flight-list-row-${third}`);
    await newest.getByTestId('flight-actions-button').click();
    await expect(
      page.getByRole('menuitem', { name: 'Move earlier' }),
    ).toBeVisible();
    await expect(
      page.getByRole('menuitem', { name: 'Move later' }),
    ).toHaveCount(0);
    await page.getByRole('menuitem', { name: 'Move earlier' }).click();

    await expect
      .poll(() => listedFlightIds(page))
      .toEqual([second, third, first]);
  });

  test('keeps the moved order through an export and import', async ({
    page,
  }) => {
    const { user } = await usersFactory.create();
    const [first, second, third] = await createJulyTrip(user.id);
    await login(page, user);
    await openFlightList(page);

    const oldest = page.locator(`#flight-list-row-${first}`);
    await oldest.getByTestId('flight-actions-button').click();
    await page.getByRole('menuitem', { name: 'Move later' }).click();
    await expect
      .poll(() => listedFlightIds(page))
      .toEqual([third, first, second]);
    const expected = await julyRoutes(user.id);

    await page.keyboard.press('Escape');
    await page.locator('#settings-button').first().click();
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: '.json' }).click(),
    ]);
    const backup = JSON.parse(readFileSync((await download.path())!, 'utf8'));
    expect(JSON.stringify(backup)).not.toContain('sortKey');

    const { user: other } = await usersFactory.create();
    backup.users = backup.users.map((exported: { id: string }) => ({
      ...exported,
      username: other.username,
      displayName: other.displayName,
    }));

    await page.context().clearCookies();
    await login(page, other);
    await page.locator('#settings-button').first().click();
    await page.getByRole('button', { name: 'Import', exact: true }).click();
    await page.locator('label[for="airtrail"]').click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.locator('#file').setInputFiles({
      name: 'airtrail.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(backup)),
    });
    await page.getByRole('button', { name: 'Next' }).click();
    await page
      .getByRole('button', { name: 'Import', exact: true })
      .last()
      .click();
    await page.getByRole('button', { name: 'Continue Import' }).click();
    await expect(
      page.getByText('Successfully imported 3 flights'),
    ).toBeVisible();

    expect(await julyRoutes(other.id)).toEqual(expected);
  });
});
