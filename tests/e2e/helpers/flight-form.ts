import { expect, type Locator, type Page } from '@playwright/test';

import { fillDateField, fillTimeField } from './datetime';

export type AirportRef = {
  id: number;
  icao: string;
  iata?: string | null;
  name: string;
};

export const openAddFlightModal = async (page: Page): Promise<Locator> => {
  await page.getByTestId('add-flight-button').click();
  const modal = page.getByRole('dialog').filter({ hasText: /new flight/i });
  await expect(modal).toBeVisible();
  return modal;
};

export const pickAirport = async (
  page: Page,
  modal: Locator,
  field: 'From' | 'To',
  airport: AirportRef,
) => {
  const input = modal
    .locator('input[placeholder="Choose an airport"]')
    .nth(field === 'From' ? 0 : 1);
  await input.click();
  await input.fill(airport.iata ?? airport.icao);
  const option = page.getByText(airport.icao, { exact: true }).first();
  await expect(option).toBeVisible({ timeout: 10000 });
  await option.click();
};

/**
 * Locate the scope for one DateTimeField (the wrapping element tagged with
 * `data-testid="datetime-departure"` / `"datetime-arrival"`).
 */
export const datetimeField = (modal: Locator, field: 'departure' | 'arrival') =>
  modal.locator(`[data-testid="datetime-${field}"]`);

export type DateTimeInput = {
  date: string; // YYYY-MM-DD
  time?: string; // '22:30' or '10:30 pm'
};

export const setDateTime = async (
  modal: Locator,
  field: 'departure' | 'arrival',
  value: DateTimeInput,
) => {
  const scope = datetimeField(modal, field);
  await fillDateField(scope, value.date);
  if (value.time) await fillTimeField(scope, value.time);
};

export const submitFlightForm = async (page: Page, modal: Locator) => {
  await modal.getByRole('button', { name: /add flight/i }).click();
  await expect(page.getByText(/flight added/i)).toBeVisible({ timeout: 10000 });
};

/**
 * Open the ListFlightsModal and click the edit button on the first (only)
 * flight row. Asserts the edit modal is visible and returns it.
 */
export const openEditFlightModal = async (page: Page): Promise<Locator> => {
  await page.getByTestId('list-flights-button').click();
  await expect(page.getByText(/all flights/i)).toBeVisible({ timeout: 5000 });
  // `ListFlightsModal` wraps the edit trigger in `{#key flight}` and remaps
  // flight objects every derivation, so the button detaches+reattaches on
  // any upstream tick — Playwright's actionability wait never sees stability.
  // Dispatch the click event directly to bypass pointer simulation.
  await page.getByTestId('edit-flight-button').first().dispatchEvent('click');
  const modal = page.getByRole('dialog').filter({ hasText: /edit flight/i });
  await expect(modal).toBeVisible();
  return modal;
};

/**
 * Read the wall-clock displayed by a DateTimeField as `{ date, time }`,
 * where date is ISO (YYYY-MM-DD) and time is 24h HH:mm. Returns each piece
 * verbatim from the rendered segments — no parsing-time conversions, so
 * tests can assert exactly what the user sees.
 */
export const readDateTime = async (
  modal: Locator,
  field: 'departure' | 'arrival',
): Promise<{ date: string; time: string }> => {
  const scope = datetimeField(modal, field);
  const text = (sel: string) => scope.locator(sel).textContent();
  const [y, mo, d, h, mi] = await Promise.all([
    text('[data-segment="year"]'),
    text('[data-segment="month"]'),
    text('[data-segment="day"]'),
    text('[data-segment="hour"]'),
    text('[data-segment="minute"]'),
  ]);
  return {
    date: `${y?.trim()}-${mo?.trim().padStart(2, '0')}-${d?.trim().padStart(2, '0')}`,
    time: `${h?.trim().padStart(2, '0')}:${mi?.trim().padStart(2, '0')}`,
  };
};
