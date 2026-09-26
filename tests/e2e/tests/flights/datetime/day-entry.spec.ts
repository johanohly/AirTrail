import { usersFactory } from '@test/factories/users';
import { login } from '@test/helpers/auth';
import { fillDateField } from '@test/helpers/datetime';
import { datetimeField, openAddFlightModal } from '@test/helpers/flight-form';
import { expect, test } from '@test/index';

// The date field's placeholder is today, so pin today to a 30-day month in a
// non-leap year to check that the day segment isn't limited by it.
test.describe('Date field day entry', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-09-15T12:00:00Z'));
    const { user } = await usersFactory.create();
    await login(page, user);
  });

  const segmentText = async (scope: ReturnType<typeof datetimeField>) => {
    const text = (part: string) =>
      scope.locator(`[data-segment="${part}"]`).textContent();
    const [y, m, d] = await Promise.all([
      text('year'),
      text('month'),
      text('day'),
    ]);
    return `${y?.trim()}-${m?.trim().padStart(2, '0')}-${d?.trim().padStart(2, '0')}`;
  };

  test('accepts day 31 before the month is typed', async ({ page }) => {
    const modal = await openAddFlightModal(page);
    const scope = datetimeField(modal, 'departure');

    await fillDateField(scope, '2025-12-31');

    expect(await segmentText(scope)).toBe('2025-12-31');
  });

  test('keeps a leap day typed before its year', async ({ page }) => {
    const modal = await openAddFlightModal(page);
    const scope = datetimeField(modal, 'departure');

    await fillDateField(scope, '2024-02-29');

    expect(await segmentText(scope)).toBe('2024-02-29');
  });

  test('accepts a leap day in a leap year', async ({ page }) => {
    const modal = await openAddFlightModal(page);
    const scope = datetimeField(modal, 'departure');

    for (const [part, digits] of [
      ['year', '2024'],
      ['month', '02'],
      ['day', '29'],
    ]) {
      const segment = scope.locator(`[data-segment="${part}"]`);
      await segment.focus();
      for (const ch of digits) await segment.press(ch);
    }

    expect(await segmentText(scope)).toBe('2024-02-29');
  });
});
