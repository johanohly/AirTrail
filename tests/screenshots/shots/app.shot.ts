import {
  openAddFlightModal,
  pickAirport,
  setDateTime,
} from '../../e2e/helpers/flight-form';
import { expect, test } from '../support/shot';

test('hero', async ({ page, openAs, waitForMap, capture }) => {
  await page.setViewportSize({ width: 1280, height: 648 });
  await openAs('maya');
  await waitForMap();
  await capture('hero');
});

test('map-overview', async ({ openAs, waitForMap, capture }) => {
  await openAs('maya');
  await waitForMap();
  await capture('map-overview');
});

test('add-flight', async ({ page, openAs, waitForMap, capture }) => {
  // Room for the whole form plus the margin around the modal.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openAs('maya');
  await waitForMap();
  const dialog = await openAddFlightModal(page);
  await dialog.locator('input').first().fill('SK909');
  await pickAirport(page, dialog, 'From', {
    id: 0,
    icao: 'EKCH',
    iata: 'CPH',
    name: '',
  });
  await pickAirport(page, dialog, 'To', {
    id: 0,
    icao: 'KJFK',
    iata: 'JFK',
    name: '',
  });
  await setDateTime(dialog, 'departure', { date: '2026-07-02', time: '12:10' });
  await setDateTime(dialog, 'arrival', { date: '2026-07-02', time: '14:40' });
  await dialog.getByRole('button', { name: 'Window', exact: true }).click();
  await dialog.getByPlaceholder('e.g. 12A').fill('32A');
  await dialog.getByRole('button', { name: 'Class', exact: true }).click();
  await page.getByRole('option', { name: 'Economy', exact: true }).click();
  await dialog.getByRole('button', { name: 'Reason', exact: true }).click();
  await page.getByRole('option', { name: 'Leisure', exact: true }).click();
  await expect(
    dialog.getByRole('button', { name: 'Reason', exact: true }),
  ).toHaveText('Leisure');
  const airline = dialog.getByPlaceholder('Select airline');
  await airline.click();
  await airline.pressSequentially('SAS', { delay: 50 });
  await page.getByRole('option').filter({ hasText: 'SAS' }).first().click();
  await expect(airline).toHaveAttribute('aria-expanded', 'false');
  const aircraft = dialog.getByPlaceholder('Select aircraft');
  await aircraft.click();
  await aircraft.pressSequentially('A330-300', { delay: 50 });
  await page
    .getByRole('option')
    .filter({ hasText: 'A330-300' })
    .first()
    .click();
  await expect(aircraft).toHaveAttribute('aria-expanded', 'false');
  await dialog.getByLabel('Registration').fill('LN-RKH');
  await page.mouse.move(0, 0);
  await capture('add-flight', { dialog });
});

// Full-screen modals are captured with the whole viewport.
test('flight-list', async ({ page, openAs, waitForMap, capture }) => {
  await openAs('maya');
  await waitForMap();
  await page.getByTestId('list-flights-button').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await capture('flight-list');
});

test('statistics', async ({ page, openAs, waitForMap, capture }) => {
  await openAs('maya');
  await waitForMap();
  await page.getByTestId('statistics-button').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await capture('statistics');
});

test('visited-countries', async ({ openAs, capture, waitForMap }) => {
  await openAs('maya', '/visited-countries');
  await waitForMap();
  await capture('visited-countries');
});

// The public page, seen by someone who isn't logged in.
test('share-page', async ({ page, waitForMap, capture }) => {
  await page.goto('/share/maya-travels');
  await waitForMap();
  await capture('share-page');
});
