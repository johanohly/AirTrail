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

function chartWithLabel(page: Page, label: string) {
  return page
    .locator('svg text')
    .filter({ hasText: new RegExp(`^${label}$`) })
    .locator('xpath=ancestor::div[contains(@class,"border rounded")][1]');
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
    axisLabel: 'Jan',
    first: { index: 0, text: /January.*2/s },
    last: { index: 11, text: /December.*1/s },
  },
  {
    axisLabel: 'Mon',
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

    for (const { axisLabel, first, last } of CHARTS) {
      test(`shows the ${axisLabel} chart's category and count above the modal`, async ({
        page,
      }) => {
        await openStatistics(page);
        const chart = chartWithLabel(page, axisLabel);
        await chart.scrollIntoViewIfNeeded();

        for (const { index, text } of [first, last]) {
          const point = await chart.locator('circle').nth(index).boundingBox();
          if (!point) throw new Error('Missing chart point');
          await page.mouse.move(
            point.x + point.width / 2,
            point.y + point.height / 2,
          );
          const tooltip = page.locator('.lc-tooltip-root');
          await expect(tooltip).toHaveText(text);
          await expectPainted(tooltip);
        }
      });
    }
  });
}
