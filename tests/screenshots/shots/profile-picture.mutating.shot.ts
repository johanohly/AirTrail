import sharp from 'sharp';

import { expect, test } from '../support/shot';

/*
 * A plain generated picture rather than a photo, so the shot needs no
 * licensed asset and comes out the same on every run.
 */
const samplePicture = () =>
  sharp(
    Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#2b5fd9"/>
          <stop offset="1" stop-color="#f3a35c"/>
        </linearGradient>
      </defs>
      <rect width="512" height="512" fill="url(#sky)"/>
      <circle cx="350" cy="250" r="70" fill="#ffd27a"/>
      <path d="M0 400 L140 270 L250 360 L360 250 L512 390 L512 512 L0 512 Z" fill="#1f2a44"/>
    </svg>`),
  )
    .png()
    .toBuffer();

test('settings-general', async ({ page, openAs, openSettings, capture }) => {
  const captureTheme = async (theme: 'light' | 'dark') => {
    await page.emulateMedia({ colorScheme: theme });
    await openAs('maya');
    const dialog = await openSettings('General');
    const avatar = dialog.getByRole('button', {
      name: 'Change profile picture',
    });
    await expect(avatar.locator('img')).toHaveJSProperty('complete', true);

    // The upload icon and the remove button only show on hover.
    await avatar.hover();
    await expect(
      dialog.getByRole('button', { name: 'Remove profile picture' }),
    ).toBeVisible();
    await capture('settings-general', { dialog }, theme);
  };

  await openAs('maya');
  const dialog = await openSettings('General');

  await dialog.locator('input[type="file"]').setInputFiles({
    name: 'maya.png',
    mimeType: 'image/png',
    buffer: await samplePicture(),
  });
  try {
    await expect(
      dialog.getByRole('button', { name: 'Change profile picture' }),
    ).toBeVisible();

    // One theme at a time: both share this page and Maya's picture.
    await captureTheme('light');
    await captureTheme('dark');
  } finally {
    const response = await page.request.delete('/api/users/avatar');
    expect(response.ok()).toBe(true);
  }
});
