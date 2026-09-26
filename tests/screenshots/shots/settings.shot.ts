import { expect, test } from '../support/shot';

test('settings-api-keys', async ({ page, openAs, openSettings, capture }) => {
  // The expanded key list outgrows the default viewport.
  await page.setViewportSize({ width: 1440, height: 1180 });
  await openAs('maya');
  const dialog = await openSettings('Security');
  await dialog.getByText('API Keys', { exact: true }).click();
  await expect(dialog.getByText('Home Assistant')).toBeVisible();
  await capture('settings-api-keys', { dialog });
});

test('settings-roles', async ({ openAs, openSettings, capture }) => {
  await openAs('maya');
  const dialog = await openSettings('Roles');
  await capture('settings-roles', { dialog });
});

test('settings-users', async ({ openAs, openSettings, capture }) => {
  await openAs('maya');
  const dialog = await openSettings('Users');
  await capture('settings-users', { dialog });
});

test('settings-share', async ({ openAs, openSettings, capture }) => {
  await openAs('maya');
  const dialog = await openSettings('Share');
  await capture('settings-share', { dialog });
});
