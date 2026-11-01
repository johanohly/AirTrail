import type { Locator, Page } from '@playwright/test';
import { airportsFactory } from '@test/factories/airports';
import { flightsFactory } from '@test/factories/flights';
import { usersFactory } from '@test/factories/users';
import { JFK, LHR } from '@test/fixtures/airports';
import { login } from '@test/helpers/auth';
import { expect, test } from '@test/index';

async function openStatistics(page: Page) {
  const { user } = await usersFactory.create();
  const { airport: from } = await airportsFactory.getOrCreate(JFK);
  const { airport: to } = await airportsFactory.getOrCreate(LHR);
  // A Monday in January and a Saturday in December.
  for (const date of ['2024-01-01', '2024-01-01', '2024-12-28']) {
    await flightsFactory.create({
      userId: user.id,
      date,
      fromId: from.id,
      toId: to.id,
    });
  }
  await login(page, user);
  await page.getByTestId('statistics-button').click();
}

// Visibility assertions alone do not detect a tooltip behind the modal.
async function expectPainted(tooltip: Locator) {
  expect(
    await tooltip.evaluate((el: HTMLElement) => {
      el.style.pointerEvents = 'auto';
      const rect = el.getBoundingClientRect();
      const top = document.elementFromPoint(
        rect.x + rect.width / 2,
        rect.y + rect.height / 2,
      );
      el.style.pointerEvents = '';
      return top !== null && el.contains(top);
    }),
  ).toBe(true);
}

const CHARTS = [
  {
    name: 'month',
    testId: 'flights-per-month',
    first: { index: 0, text: /January.*2/s },
    last: { index: 11, text: /December.*1/s },
  },
  {
    name: 'weekday',
    testId: 'flights-per-weekday',
    first: { index: 0, text: /Sun.*0/s },
    last: { index: 6, text: /Sat.*1/s },
  },
];

for (const viewport of [
  { width: 390, height: 800 },
  { width: 1400, height: 900 },
]) {
  test.describe(`Chart tooltips at ${viewport.width}px`, () => {
    test.use({ viewport });

    for (const { name, testId, first, last } of CHARTS) {
      test(`shows the ${name} chart's category and count above the modal`, async ({
        page,
      }) => {
        await openStatistics(page);
        const chart = page.getByTestId(testId);
        await chart.scrollIntoViewIfNeeded();

        for (const { index, text } of [first, last]) {
          await chart.locator('.lc-tooltip-rect').nth(index).hover();
          const tooltip = page.locator('.lc-tooltip-root');
          await expect(tooltip).toHaveText(text);
          await expectPainted(tooltip);
        }
      });
    }
  });
}
