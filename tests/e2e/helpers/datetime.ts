import type { Locator } from '@playwright/test';

/**
 * Drive a bits-ui DateField. Pass `dateIso` as YYYY-MM-DD; segments are
 * targeted by their `data-segment` attribute so the user's date-format
 * preference doesn't affect the test.
 */
export const fillDateField = async (scope: Locator, dateIso: string) => {
  const [year, month, day] = dateIso.split('-');
  await typeSegment(scope.locator('[data-segment="day"]'), day);
  await typeSegment(scope.locator('[data-segment="month"]'), month);
  await typeSegment(scope.locator('[data-segment="year"]'), year);
};

/**
 * Drive a bits-ui TimeField. `text` is what the user types:
 *   24h: '22:30'
 *   12h: '10:30 pm'  (case-insensitive)
 */
export const fillTimeField = async (scope: Locator, text: string) => {
  const period = text.match(/(am|pm)\s*$/i)?.[1].toLowerCase();
  const [h, m] = text.replace(/\s*(am|pm)\s*$/i, '').split(':');
  await typeSegment(scope.locator('[data-segment="hour"]'), h.padStart(2, '0'));
  await typeSegment(
    scope.locator('[data-segment="minute"]'),
    m.padStart(2, '0'),
  );
  if (period) {
    const seg = scope.locator('[data-segment="dayPeriod"]');
    if ((await seg.count()) > 0) {
      await seg.focus();
      await seg.press(period === 'pm' ? 'p' : 'a');
    }
  }
};

const typeSegment = async (seg: Locator, digits: string) => {
  await seg.focus();
  for (const ch of digits) await seg.press(ch);
};
