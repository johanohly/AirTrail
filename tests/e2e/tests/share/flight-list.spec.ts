import { db } from '@test/db';
import { airportsFactory } from '@test/factories/airports';
import { flightsFactory } from '@test/factories/flights';
import { usersFactory } from '@test/factories/users';
import { JFK, LHR } from '@test/fixtures/airports';
import { expect, test } from '@test/index';

test.describe('Shared flight list', () => {
  test('pages through more than 20 shared flights', async ({ page }) => {
    const { user } = await usersFactory.create();
    const { airport: from } = await airportsFactory.getOrCreate(JFK);
    const { airport: to } = await airportsFactory.getOrCreate(LHR);
    for (let day = 1; day <= 25; day++) {
      await flightsFactory.create({
        userId: user.id,
        date: `2024-01-${String(day).padStart(2, '0')}`,
        fromId: from.id,
        toId: to.id,
      });
    }

    const slug = `e2e-${crypto.randomUUID()}`;
    await db
      .insertInto('publicShare')
      .values({ userId: user.id, slug, showFlightList: true })
      .execute();

    await page.goto(`/share/${slug}`);
    await page.getByRole('button', { name: 'Flight List' }).click();
    await expect(page.getByText('All Flights')).toBeVisible();

    const rows = page.locator('[id^="flight-list-row-"]');
    await expect(rows).toHaveCount(20);

    await page.getByRole('button', { name: 'Next' }).click();
    await expect(rows).toHaveCount(5);
  });
});
