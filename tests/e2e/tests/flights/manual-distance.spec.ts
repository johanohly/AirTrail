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

const ROSKILDE = {
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
} as const;

const ARLANDA = {
  icao: 'ESSA',
  name: 'Stockholm-Arlanda Airport',
  municipality: 'Stockholm',
  lat: 59.652,
  lon: 17.919,
  country: 'SE',
  continent: 'EU',
  tz: 'Europe/Stockholm',
  type: 'large_airport',
  iata: 'ARN',
} as const;

test.describe('Manual flight distance', () => {
  test('stores a distance typed in miles and clears it again', async ({
    page,
  }) => {
    const { user } = await usersFactory.create();
    await preferencesFactory.set(user.id, { distanceUnit: 'mi' });
    await login(page, user);

    const { airport } = await airportsFactory.getOrCreate(ROSKILDE);
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

  test('hides the field behind a link on a flight between two airports', async ({
    page,
  }) => {
    const { user } = await usersFactory.create();
    await login(page, user);

    const { airport: from } = await airportsFactory.getOrCreate(ROSKILDE);
    const { airport: to } = await airportsFactory.getOrCreate(ARLANDA);
    const { flight } = await flightsFactory.create({
      userId: user.id,
      date: '2026-09-28',
      fromId: from.id,
      toId: to.id,
      departure: '2026-09-28T10:00:00.000Z',
      arrival: '2026-09-28T11:30:00.000Z',
      duration: 5400,
    });

    await page.goto('/');
    let modal = await openEditFlightModal(page);
    const distance = modal.getByRole('spinbutton', { name: 'Distance' });
    await expect(distance).toHaveCount(0);

    await modal.getByRole('button', { name: 'Set distance' }).click();
    await expect(distance).toBeFocused();
    await expect(distance).toHaveAttribute('placeholder', /^\d+$/);

    await distance.fill('700');
    await modal.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Flight updated successfully')).toBeVisible();
    await expect.poll(() => storedDistance(flight.id)).toBe(700);

    await page.keyboard.press('Escape');
    await page.reload();
    modal = await openEditFlightModal(page);
    await expect(
      modal.getByRole('spinbutton', { name: 'Distance' }),
    ).toHaveValue('700');
    await expect(
      modal.getByRole('button', { name: 'Set distance' }),
    ).toHaveCount(0);
  });
});
