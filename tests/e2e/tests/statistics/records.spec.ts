import { airportsFactory } from '@test/factories/airports';
import { flightsFactory } from '@test/factories/flights';
import { usersFactory } from '@test/factories/users';
import { CDG, JFK, LHR } from '@test/fixtures/airports';
import { login } from '@test/helpers/auth';
import { expect, test } from '@test/index';

test('records ignore estimated durations and new lists rank countries and seats', async ({
  page,
}) => {
  const { user } = await usersFactory.create();
  const { airport: jfk } = await airportsFactory.getOrCreate(JFK);
  const { airport: lhr } = await airportsFactory.getOrCreate(LHR);
  const { airport: cdg } = await airportsFactory.getOrCreate(CDG);

  await flightsFactory.create({
    userId: user.id,
    date: '2024-03-01',
    fromId: jfk.id,
    toId: lhr.id,
    departure: '2024-03-01T22:00:00Z',
    arrival: '2024-03-02T05:00:00Z',
    duration: 7 * 3600,
    passenger: { seatNumber: '12a' },
  });
  // Without recorded times this duration is no measured speed, so it must
  // not win the fastest flight record despite being implausibly quick.
  await flightsFactory.create({
    userId: user.id,
    date: '2024-03-05',
    fromId: lhr.id,
    toId: cdg.id,
    duration: 600,
    passenger: { seatNumber: '12A' },
  });

  await login(page, user);
  await page.getByTestId('statistics-button').click();

  const fastest = page.getByRole('button', { name: /Fastest flight/ });
  await fastest.scrollIntoViewIfNeeded();
  await expect(fastest).toContainText('JFK – LHR');
  await expect(
    page.getByRole('button', { name: /Shortest flight/ }),
  ).toContainText('LHR – CDG');
  await expect(
    page.getByRole('button', { name: /Northernmost airport/ }),
  ).toContainText('LHR');

  const countries = page
    .getByRole('heading', { name: 'Countries', level: 4 })
    .locator('..');
  await expect(countries).toContainText('United Kingdom');
  await expect(countries).toContainText('France');

  const seats = page
    .getByRole('heading', { name: 'Seats', level: 4 })
    .locator('..');
  await expect(seats.getByRole('button', { name: /12A/ })).toHaveText(
    /12A\s*2\s*$/,
  );
});
