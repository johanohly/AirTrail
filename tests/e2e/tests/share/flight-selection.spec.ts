import { randomUUID } from 'node:crypto';

import { airportsFactory } from '@test/factories/airports';
import { flightsFactory } from '@test/factories/flights';
import { usersFactory } from '@test/factories/users';
import { JFK, LHR } from '@test/fixtures/airports';
import { db, expect, test } from '@test/index';

import { hashSha256 } from '$lib/server/utils/hash';

const createUserWithFlights = async () => {
  const { user } = await usersFactory.create();
  const { airport: from } = await airportsFactory.getOrCreate(JFK);
  const { airport: to } = await airportsFactory.getOrCreate(LHR);
  for (const date of ['2024-03-01', '2099-03-01']) {
    await flightsFactory.create({
      userId: user.id,
      date,
      fromId: from.id,
      toId: to.id,
    });
  }
  return user;
};

test.describe('Share flight selection', () => {
  for (const flightSelection of ['past', 'upcoming'] as const) {
    test(`shares only ${flightSelection} flights`, async ({ page }) => {
      const user = await createUserWithFlights();
      const slug = `e2e-${randomUUID()}`;
      await db
        .insertInto('publicShare')
        .values({
          userId: user.id,
          slug,
          showFlightList: true,
          flightSelection,
        })
        .execute();

      await page.goto(`/share/${slug}`);
      await page.getByRole('button', { name: 'Flight List' }).click();

      const rows = page.locator('[id^="flight-list-row-"]');
      await expect(rows).toHaveCount(1);
      await expect(rows).toContainText(
        flightSelection === 'past' ? '2024' : '2099',
      );
    });
  }

  test('keeps the date range of an API client that omits the selection', async ({
    request,
  }) => {
    const { user } = await usersFactory.create();
    const key = `key_${randomUUID()}`;
    await db
      .insertInto('apiKey')
      .values({
        name: 'e2e',
        userId: user.id,
        key: hashSha256(key),
        scopes: ['shares.write'],
      })
      .execute();

    const response = await request.post('/api/v1/shares', {
      headers: { Authorization: `Bearer ${key}` },
      data: { dateFrom: '2024-01-01', dateTo: '2024-12-31' },
    });
    expect(response.status()).toBe(201);
    const { data } = await response.json();
    expect(data).toMatchObject({
      flightSelection: 'custom',
      dateFrom: '2024-01-01',
      dateTo: '2024-12-31',
    });
  });
});
