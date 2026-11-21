import { db } from '@test/db';
import { airportsFactory } from '@test/factories/airports';
import { flightsFactory } from '@test/factories/flights';
import { usersFactory } from '@test/factories/users';
import { CDG, JFK, LHR } from '@test/fixtures/airports';
import { login } from '@test/helpers/auth';
import { expect, test } from '@test/index';

test('a drill-down can rank its rows by distance flown', async ({ page }) => {
  const { user } = await usersFactory.create();
  const { airport: jfk } = await airportsFactory.getOrCreate(JFK);
  const { airport: lhr } = await airportsFactory.getOrCreate(LHR);
  const { airport: cdg } = await airportsFactory.getOrCreate(CDG);

  // One long flight on JFK – LHR, three short hops between LHR and CDG.
  await flightsFactory.create({
    userId: user.id,
    date: '2024-03-01',
    fromId: jfk.id,
    toId: lhr.id,
  });
  for (let day = 2; day <= 4; day++) {
    await flightsFactory.create({
      userId: user.id,
      date: `2024-03-0${day}`,
      fromId: lhr.id,
      toId: cdg.id,
    });
  }

  await login(page, user);
  await page.getByTestId('statistics-button').click();
  await page.getByRole('button', { name: /CDG – LHR/ }).click();

  const sheet = page.getByTestId('statistics-drill-down');
  const rows = sheet.getByRole('button', { name: /–/ });
  await expect(rows.first()).toContainText('CDG – LHR');
  await expect(rows.first()).toContainText('3');

  await sheet.getByRole('tab', { name: 'Distance' }).click();
  await expect(rows.first()).toContainText('JFK – LHR');
  await expect(rows.first()).toContainText(/\d km/);
});

test('a drill-down counts a distance entered by hand', async ({ page }) => {
  const { user } = await usersFactory.create();
  const { airport: jfk } = await airportsFactory.getOrCreate(JFK);
  const { airport: lhr } = await airportsFactory.getOrCreate(LHR);
  const { airport: cdg } = await airportsFactory.getOrCreate(CDG);

  await flightsFactory.create({
    userId: user.id,
    date: '2024-03-01',
    fromId: jfk.id,
    toId: lhr.id,
  });
  const { flight: diverted } = await flightsFactory.create({
    userId: user.id,
    date: '2024-03-02',
    fromId: lhr.id,
    toId: cdg.id,
  });
  // Longer than JFK – LHR, so only the stored distance can rank it first.
  await db
    .updateTable('flight')
    .set({ manualDistance: 9000 })
    .where('id', '=', diverted.id)
    .execute();

  await login(page, user);
  await page.getByTestId('statistics-button').click();
  await page.getByRole('button', { name: /CDG – LHR/ }).click();

  const sheet = page.getByTestId('statistics-drill-down');
  await sheet.getByRole('tab', { name: 'Distance' }).click();
  const rows = sheet.getByRole('button', { name: /–/ });
  await expect(rows.first()).toContainText('CDG – LHR');
  await expect(rows.first()).toContainText(/9.?000 km/);
});
