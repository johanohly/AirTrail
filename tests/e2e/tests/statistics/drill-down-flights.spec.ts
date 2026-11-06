import { airportsFactory } from '@test/factories/airports';
import { flightsFactory } from '@test/factories/flights';
import { usersFactory } from '@test/factories/users';
import { JFK, LHR } from '@test/fixtures/airports';
import { login } from '@test/helpers/auth';
import { expect, test } from '@test/index';

test('lists drill-down flights newest first', async ({ page }) => {
  const { user } = await usersFactory.create();
  const { airport: from } = await airportsFactory.getOrCreate(JFK);
  const { airport: to } = await airportsFactory.getOrCreate(LHR);
  for (const year of [2022, 2025, 2023]) {
    await flightsFactory.create({
      userId: user.id,
      date: `${year}-06-15`,
      fromId: from.id,
      toId: to.id,
    });
  }
  await login(page, user);
  await page.getByTestId('statistics-button').click();

  // None of the flights has an airline, so this opens with all three listed.
  await page
    .getByTestId('statistics-scroll')
    .getByRole('button', { name: /^Not recorded/ })
    .first()
    .click();
  const sheet = page.getByTestId('statistics-drill-down');
  await expect(sheet.getByRole('button', { name: /JFK.*LHR/ })).toHaveText([
    /2025/,
    /2023/,
    /2022/,
  ]);
});
