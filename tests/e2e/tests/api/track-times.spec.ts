import { randomUUID } from 'node:crypto';

import { airportsFactory } from '@test/factories/airports';
import { flightsFactory } from '@test/factories/flights';
import { usersFactory } from '@test/factories/users';
import { db, expect, test } from '@test/index';

import type { ApiScope } from '$lib/api/v1/scopes';
import { hashSha256 } from '$lib/server/utils/hash';

const createApiKey = async (userId: string, scopes: ApiScope[]) => {
  const key = `key_${randomUUID()}`;
  await db
    .insertInto('apiKey')
    .values({ name: 'e2e', userId, key: hashSha256(key), scopes })
    .execute();
  return { Authorization: `Bearer ${key}` };
};

const runwayTimes = (flightId: number) =>
  db
    .selectFrom('flight')
    .select(['takeoffActual', 'landingActual'])
    .where('id', '=', flightId)
    .executeTakeFirstOrThrow();

// Wheels up at 08:00:20 UTC and down at 10:59:50 UTC on 2026-03-14.
const DAY = Date.UTC(2026, 2, 14) / 1000;
const track = {
  sourceFormat: 'gpx',
  sourceName: 'e2e.gpx',
  coordinates: [
    [12.65, 55.61, 0],
    [12.66, 55.62, 30],
    [-0.45, 51.47, 30],
    [-0.46, 51.47, 0],
  ],
  times: [DAY + 28_790, DAY + 28_820, DAY + 39_570, DAY + 39_590],
};

test.describe('Track times on API writes', () => {
  test('fill empty takeoff and landing times and keep set ones', async ({
    request,
  }) => {
    const { user } = await usersFactory.create();
    const { airport } = await airportsFactory.getOrCreate({
      icao: 'EKCH',
      name: 'Copenhagen Airport',
      lat: 55.618,
      lon: 12.656,
      country: 'DK',
      continent: 'EU',
      tz: 'Europe/Copenhagen',
      type: 'large_airport',
    });
    const headers = await createApiKey(user.id, [
      'flight.create.own',
      'flight.update.own',
      'tracks.write',
    ]);

    const { flight: empty } = await flightsFactory.create({
      userId: user.id,
      date: '2026-03-14',
      fromId: airport.id,
      toId: airport.id,
      departure: '2026-03-14T07:45:00.000Z',
    });
    const put = await request.put(`/api/v1/flights/${empty.id}/track`, {
      headers,
      data: track,
    });
    expect(put.status()).toBe(200);
    expect(await runwayTimes(empty.id)).toEqual({
      takeoffActual: '2026-03-14T08:00:00.000Z',
      landingActual: '2026-03-14T10:59:00.000Z',
    });

    const { flight: set } = await flightsFactory.create({
      userId: user.id,
      date: '2026-03-14',
      fromId: airport.id,
      toId: airport.id,
    });
    await db
      .updateTable('flight')
      .set({ takeoffActual: '2026-03-14T08:05:00.000Z' })
      .where('id', '=', set.id)
      .execute();
    await request.put(`/api/v1/flights/${set.id}/track`, {
      headers,
      data: track,
    });
    expect(await runwayTimes(set.id)).toEqual({
      takeoffActual: '2026-03-14T08:05:00.000Z',
      landingActual: '2026-03-14T10:59:00.000Z',
    });

    const created = await request.post('/api/v1/flights', {
      headers,
      data: {
        date: '2026-03-14',
        fromId: airport.id,
        toId: airport.id,
        landingActual: '2026-03-14T11:02:00.000Z',
        passengers: [{ userId: user.id }],
        track,
      },
    });
    expect(created.status()).toBe(201);
    const { data } = await created.json();
    expect(await runwayTimes(data.id)).toEqual({
      takeoffActual: '2026-03-14T08:00:00.000Z',
      landingActual: '2026-03-14T11:02:00.000Z',
    });
  });
});
