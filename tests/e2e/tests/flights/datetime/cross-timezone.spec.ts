import { airportsFactory } from '@test/factories/airports';
import { preferencesFactory } from '@test/factories/preferences';
import { usersFactory } from '@test/factories/users';
import { JFK, LHR } from '@test/fixtures/airports';
import { isoInstant, latestFlightFor } from '@test/helpers/flight-db';
import { login } from '@test/helpers/auth';
import {
  openAddFlightModal,
  pickAirport,
  setDateTime,
  submitFlightForm,
} from '@test/helpers/flight-form';
import { expect, test } from '@test/index';

test.describe('Cross-timezone flight times', () => {
  // Pin the browser TZ so editTz=='system' tests exercise a real offset gap
  // versus the airport TZ. With UTC, system==airport==UTC and nothing diverges.
  test.use({ timezoneId: 'Europe/Stockholm' });

  test('flightTimeDisplay=airport: stored ISO uses each airport offset', async ({
    page,
  }) => {
    const { user } = await usersFactory.create();
    await preferencesFactory.set(user.id, {
      timeFormat: '24h',
      dateFormat: 'iso',
      flightTimeDisplay: 'airport',
    });
    await login(page, user);

    const { airport: from } = await airportsFactory.getOrCreate(JFK);
    const { airport: to } = await airportsFactory.getOrCreate(LHR);

    const modal = await openAddFlightModal(page);
    await pickAirport(page, modal, 'From', from);
    await pickAirport(page, modal, 'To', to);

    // User types JFK-local times because flightTimeDisplay='airport'.
    await setDateTime(modal, 'departure', {
      date: '2024-01-15',
      time: '22:30',
    });
    await setDateTime(modal, 'arrival', { date: '2024-01-16', time: '10:00' });
    await submitFlightForm(page, modal);

    const flight = await latestFlightFor(user.id, from.id, to.id);

    // JFK is EST in January (UTC-5): 22:30 EST = 03:30 UTC next day.
    expect(isoInstant(flight.departure)).toBe('2024-01-16T03:30:00.000Z');
    // LHR is GMT in January (UTC+0): 10:00 local = 10:00 UTC.
    expect(isoInstant(flight.arrival)).toBe('2024-01-16T10:00:00.000Z');
    // `date` is the airport-local date for the departure airport.
    expect(flight.date).toBe('2024-01-15');
  });

  test('flightTimeDisplay=utc: same inputs interpreted as UTC', async ({
    page,
  }) => {
    const { user } = await usersFactory.create();
    await preferencesFactory.set(user.id, {
      timeFormat: '24h',
      dateFormat: 'iso',
      flightTimeDisplay: 'utc',
    });
    await login(page, user);

    const { airport: from } = await airportsFactory.getOrCreate(JFK);
    const { airport: to } = await airportsFactory.getOrCreate(LHR);

    const modal = await openAddFlightModal(page);
    await pickAirport(page, modal, 'From', from);
    await pickAirport(page, modal, 'To', to);

    // Same wall-clock the user types — but interpreted as UTC, not JFK/LHR.
    await setDateTime(modal, 'departure', {
      date: '2024-01-15',
      time: '22:30',
    });
    await setDateTime(modal, 'arrival', { date: '2024-01-16', time: '10:00' });
    await submitFlightForm(page, modal);

    const flight = await latestFlightFor(user.id, from.id, to.id);
    expect(isoInstant(flight.departure)).toBe('2024-01-15T22:30:00.000Z');
    expect(isoInstant(flight.arrival)).toBe('2024-01-16T10:00:00.000Z');
  });

  test('12h time format accepts pm input', async ({ page }) => {
    const { user } = await usersFactory.create();
    await preferencesFactory.set(user.id, {
      timeFormat: '12h',
      dateFormat: 'iso',
      flightTimeDisplay: 'airport',
    });
    await login(page, user);

    const { airport: from } = await airportsFactory.getOrCreate(JFK);
    const { airport: to } = await airportsFactory.getOrCreate(LHR);

    const modal = await openAddFlightModal(page);
    await pickAirport(page, modal, 'From', from);
    await pickAirport(page, modal, 'To', to);

    await setDateTime(modal, 'departure', {
      date: '2024-01-15',
      time: '10:30 pm',
    });
    await setDateTime(modal, 'arrival', {
      date: '2024-01-16',
      time: '10:00 am',
    });
    await submitFlightForm(page, modal);

    const flight = await latestFlightFor(user.id, from.id, to.id);
    // 10:30 pm EST = 03:30 UTC next day.
    expect(isoInstant(flight.departure)).toBe('2024-01-16T03:30:00.000Z');
    expect(isoInstant(flight.arrival)).toBe('2024-01-16T10:00:00.000Z');
  });
});
