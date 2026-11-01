import type { Locator, Page } from '@playwright/test';
import { airportsFactory } from '@test/factories/airports';
import { flightsFactory } from '@test/factories/flights';
import { usersFactory } from '@test/factories/users';
import { JFK, LHR } from '@test/fixtures/airports';
import { login } from '@test/helpers/auth';
import { expect, test } from '@test/index';

async function openChart(page: Page, counts: [number, number][]) {
  const { user } = await usersFactory.create();
  const { airport: from } = await airportsFactory.getOrCreate(JFK);
  const { airport: to } = await airportsFactory.getOrCreate(LHR);
  for (const [year, count] of counts) {
    for (let i = 0; i < count; i++) {
      await flightsFactory.create({
        userId: user.id,
        date: `${year}-06-15`,
        fromId: from.id,
        toId: to.id,
      });
    }
  }
  await login(page, user);
  await page.getByTestId('statistics-button').click();
  const chart = page.getByTestId('flights-per-year');
  await chart.scrollIntoViewIfNeeded();
  return chart;
}

async function barHeights(chart: Locator) {
  return chart
    .locator('.lc-bar')
    .evaluateAll((bars) =>
      bars.map((bar) => bar.getBoundingClientRect().height),
    );
}

test('measures positive year counts from zero', async ({ page }) => {
  const chart = await openChart(page, [
    [2020, 10],
    [2021, 11],
  ]);
  await expect(chart.locator('.lc-bar')).toHaveCount(2);
  await expect
    .poll(async () => {
      const [first, second] = await barHeights(chart);
      return first / second;
    })
    .toBeCloseTo(10 / 11, 2);
});

test('identifies an unlabelled empty year on a narrow chart', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 });
  const chart = await openChart(page, [
    [2009, 1],
    [2011, 2],
    [2026, 36],
  ]);
  await expect(chart.locator('.lc-bar')).toHaveCount(18);
  await expect(
    chart.locator('svg text').filter({ hasText: /^2010$/ }),
  ).toHaveCount(0);
  await expect(chart.locator('.lc-root-container')).toHaveCount(1);
  expect(await chart.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );

  await chart.locator('.lc-tooltip-rect').nth(1).hover();
  const tooltip = page.locator('.lc-tooltip-root');
  await expect(tooltip).toHaveText('2010: 0 flights');
  // Visibility assertions alone do not detect a tooltip behind the modal.
  expect(
    await tooltip.evaluate((el) => {
      const previous = el.style.pointerEvents;
      el.style.pointerEvents = 'auto';
      const rect = el.getBoundingClientRect();
      const top = document.elementFromPoint(
        rect.x + rect.width / 2,
        rect.y + rect.height / 2,
      );
      el.style.pointerEvents = previous;
      return top !== null && el.contains(top);
    }),
  ).toBe(true);
});

test('filters to a year and back by clicking its bar', async ({ page }) => {
  const chart = await openChart(page, [
    [2024, 2],
    [2025, 3],
  ]);
  const months = page.getByTestId('flights-per-month');
  const june = months.locator('.lc-tooltip-rect').nth(5);
  const tooltip = months.locator('.lc-tooltip-root');
  await june.hover();
  await expect(tooltip).toHaveText('June: 5 flights');

  await chart.locator('.lc-tooltip-rect').nth(1).click();
  await june.hover();
  await expect(tooltip).toHaveText('June: 3 flights');
  // The other year stays, so it can be picked next.
  await expect(chart.locator('.lc-bar')).toHaveCount(2);

  await chart.locator('.lc-tooltip-rect').nth(1).click();
  await june.hover();
  await expect(tooltip).toHaveText('June: 5 flights');
});

test('keeps the page when clicking a year without flights', async ({
  page,
}) => {
  const chart = await openChart(page, [
    [2024, 1],
    [2026, 1],
  ]);
  await chart.locator('.lc-tooltip-rect').nth(1).click();
  await expect(page.getByText('No flights match')).toHaveCount(0);
  await expect(chart.locator('.lc-bar')).toHaveCount(3);
});

test('keeps a drill-down on screen when opened from far down the page', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await openChart(page, [[2024, 1]]);
  await page
    .getByRole('button', { name: /^Economy|Not recorded/ })
    .last()
    .click();
  const sheet = page.getByTestId('statistics-drill-down');
  await expect(sheet).toBeInViewport({ ratio: 1 });
});

test('filters to a year from the keyboard', async ({ page }) => {
  await openChart(page, [
    [2024, 2],
    [2025, 3],
  ]);
  const yearButton = page.getByRole('button', { name: '2025: 3 flights' });
  await yearButton.focus();
  await page.keyboard.press('Enter');
  await expect(yearButton).toHaveAttribute('aria-pressed', 'true');
});

test.describe('Touch tooltips', () => {
  test.use({
    viewport: { width: 390, height: 800 },
    hasTouch: true,
    isMobile: true,
  });

  test('keeps the year and count above the touching thumb', async ({
    page,
    context,
  }) => {
    const chart = await openChart(page, [
      [2009, 1],
      [2026, 36],
    ]);
    const touch = await context.newCDPSession(page);
    for (const { index, count } of [
      { index: 0, count: 1 },
      { index: 1, count: 0 },
      { index: 17, count: 36 },
    ]) {
      const band = await chart
        .locator('.lc-tooltip-rect')
        .nth(index)
        .boundingBox();
      expect(band).not.toBeNull();
      if (!band) return;
      const point = { x: band.x + band.width / 2, y: band.y + band.height - 8 };
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [point],
      });
      const tooltip = chart.locator('.lc-tooltip-root');
      await expect(tooltip).toHaveText(
        `${2009 + index}: ${count} ${count === 1 ? 'flight' : 'flights'}`,
      );
      const rect = await tooltip.boundingBox();
      expect(rect?.height).toBeLessThan(40);
      // A thumb covers more than the contact point. Leave space above it.
      await expect
        .poll(async () => {
          const rect = await tooltip.boundingBox();
          return rect ? point.y - rect.y - rect.height : 0;
        })
        .toBeGreaterThanOrEqual(80);
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [],
      });
    }
  });
});
