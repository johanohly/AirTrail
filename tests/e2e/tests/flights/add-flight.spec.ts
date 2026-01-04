import { airportsFactory } from '@test/factories/airports';
import { usersFactory } from '@test/factories/users';
import { login } from '@test/helpers/auth';
import { withinModal } from '@test/helpers/modal';
import { expect, test } from '@test/index';

test.describe('Add Flight', () => {
  test('can add a flight with required fields', async ({ page }) => {
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

    await page.goto('/');

    // Open add flight modal by clicking the "Add flight" button in the dock
    await page.getByTestId('add-flight-button').click();

    await withinModal(
      async (modal) => {
        // Fill in departure airport - search for JFK
        // Find the "From" field by label, then find the input within that form field
        await modal.getByText(/^From \*$/i).waitFor({ timeout: 5000 });
        const fromField = modal
          .locator('input[placeholder="Select an airport"]')
          .first();
        await fromField.click();
        await fromField.fill(fromAirport.iata);

        // Wait for dropdown to appear and select the airport
        await page.waitForTimeout(500); // Wait for debounce
        await expect(page.getByText(fromAirport.name)).toBeVisible({
          timeout: 10000,
        });
        await page.getByText(fromAirport.name).first().click();

        // Fill in arrival airport - search for LHR
        await modal.getByText(/^To \*$/i).waitFor({ timeout: 5000 });
        const toField = modal
          .locator('input[placeholder="Select an airport"]')
          .nth(1);
        await toField.click();
        await toField.fill(toAirport.iata);

        // Wait for dropdown and select the airport
        await page.waitForTimeout(500); // Wait for debounce
        await expect(page.getByText(toAirport.name)).toBeVisible({
          timeout: 10000,
        });
        await page.getByText(toAirport.name).first().click();

        // Fill in departure date - use the hidden input field
        // The form uses a hidden input with name="departure" that stores the ISO datetime string
        const departureDate = new Date('2024-01-15T10:00:00.000Z');
        const departureISO = departureDate.toISOString();

        // Set the hidden input value via JavaScript
        await page.evaluate((iso) => {
          const input = document.querySelector(
            'input[name="departure"]',
          ) as HTMLInputElement;
          if (input) {
            input.value = iso;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }, departureISO);

        // Also try clicking the calendar icon and selecting a date as a fallback
        const calendarIcon = modal
          .locator('button')
          .filter({ has: page.locator('svg[class*="CalendarDays"]') })
          .first();

        if ((await calendarIcon.count()) > 0) {
          await calendarIcon.click();
          await page.waitForTimeout(300);
          // Try to click on day 15 in the calendar
          const dayButtons = page
            .locator('button')
            .filter({ hasText: /^15$/ })
            .first();
          if ((await dayButtons.count()) > 0) {
            await dayButtons.click();
            await page.waitForTimeout(300);
          }
        }

        // Submit the form
        await modal.getByRole('button', { name: /add flight/i }).click();

        // Wait for success toast
        await expect(page.getByText(/flight added successfully/i)).toBeVisible({
          timeout: 10000,
        });
      },
      { page, title: 'New flight' },
    );

    // Verify flight appears in the list
    await page.getByTestId('list-flights-button').click();

    // Wait for the flights modal to open
    await expect(page.getByText(/all flights/i)).toBeVisible({ timeout: 5000 });

    // Check that the flight appears in the list
    // Look for either airport code
    await expect(page.getByText(/JFK|EGLL|LHR/i).first()).toBeVisible({
      timeout: 5000,
    });
  });
});
