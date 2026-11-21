import { db } from '@test/db';
import { airportsFactory } from '@test/factories/airports';
import { usersFactory } from '@test/factories/users';
import { JFK, LHR } from '@test/fixtures/airports';
import { login } from '@test/helpers/auth';
import { latestFlightFor } from '@test/helpers/flight-db';
import { expect, test } from '@test/index';

const TRACK_POINTS = 60_000;

const buildExport = (username: string, displayName: string) => {
  const start = Date.parse('2024-05-01T10:00:00Z') / 1000;
  const coordinates = Array.from({ length: TRACK_POINTS }, (_, i) => {
    const f = i / (TRACK_POINTS - 1);
    return [
      +(JFK.lon + (LHR.lon - JFK.lon) * f).toFixed(5),
      +(JFK.lat + (LHR.lat - JFK.lat) * f).toFixed(5),
      Math.round(Math.sin(Math.PI * f) * 11_000),
    ];
  });
  const times = coordinates.map((_, i) => start + i);

  return JSON.stringify(
    {
      users: [{ id: 'exported-user', username, displayName }],
      flights: [
        {
          date: '2024-05-01',
          departure: '2024-05-01T10:00:00.000Z',
          arrival: '2024-05-01T16:40:00.000Z',
          duration: 24_000,
          flightNumber: null,
          aircraftReg: null,
          note: null,
          from: { code: JFK.icao },
          to: { code: LHR.icao },
          airline: null,
          aircraft: null,
          passengers: [
            {
              userId: 'exported-user',
              guestName: null,
              seat: null,
              seatNumber: null,
              seatClass: null,
              flightReason: null,
            },
          ],
          track: { coordinates, times, sourceFormat: 'gpx', sourceName: null },
        },
      ],
    },
    null,
    2,
  );
};

test.describe('Import', () => {
  test('imports an AirTrail file larger than 5 MB', async ({ page }) => {
    const { user } = await usersFactory.create();
    const { airport: from } = await airportsFactory.getOrCreate(JFK);
    const { airport: to } = await airportsFactory.getOrCreate(LHR);
    await login(page, user);

    const file = Buffer.from(buildExport(user.username, user.displayName));
    expect(file.byteLength).toBeGreaterThan(5 * 1024 * 1024);

    await page.goto('/');
    await page.locator('#settings-button').first().click();
    await page.getByRole('button', { name: 'Import', exact: true }).click();
    await page.locator('label[for="airtrail"]').click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.locator('#file').setInputFiles({
      name: 'airtrail.json',
      mimeType: 'application/json',
      buffer: file,
    });
    await page.getByRole('button', { name: 'Next' }).click();
    await page
      .getByRole('button', { name: 'Import', exact: true })
      .last()
      .click();
    await page.getByRole('button', { name: 'Continue Import' }).click();

    await expect(
      page.getByText('Successfully imported 1 flight'),
    ).toBeVisible();

    const flight = await latestFlightFor(user.id, from.id, to.id);
    const track = await db
      .selectFrom('flightTrack')
      .select('pointCount')
      .where('flightId', '=', flight.id)
      .executeTakeFirstOrThrow();
    expect(track.pointCount).toBe(TRACK_POINTS);
  });
});
