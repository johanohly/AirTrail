import { stringify } from 'devalue';

import { airportsFactory } from '@test/factories/airports';
import { flightsFactory } from '@test/factories/flights';
import { usersFactory } from '@test/factories/users';
import { login } from '@test/helpers/auth';
import { db, expect, test } from '@test/index';

// Wheels up at 08:00:20 UTC and down at 10:59:50 UTC on 2026-03-14.
const DAY = Date.UTC(2026, 2, 14) / 1000;
const track = {
  coordinates: [
    [12.65, 55.61, 0],
    [12.66, 55.62, 30],
    [-0.45, 51.47, 30],
    [-0.46, 51.47, 0],
  ],
  times: [DAY + 28_790, DAY + 28_820, DAY + 39_570, DAY + 39_590],
};

const runwayTimes = (flightId: number) =>
  db
    .selectFrom('flight')
    .select(['takeoffActual', 'landingActual'])
    .where('id', '=', flightId)
    .executeTakeFirstOrThrow();

test.describe('Fill times from tracks', () => {
  test('fills only empty times and lists flights it cannot fill', async ({
    page,
  }) => {
    const { user } = await usersFactory.create();
    const { airport: cph } = await airportsFactory.getOrCreate({
      icao: 'EKCH',
      iata: 'CPH',
      name: 'Copenhagen Airport',
      lat: 55.618,
      lon: 12.656,
      country: 'DK',
      continent: 'EU',
      tz: 'Europe/Copenhagen',
      type: 'large_airport',
    });
    const { airport: lhr } = await airportsFactory.getOrCreate({
      icao: 'EGLL',
      iata: 'LHR',
      name: 'London Heathrow Airport',
      lat: 51.47,
      lon: -0.454,
      country: 'GB',
      continent: 'EU',
      tz: 'Europe/London',
      type: 'large_airport',
    });
    const tracked = async (values: {
      date?: string;
      takeoffActual?: string;
      datePrecision?: 'day' | 'month';
      airborneStart?: boolean;
      departure?: null;
    }) => {
      const { flight } = await flightsFactory.create({
        userId: user.id,
        date: values.date ?? '2026-03-14',
        fromId: cph.id,
        toId: lhr.id,
        departure:
          values.datePrecision || values.departure === null
            ? null
            : '2026-03-14T07:45:00.000Z',
      });
      await db
        .updateTable('flight')
        .set({
          takeoffActual: values.takeoffActual ?? null,
          datePrecision: values.datePrecision ?? 'day',
        })
        .where('id', '=', flight.id)
        .execute();
      await db
        .insertInto('flightTrack')
        .values({
          flightId: flight.id,
          track: values.airborneStart
            ? {
                coordinates: track.coordinates.slice(1),
                times: track.times.slice(1),
              }
            : track,
          sourceFormat: 'gpx',
          pointCount: track.coordinates.length,
        })
        .execute();
      return flight.id;
    };
    const empty = await tracked({});
    const kept = await tracked({ takeoffActual: '2026-03-14T08:05:00.000Z' });
    const partial = await tracked({
      date: '2026-03-01',
      datePrecision: 'month',
    });
    const airborne = await tracked({ airborneStart: true });
    const unselected = await tracked({ date: '2026-03-13', departure: null });

    await login(page, user);
    await page.goto('/tools/fill-times');
    const table = page.getByRole('table');
    // The 03-13 flight has no time to check against, and its track is a day
    // later, so its times show their date.
    await expect(table.getByText('New')).toHaveCount(6);
    await expect(table.getByText('Already set · track 9:00 AM')).toBeVisible();
    await expect(table.getByText('Flight has no exact date')).toBeVisible();
    await expect(table.getByText('Track starts in the air')).toBeVisible();
    await expect(
      table
        .getByRole('row')
        .filter({ hasText: '03/2026' })
        .getByRole('checkbox'),
    ).toBeDisabled();

    await page.getByRole('checkbox', { name: 'Select all' }).click();
    await table
      .getByRole('row')
      .filter({ hasText: '03/13/2026' })
      .getByRole('checkbox')
      .click();
    await page.getByRole('button', { name: 'Fill Times' }).click();
    await expect(page.getByText('Filled times on 3 flights')).toBeVisible();

    expect(await runwayTimes(empty)).toEqual({
      takeoffActual: '2026-03-14T08:00:00.000Z',
      landingActual: '2026-03-14T10:59:00.000Z',
    });
    expect(await runwayTimes(kept)).toEqual({
      takeoffActual: '2026-03-14T08:05:00.000Z',
      landingActual: '2026-03-14T10:59:00.000Z',
    });
    expect(await runwayTimes(partial)).toEqual({
      takeoffActual: null,
      landingActual: null,
    });
    expect(await runwayTimes(airborne)).toEqual({
      takeoffActual: null,
      landingActual: '2026-03-14T10:59:00.000Z',
    });
    expect(await runwayTimes(unselected)).toEqual({
      takeoffActual: null,
      landingActual: null,
    });
    await expect(table.getByText('New')).toHaveCount(2);
    await expect(table.getByText('Flight has no exact date')).toBeVisible();
  });

  test('is closed to a role that cannot edit its flights', async ({ page }) => {
    const { user } = await usersFactory.create();
    const roleId = `role-read-${user.id}`;
    await db
      .insertInto('accessRole')
      .values({ id: roleId, name: `Read only ${user.id}` })
      .execute();
    await db
      .insertInto('accessRolePermission')
      .values({ roleId, permission: 'flight.read.own' })
      .execute();
    await db
      .updateTable('user')
      .set({ roleId })
      .where('id', '=', user.id)
      .execute();

    await login(page, user);
    await page.goto('/tools/fill-times');
    await expect(page.getByText('Forbidden')).toBeVisible();
    await expect(page.getByRole('table')).toHaveCount(0);
    const fill = await page.request.post(
      '/api/trpc/flightTrack.fillTimes?batch=1',
      { data: { 0: stringify([1]) } },
    );
    expect(fill.status()).toBe(403);
    expect(await fill.text()).toContain('FORBIDDEN');
  });
});
