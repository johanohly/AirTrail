import { airportsFactory } from '@test/factories/airports';
import { flightsFactory } from '@test/factories/flights';
import { usersFactory } from '@test/factories/users';
import { login } from '@test/helpers/auth';
import { withinModal } from '@test/helpers/modal';
import { expect, test } from '@test/index';

test.describe('Delete Flight', () => {
  test('can delete a flight from the list', async ({ page }) => {
    const { user } = await usersFactory.create();
    await login(page, user);

    // Get or create test airports
    const { airport: fromAirport } = await airportsFactory.getOrCreate({
      icao: 'KJFK',
      name: 'John F Kennedy International Airport',
      municipality: 'New York',
      lat: 40.6413,
      lon: -73.7781,
      country: 'US',
      continent: 'NA',
      tz: 'America/New_York',
      type: 'large_airport',
      iata: 'JFK',
    });

    const { airport: toAirport } = await airportsFactory.getOrCreate({
      icao: 'EGLL',
      name: 'London Heathrow Airport',
      municipality: 'London',
      lat: 51.47,
      lon: -0.4543,
      country: 'GB',
      continent: 'EU',
      tz: 'Europe/London',
      type: 'large_airport',
      iata: 'LHR',
    });

    // Create a test flight
    const { flight } = await flightsFactory.create({
      userId: user.id,
      date: '2024-01-15',
      fromId: fromAirport.id,
      toId: toAirport.id,
      departure: '2024-01-15T10:00:00.000Z',
      arrival: '2024-01-15T22:00:00.000Z',
      duration: 43200, // 12 hours in seconds
      flightNumber: 'BA100',
    });

    await page.goto('/');

    // Open flights list modal
    await page.getByTestId('list-flights-button').click();

    await withinModal(
      async (modal) => {
        // Verify the flight is in the list
        await expect(
          modal.getByText(/JFK|EGLL|LHR|BA100/i).first(),
        ).toBeVisible({ timeout: 5000 });

        // Find the delete button for this flight
        // The delete button is an X icon button within the flight card
        const flightCard = modal
          .locator('div[class*="bg-card"]')
          .filter({ hasText: /JFK|EGLL|LHR|BA100/i })
          .first();

        // Wait for the card to be visible
        await expect(flightCard).toBeVisible({ timeout: 5000 });

        // Find all buttons in the card and click the last one
        const allButtons = flightCard.locator('button');

        // The delete button is the last button in the actions area
        await allButtons.last().click();

        // Confirm deletion in the confirmation dialog
        await page
          .locator('input[id="confirmation"]')
          .fill(`${fromAirport.iata}-${toAirport.iata}`);

        // Click confirm button
        await page.getByRole('button', { name: 'Delete flight' }).click();

        // Wait for success toast
        await expect(page.getByText(/flight deleted/i)).toBeVisible({
          timeout: 10000,
        });

        // Wait a bit for the list to update
        await page.waitForTimeout(1000);

        // The flight should be removed from the list
        const flightText = modal.getByText(/JFK.*LHR|LHR.*JFK|BA100/i);
        if ((await flightText.count()) > 0) {
          await expect(flightText).not.toBeVisible({ timeout: 5000 });
        }
      },
      { page, assertClosed: false },
    );
  });

  test('can cancel flight deletion', async ({ page }) => {
    const { user } = await usersFactory.create();
    await login(page, user);

    // Get or create test airports
    const { airport: fromAirport } = await airportsFactory.getOrCreate({
      icao: 'KMIA',
      name: 'Miami International Airport',
      municipality: 'Miami',
      lat: 25.7959,
      lon: -80.287,
      country: 'US',
      continent: 'NA',
      tz: 'America/New_York',
      type: 'large_airport',
      iata: 'MIA',
    });

    const { airport: toAirport } = await airportsFactory.getOrCreate({
      icao: 'OMDB',
      name: 'Dubai International Airport',
      municipality: 'Dubai',
      lat: 25.2532,
      lon: 55.3657,
      country: 'AE',
      continent: 'AS',
      tz: 'Asia/Dubai',
      type: 'large_airport',
      iata: 'DXB',
    });

    // Create a test flight
    const { flight } = await flightsFactory.create({
      userId: user.id,
      date: '2024-02-20',
      fromId: fromAirport.id,
      toId: toAirport.id,
      departure: '2024-02-20T14:00:00.000Z',
      arrival: '2024-02-21T02:00:00.000Z',
      duration: 43200,
    });

    await page.goto('/');

    // Open flights list modal
    await page.getByTestId('list-flights-button').click();

    await withinModal(
      async (modal) => {
        // Wait for the flights modal content to be visible
        await expect(modal.getByText(/all flights/i)).toBeVisible({
          timeout: 5000,
        });

        // Verify the flight is in the list
        await expect(modal.getByText(/MIA|DXB|OMDB/i).first()).toBeVisible({
          timeout: 5000,
        });

        // Find and click delete button
        const flightCard = modal
          .locator('div[class*="bg-card"]')
          .filter({ hasText: /MIA|DXB|OMDB/i })
          .first();

        await expect(flightCard).toBeVisible({ timeout: 5000 });

        // Find the delete button (last button in the card is the delete button)
        const allButtons = flightCard.locator('button');

        await allButtons.last().click();

        // Click cancel button
        await page.getByRole('button', { name: 'Cancel' }).click();

        // Verify the flight is still in the list
        await expect(modal.getByText(/MIA|DXB|OMDB/i).first()).toBeVisible({
          timeout: 5000,
        });
      },
      { page, assertClosed: false },
    );
  });
});
