import { airportsFactory } from '@test/factories/airports';
import { preferencesFactory } from '@test/factories/preferences';
import { usersFactory } from '@test/factories/users';
import { JFK, LHR } from '@test/fixtures/airports';
import { login } from '@test/helpers/auth';
import { isoInstant, latestFlightFor } from '@test/helpers/flight-db';
import {
  openAddFlightModal,
  openEditFlightModal,
  pickAirport,
  readDateTime,
  setDateTime,
  submitFlightForm,
} from '@test/helpers/flight-form';
import { expect, test } from '@test/index';

// All tests in this file use `flightTimeDisplay='airport'` so the user enters
// JFK-local wall-clocks at the departure side. Browser TZ is pinned to UTC to
// rule out any system-tz contribution — only America/New_York's DST behaviour
// is exercised here.
test.describe('DST edge cases (America/New_York)', () => {
  test.use({ timezoneId: 'UTC' });

  const setup = async (page: Parameters<typeof login>[0]) => {
    const { user } = await usersFactory.create();
    await preferencesFactory.set(user.id, {
      timeFormat: '24h',
      dateFormat: 'iso',
      flightTimeDisplay: 'airport',
    });
    await login(page, user);
    const { airport: from } = await airportsFactory.getOrCreate(JFK);
    const { airport: to } = await airportsFactory.getOrCreate(LHR);
    return { user, from, to };
  };

  test('spring forward: non-existent local time 02:30 stores deterministically', async ({
    page,
  }) => {
    // 2024-03-10 02:00–02:59 in NYC does not exist — clocks jump from
    // 01:59:59 EST (UTC-5) straight to 03:00:00 EDT (UTC-4). date-fns/tz
    // resolves a non-existent wall-clock by applying the pre-transition
    // offset, so 02:30 is interpreted as `02:30 EST` = 07:30 UTC.
    const { user, from, to } = await setup(page);

    const modal = await openAddFlightModal(page);
    await pickAirport(page, modal, 'From', from);
    await pickAirport(page, modal, 'To', to);
    await setDateTime(modal, 'departure', {
      date: '2024-03-10',
      time: '02:30',
    });
    await setDateTime(modal, 'arrival', { date: '2024-03-10', time: '14:00' });
    await submitFlightForm(page, modal);

    const flight = await latestFlightFor(user.id, from.id, to.id);
    // 02:30 EST → 07:30 UTC. Re-read in NYC local this is 03:30 EDT, i.e.
    // the user's input is silently shifted forward by 1h on the round-trip.
    expect(isoInstant(flight.departure)).toBe('2024-03-10T07:30:00.000Z');
    // 14:00 in LHR on 2024-03-10 — UK is still on GMT (BST starts Mar 31).
    expect(isoInstant(flight.arrival)).toBe('2024-03-10T14:00:00.000Z');
    // Duration math should reflect the actual instants, not the wall-clocks:
    // 07:30Z → 14:00Z = 6.5h = 23400s.
    expect(flight.duration).toBe(23_400);
  });

  test('spring forward: round-trip displays the shifted wall-clock (03:30, not 02:30)', async ({
    page,
  }) => {
    // The user typed 02:30 but that instant doesn't exist locally; the
    // stored instant lands on the EDT side of the gap, so on re-open the
    // form must honestly display 03:30 EDT. If this regresses to 02:30 it
    // means the round-trip is lossy — the form would round-trip to a
    // different absolute time than what was stored.
    const { from, to } = await setup(page);
    // (no DB read in this test — round-trip is asserted via the UI segments.)

    const modal = await openAddFlightModal(page);
    await pickAirport(page, modal, 'From', from);
    await pickAirport(page, modal, 'To', to);
    await setDateTime(modal, 'departure', {
      date: '2024-03-10',
      time: '02:30',
    });
    await setDateTime(modal, 'arrival', { date: '2024-03-10', time: '14:00' });
    await submitFlightForm(page, modal);

    const editModal = await openEditFlightModal(page);
    const displayed = await readDateTime(editModal, 'departure');
    expect(displayed.date).toBe('2024-03-10');
    expect(displayed.time).toBe('03:30');
  });

  test('fall back: ambiguous local time 01:30 picks the earlier (EDT) occurrence', async ({
    page,
  }) => {
    // 2024-11-03 01:30 in NYC happens twice — once as EDT (UTC-4, the
    // earlier instant) and once as EST (UTC-5, an hour later). date-fns/tz
    // disambiguates by picking the *earlier* offset, so 01:30 → 05:30 UTC.
    // If this ever flips to 06:30 UTC the test will catch it — both are
    // valid choices but the codebase must commit to one consistently.
    const { user, from, to } = await setup(page);

    const modal = await openAddFlightModal(page);
    await pickAirport(page, modal, 'From', from);
    await pickAirport(page, modal, 'To', to);
    await setDateTime(modal, 'departure', {
      date: '2024-11-03',
      time: '01:30',
    });
    // LHR transitioned to GMT on Oct 27, so 14:00 LHR = 14:00 UTC.
    await setDateTime(modal, 'arrival', { date: '2024-11-03', time: '14:00' });
    await submitFlightForm(page, modal);

    const flight = await latestFlightFor(user.id, from.id, to.id);
    expect(isoInstant(flight.departure)).toBe('2024-11-03T05:30:00.000Z');
    expect(isoInstant(flight.arrival)).toBe('2024-11-03T14:00:00.000Z');
    // 05:30Z → 14:00Z = 8.5h = 30600s. Had it stored 06:30Z (the EST
    // interpretation) duration would be 27000s instead — useful sanity
    // check that the disambiguation flowed through duration math.
    expect(flight.duration).toBe(30_600);
  });
});
