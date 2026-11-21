import { db } from '@test/db';
import { airportsFactory } from '@test/factories/airports';
import { flightsFactory } from '@test/factories/flights';
import { preferencesFactory } from '@test/factories/preferences';
import { usersFactory } from '@test/factories/users';
import { login } from '@test/helpers/auth';
import { openEditFlightModal } from '@test/helpers/flight-form';
import { expect, test } from '@test/index';

const storedDistance = async (flightId: number) =>
  (
    await db
      .selectFrom('flight')
      .select('manualDistance')
      .where('id', '=', flightId)
      .executeTakeFirstOrThrow()
  ).manualDistance;

test.describe('Manual flight distance', () => {
  test('stores a distance typed in miles and clears it again', async ({
    page,
  }) => {
    const { user } = await usersFactory.create();
    await preferencesFactory.set(user.id, { distanceUnit: 'mi' });
    await login(page, user);

    const { airport } = await airportsFactory.getOrCreate({
      icao: 'EKRK',
      name: 'Roskilde Airport',
      municipality: 'Roskilde',
      lat: 55.586,
      lon: 12.131,
      country: 'DK',
      continent: 'EU',
      tz: 'Europe/Copenhagen',
      type: 'medium_airport',
      iata: 'RKE',
    });
    const { flight } = await flightsFactory.create({
      userId: user.id,
      date: '2026-09-27',
      fromId: airport.id,
      toId: airport.id,
      departure: '2026-09-27T10:00:00.000Z',
      arrival: '2026-09-27T11:00:00.000Z',
      duration: 3600,
    });

    await page.goto('/');
    let modal = await openEditFlightModal(page);
    const distance = modal.getByRole('spinbutton', { name: 'Distance' });
    await expect(distance).toHaveAttribute('placeholder', '0');

    await distance.fill('66');
    await modal.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Flight updated successfully')).toBeVisible();
    await expect.poll(() => storedDistance(flight.id)).toBeCloseTo(106.2, 1);

    await page.keyboard.press('Escape');
    await page.reload();
    modal = await openEditFlightModal(page);
    await expect(
      modal.getByRole('spinbutton', { name: 'Distance' }),
    ).toHaveValue('66');

    await modal.getByRole('spinbutton', { name: 'Distance' }).clear();
    await modal.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Flight updated successfully')).toBeVisible();
    await expect.poll(() => storedDistance(flight.id)).toBeNull();
  });
});
