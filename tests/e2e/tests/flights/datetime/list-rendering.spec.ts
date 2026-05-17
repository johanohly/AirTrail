import { airportsFactory } from '@test/factories/airports';
import { flightsFactory } from '@test/factories/flights';
import { preferencesFactory } from '@test/factories/preferences';
import { usersFactory } from '@test/factories/users';
import { JFK, LHR } from '@test/fixtures/airports';
import { login } from '@test/helpers/auth';
import { expect, test } from '@test/index';

// One canonical flight, varied across `flightTimeDisplay` prefs without
// re-entering data. This isolates the rendering layer in ListFlightsModal:
// same DB row, three different rendered wall-clocks. If any of these assertions
// drift, the bug is in TimeDisplay / formatting — not in input/storage.
//
// Flight: JFK → LHR on 2024-01-15 (no DST anywhere relevant).
//   Stored departure: 2024-01-16T03:30:00Z   (22:30 EST on Jan 15)
//   Stored arrival:   2024-01-16T10:00:00Z   (10:00 GMT)
//
// Expected rendered wall-clocks (locale en-US, timeFormat=24h):
//   airport: dep "Jan 15, 22:30" (JFK)  | arr "Jan 16, 10:00" (LHR)
//   utc:     dep "Jan 16, 03:30"        | arr "Jan 16, 10:00"
//   system:  dep "Jan 16, 04:30"        | arr "Jan 16, 11:00"  (Stockholm = CET, UTC+1)
test.describe('Flight list time rendering', () => {
  test.use({ timezoneId: 'Europe/Stockholm' });

  const seed = async (
    page: Parameters<typeof login>[0],
    display: 'airport' | 'utc' | 'system',
  ) => {
    const { user } = await usersFactory.create();
    await preferencesFactory.set(user.id, {
      timeFormat: '24h',
      dateFormat: 'iso',
      flightTimeDisplay: display,
    });
    const { airport: from } = await airportsFactory.getOrCreate(JFK);
    const { airport: to } = await airportsFactory.getOrCreate(LHR);
    await flightsFactory.create({
      userId: user.id,
      date: '2024-01-15',
      fromId: from.id,
      toId: to.id,
      departure: '2024-01-16T03:30:00.000Z',
      arrival: '2024-01-16T10:00:00.000Z',
      duration: 23_400,
    });
    await login(page, user);
  };

  const openListAndRead = async (page: Parameters<typeof login>[0]) => {
    await page.getByTestId('list-flights-button').click();
    await expect(page.getByText(/all flights/i)).toBeVisible({ timeout: 5000 });
    const dep = page.getByTestId('flight-time-departure').first();
    const arr = page.getByTestId('flight-time-arrival').first();
    await expect(dep).toBeVisible();
    return { dep, arr };
  };

  test('airport: shows each endpoint in its airport-local time', async ({
    page,
  }) => {
    await seed(page, 'airport');
    const { dep, arr } = await openListAndRead(page);
    await expect(dep).toContainText('22:30');
    await expect(dep).toContainText('Jan 15');
    await expect(arr).toContainText('10:00');
    await expect(arr).toContainText('Jan 16');
  });

  test('utc: shows both endpoints in UTC', async ({ page }) => {
    await seed(page, 'utc');
    const { dep, arr } = await openListAndRead(page);
    await expect(dep).toContainText('03:30');
    await expect(dep).toContainText('Jan 16');
    await expect(arr).toContainText('10:00');
    await expect(arr).toContainText('Jan 16');
  });

  test('system: shows both endpoints in the browser timezone (CET, UTC+1)', async ({
    page,
  }) => {
    await seed(page, 'system');
    const { dep, arr } = await openListAndRead(page);
    await expect(dep).toContainText('04:30');
    await expect(dep).toContainText('Jan 16');
    await expect(arr).toContainText('11:00');
    await expect(arr).toContainText('Jan 16');
  });
});
