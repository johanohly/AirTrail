import type { Page } from '@playwright/test';
import { usersFactory } from '@test/factories/users';
import { login } from '@test/helpers/auth';
import { openAddFlightModal } from '@test/helpers/flight-form';
import { expect, test } from '@test/index';
import { uneval } from 'devalue';

import type { AircraftPhotoResult } from '$lib/zod/aircraft-photo';

const PHOTO_SRC = 'https://t.plnspttrs.net/e2e/ec-mxv_280.jpg';
const PHOTO_LINK = 'https://www.planespotters.net/photo/e2e/ec-mxv';
const PHOTO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="280"><rect width="420" height="280" fill="#7aa7d9"/></svg>`;

/*
 * Photos are off on the shared e2e server and the lookup happens server-side,
 * so the test turns them on in this page's layout data only and answers the
 * lookup and the CDN request itself. Nothing here reaches Planespotters.
 */
const mockPhotos = async (
  page: Page,
  { result, image }: { result: AircraftPhotoResult; image: 'ok' | 'fail' },
) => {
  await page.route('**/__data.json*', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const data = body.nodes?.[0]?.data;
    if (!Array.isArray(data) || data[0]?.appConfig === undefined) {
      throw new Error('The root layout data changed shape');
    }

    // SvelteKit flattens the data with `devalue`: objects hold indices into
    // `data` instead of their values.
    const appConfig = data[data[0].appConfig];
    const config = data[appConfig.config];
    const integrations = data[config.integrations];
    integrations.aircraftPhotosEnabled = data.push(true) - 1;
    await route.fulfill({ response, json: body });
  });

  await page.route('**/api/trpc/aircraft.getPhoto*', (route) =>
    route.fulfill({ json: [{ result: { data: uneval(result) } }] }),
  );

  await page.route(PHOTO_SRC, (route) =>
    image === 'ok'
      ? route.fulfill({ contentType: 'image/svg+xml', body: PHOTO_SVG })
      : route.abort(),
  );
};

const typeRegistration = async (page: Page) => {
  const modal = await openAddFlightModal(page);
  await modal.getByLabel('Registration').fill('EC-MXV');
  return modal;
};

const found = (photographer: string): AircraftPhotoResult => ({
  status: 'found',
  photo: { thumbnailSrc: PHOTO_SRC, link: PHOTO_LINK, photographer },
});

test.describe('Aircraft photo in the flight form', () => {
  test('opens the photo from the registration field', async ({ page }) => {
    const { user } = await usersFactory.create();
    await mockPhotos(page, { result: found('Jane Spotter'), image: 'ok' });
    await login(page, user);

    const modal = await typeRegistration(page);
    const button = modal.getByRole('button', { name: 'Show aircraft photo' });
    await expect(button).toBeVisible();

    await modal.getByLabel('Registration').press('Tab');
    await expect(button).toBeFocused();
    await page.keyboard.press('Enter');

    const popover = page.getByRole('dialog', { name: 'Aircraft photo' });
    await expect(popover).toBeVisible();
    await expect(
      popover.getByRole('img', { name: 'EC-MXV, photo by Jane Spotter' }),
    ).toBeVisible();
    await expect(popover).toContainText('© Jane Spotter / Planespotters.net');
    await expect(
      popover.getByRole('link', { name: 'Planespotters.net' }),
    ).toHaveAttribute('href', PHOTO_LINK);

    await page.keyboard.press('Escape');
    await expect(popover).toBeHidden();
    await expect(modal).toBeVisible();
    await expect(button).toBeFocused();
  });

  test('credits Planespotters alone when the photographer is missing', async ({
    page,
  }) => {
    const { user } = await usersFactory.create();
    await mockPhotos(page, { result: found(''), image: 'ok' });
    await login(page, user);

    const modal = await typeRegistration(page);
    await modal.getByRole('button', { name: 'Show aircraft photo' }).click();

    const popover = page.getByRole('dialog', { name: 'Aircraft photo' });
    await expect(
      popover.getByRole('img', { name: 'EC-MXV', exact: true }),
    ).toBeVisible();
    await expect(popover.locator('figcaption')).toHaveText('Planespotters.net');
  });

  for (const { name, result, image } of [
    { name: 'no photo is found', result: { status: 'none' }, image: 'ok' },
    { name: 'the image fails to load', result: found('Jane'), image: 'fail' },
  ] as const) {
    test(`shows no button when ${name}`, async ({ page }) => {
      const { user } = await usersFactory.create();
      await mockPhotos(page, { result, image });
      await login(page, user);

      const lookup = page.waitForResponse('**/api/trpc/aircraft.getPhoto*');
      const imageFailed =
        image === 'fail'
          ? page.waitForEvent('requestfailed', (request) =>
              request.url().startsWith(PHOTO_SRC),
            )
          : null;
      const modal = await typeRegistration(page);
      await lookup;
      await imageFailed;
      // Give the page a couple of frames to render whatever the result causes.
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );

      await expect(
        modal.getByRole('button', { name: 'Show aircraft photo' }),
      ).toHaveCount(0);
    });
  }
});
