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
// The desktop list intentionally uses a compact short-month date even when
// dateFormat=iso. The clock and timezone still follow the user's preferences.
// Expected rendered wall-clocks (timeFormat=24h, dateFormat=iso):
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

// The same route, now with recorded scheduled times, exercising the
// flightTimeSource preference: which pair of instants the list displays,
// and the delay tooltip (six times: scheduled + actual in each timezone).
//
// Departure: actual 2024-01-16T03:30Z / scheduled 03:00Z  (30m late)
// Arrival:   actual 2024-01-16T10:00Z / scheduled 09:40Z  (20m early)
// In airport display mode (JFK = EST, UTC−5; LHR = GMT):
//   dep actual "Jan 15, 22:30"  / scheduled "Jan 15, 22:00"
//   arr actual "Jan 16, 10:00"  / scheduled "Jan 16, 09:40"
// A second flight without scheduled times always falls back to actual.
test.describe('Flight list actual vs scheduled source', () => {
  test.use({ timezoneId: 'Europe/Stockholm' });

  const seed = async (
    page: Parameters<typeof login>[0],
    source: 'actual' | 'scheduled',
  ) => {
    const { user } = await usersFactory.create();
    await preferencesFactory.set(user.id, {
      timeFormat: '24h',
      dateFormat: 'iso',
      flightTimeDisplay: 'airport',
      flightTimeSource: source,
    });
    const { airport: from } = await airportsFactory.getOrCreate(JFK);
    const { airport: to } = await airportsFactory.getOrCreate(LHR);
    await flightsFactory.create({
      userId: user.id,
      date: '2024-01-15',
      fromId: from.id,
      toId: to.id,
      departure: '2024-01-16T03:30:00.000Z',
      departureScheduled: '2024-01-16T03:00:00.000Z',
      arrival: '2024-01-16T10:00:00.000Z',
      arrivalScheduled: '2024-01-16T09:40:00.000Z',
      duration: 23_400,
    });
    await flightsFactory.create({
      userId: user.id,
      date: '2024-01-14',
      fromId: from.id,
      toId: to.id,
      departure: '2024-01-15T03:30:00.000Z',
      arrival: '2024-01-15T10:00:00.000Z',
      duration: 23_400,
    });
    await login(page, user);
  };

  const openListAndRead = async (page: Parameters<typeof login>[0]) => {
    await page.getByTestId('list-flights-button').click();
    await expect(page.getByText(/all flights/i)).toBeVisible({ timeout: 5000 });
    // Sorted by departure desc, so the flight with scheduled times is first.
    const dep = page.getByTestId('flight-time-departure').first();
    const arr = page.getByTestId('flight-time-arrival').first();
    await expect(dep).toBeVisible();
    return { dep, arr };
  };

  test('scheduled: shows scheduled times and falls back to actual', async ({
    page,
  }) => {
    await seed(page, 'scheduled');
    const { dep, arr } = await openListAndRead(page);
    await expect(dep).toContainText('Jan 15, 22:00');
    await expect(arr).toContainText('09:40');
    // Scheduled display is neutral — the delay lives in the tooltip.
    await expect(dep.locator('.text-red-600')).toHaveCount(0);
    await expect(dep.locator('.text-green-600')).toHaveCount(0);

    // The older flight has no scheduled times and keeps its actual times.
    const fallbackDep = page.getByTestId('flight-time-departure').nth(1);
    await expect(fallbackDep).toContainText('Jan 14, 22:30');
    const fallbackArr = page.getByTestId('flight-time-arrival').nth(1);
    await expect(fallbackArr).toContainText('10:00');
  });

  test('tooltip: shows all six times split by the delay', async ({ page }) => {
    await seed(page, 'actual');
    const { dep } = await openListAndRead(page);
    await dep.hover();

    const tooltip = page.getByTestId('time-display-tooltip');
    await expect(tooltip).toBeVisible();
    await expect(page.getByTestId('time-tooltip-delay')).toHaveText('30m late');
    // Scheduled and actual sections, each with airport/UTC/system rows.
    await expect(tooltip).toContainText('Scheduled');
    await expect(tooltip).toContainText('Actual');
    // JFK-local wall clocks: scheduled 22:00, actual 22:30.
    await expect(tooltip).toContainText('22:00');
    await expect(tooltip).toContainText('22:30');
  });
});
