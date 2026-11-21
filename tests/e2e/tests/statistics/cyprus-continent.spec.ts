import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { db } from '@test/db';
import { airportsFactory } from '@test/factories/airports';
import { flightsFactory } from '@test/factories/flights';
import { usersFactory } from '@test/factories/users';
import { LHR } from '@test/fixtures/airports';
import { login } from '@test/helpers/auth';
import { expect, test } from '@test/index';
import { sql } from 'kysely';

const MIGRATION = join(
  process.cwd(),
  'prisma/migrations/20261121120000_cyprus_airports_in_europe/migration.sql',
);

// Real Cypriot airports are already in Europe on a fresh database, so these
// stand in for rows imported before the continent override existed.
const staleAirport = (custom: boolean) =>
  db
    .insertInto('airport')
    .values({
      icao: `CY${crypto.randomUUID().slice(0, 8)}`,
      iata: null,
      name: 'Stale Cypriot airport',
      municipality: 'Larnaca',
      lat: 34.8751,
      lon: 33.6249,
      country: 'CY',
      continent: 'AS',
      tz: 'Asia/Nicosia',
      type: 'large_airport',
      custom,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

test('counts flights to previously imported Cypriot airports as Europe', async ({
  page,
}) => {
  const imported = await staleAirport(false);
  const custom = await staleAirport(true);

  await sql.raw(readFileSync(MIGRATION, 'utf8')).execute(db);

  const continentOf = async (id: number) =>
    (
      await db
        .selectFrom('airport')
        .select('continent')
        .where('id', '=', id)
        .executeTakeFirstOrThrow()
    ).continent;
  expect(await continentOf(imported.id)).toBe('EU');
  expect(await continentOf(custom.id)).toBe('AS');

  const { user } = await usersFactory.create();
  const { airport: lhr } = await airportsFactory.getOrCreate(LHR);
  await flightsFactory.create({
    userId: user.id,
    date: '2024-05-01',
    fromId: lhr.id,
    toId: imported.id,
  });

  await login(page, user);
  await page.getByTestId('statistics-button').click();

  const destinations = page
    .getByRole('heading', { name: 'Destinations', level: 4 })
    .locator('..');
  await destinations.scrollIntoViewIfNeeded();
  await expect(destinations).toContainText('Europe');
  await expect(destinations).not.toContainText('Asia');
});
