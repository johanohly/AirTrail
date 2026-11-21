import { airportsFactory } from '@test/factories/airports';
import { flightsFactory } from '@test/factories/flights';
import { usersFactory } from '@test/factories/users';
import { CDG, JFK, LHR } from '@test/fixtures/airports';
import { login } from '@test/helpers/auth';
import { expect, test } from '@test/index';

test('punctuality rows open a drill-down ranked by total or average delay', async ({
  page,
}) => {
  const { user } = await usersFactory.create();
  const { airport: jfk } = await airportsFactory.getOrCreate(JFK);
  const { airport: lhr } = await airportsFactory.getOrCreate(LHR);
  const { airport: cdg } = await airportsFactory.getOrCreate(CDG);

  const landed = async (
    fromId: number,
    toId: number,
    day: number,
    minutesLate: number,
  ) => {
    const scheduled = new Date(Date.UTC(2024, 2, day, 10));
    await flightsFactory.create({
      userId: user.id,
      date: scheduled.toISOString().slice(0, 10),
      fromId,
      toId,
      departure: new Date(scheduled.getTime() - 3 * 3600_000).toISOString(),
      arrivalScheduled: scheduled.toISOString(),
      arrival: new Date(
        scheduled.getTime() + minutesLate * 60_000,
      ).toISOString(),
    });
  };
  // JFK – LHR loses the most time in total, CDG – LHR the most per delay.
  await landed(jfk.id, lhr.id, 1, 40);
  await landed(lhr.id, jfk.id, 2, 40);
  await landed(lhr.id, cdg.id, 3, 70);
  await landed(cdg.id, jfk.id, 4, -10);

  await login(page, user);
  await page.getByTestId('statistics-button').click();

  const routes = page
    .getByRole('heading', { name: 'Delays by route', level: 4 })
    .locator('..');
  const route = routes.getByRole('button', { name: /JFK – LHR/ });
  await route.scrollIntoViewIfNeeded();
  await expect(route).toContainText('+1h 20m');
  await route.click();

  const sheet = page.getByTestId('statistics-drill-down');
  await expect(
    sheet.getByRole('heading', { name: 'Delays by route' }),
  ).toBeVisible();
  // The clicked route opens expanded, with its flights' delays.
  await expect(sheet.getByText('+40m')).toHaveCount(2);

  await sheet.getByRole('tab', { name: 'Average' }).click();
  await expect(
    sheet.getByRole('heading', { name: 'Average delay by route' }),
  ).toBeVisible();
  const rows = sheet.getByRole('button', { name: /–/ });
  await expect(rows.first()).toContainText('CDG – LHR');
  await expect(rows.first()).toContainText('+1h 10m');
});
