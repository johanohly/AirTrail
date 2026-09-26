import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  test as base,
  expect,
  type Locator,
  type Page,
} from '@playwright/test';

import { DEMO_NOW } from '../demo/itinerary';
import type { DemoAccount } from '../demo/accounts';
import { authStatePath, RAW_DIR } from './constants';

type CaptureTarget =
  /** A floating dialog with its frame and some of the page around it. */
  | { dialog: Locator; margin?: number }
  | { element: Locator; padding?: number }
  | { viewport: true }
  | { fullPage: true }
  | { clip: { x: number; y: number; width: number; height: number } };

type ShotFixtures = {
  /** Log in as a demo account and open `path`. */
  openAs: (account: DemoAccount, path?: string) => Promise<void>;
  /** Save the current page as `<name>.<theme>.png`. */
  capture: (name: string, target?: CaptureTarget) => Promise<void>;
  /** Wait until the map has rendered its tiles and routes. */
  waitForMap: () => Promise<void>;
  /** Open Settings on a tab and return the dialog. */
  openSettings: (tab: string) => Promise<Locator>;
};

const hideForCapture = `
  *, *::before, *::after { caret-color: transparent !important; }
  ::-webkit-scrollbar { display: none; }
  [data-sonner-toaster] { display: none !important; }
`;

const settle = async (page: Page) => {
  await page.evaluate(() => document.fonts.ready);
  // Map tiles can keep trickling in; the map has its own wait.
  await page
    .waitForLoadState('networkidle', { timeout: 10_000 })
    .catch(() => {});
};

/** The element's box once it has stopped resizing, e.g. after an expand. */
const stableBox = async (page: Page, locator: Locator) => {
  let previous = await locator.boundingBox();
  for (let i = 0; i < 20; i += 1) {
    await page.waitForTimeout(100);
    const box = await locator.boundingBox();
    if (JSON.stringify(box) === JSON.stringify(previous)) return box;
    previous = box;
  }
  return previous;
};

export const test = base.extend<ShotFixtures>({
  page: async ({ page }, use) => {
    await page.clock.setFixedTime(DEMO_NOW);
    await page.addInitScript(() => {
      // Keep the "what's new" announcement from covering the app.
      localStorage.setItem('airtrail:changelog:dismissed-version', 'v999.9.9');
    });
    await use(page);
  },

  openAs: async ({ page }, use) => {
    await use(async (account, path = '/') => {
      const state = JSON.parse(await readFile(authStatePath(account), 'utf8'));
      await page.context().addCookies(state.cookies);
      await page.goto(path);
      await settle(page);
    });
  },

  waitForMap: async ({ page }, use) => {
    await use(async () => {
      const map = page.locator('.maplibregl-map');
      await expect(map).toHaveAttribute('data-map-idle', 'true', {
        timeout: 45_000,
      });
      // Arcs and markers animate in after the first idle.
      await page.waitForTimeout(800);
      await expect(map).toHaveAttribute('data-map-idle', 'true');
    });
  },

  openSettings: async ({ page }, use) => {
    await use(async (tab) => {
      await page.locator('#settings-button').click();
      const dialog = page.getByRole('dialog').filter({ hasText: 'Settings' });
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: tab, exact: true }).click();
      await settle(page);
      return dialog;
    });
  },

  capture: async ({ page }, use, testInfo) => {
    await use(async (name, target = { viewport: true }) => {
      await settle(page);
      await page.addStyleTag({ content: hideForCapture });
      // Focus rings and scroll offsets left by filling in forms vary per run.
      await page.evaluate(() =>
        (document.activeElement as HTMLElement | null)?.blur(),
      );
      if ('dialog' in target)
        await target.dialog.evaluate((dialog) => {
          for (const el of [dialog, ...dialog.querySelectorAll('*')])
            el.scrollTop = 0;
        });
      await mkdir(RAW_DIR, { recursive: true });
      const path = join(RAW_DIR, `${name}.${testInfo.project.name}.png`);
      const options = { path, animations: 'disabled', caret: 'hide' } as const;

      if ('dialog' in target) {
        const box = await stableBox(page, target.dialog);
        if (!box) throw new Error(`${name}: dialog is not visible`);
        const viewport = page.viewportSize()!;
        const margin = target.margin ?? 56;
        if (box.y < margin || box.y + box.height + margin > viewport.height)
          throw new Error(
            `${name}: the dialog doesn't fit the viewport with its margin; give the shot a taller viewport`,
          );
        const x = Math.max(0, box.x - margin);
        const y = Math.max(0, box.y - margin);
        await page.screenshot({
          ...options,
          clip: {
            x,
            y,
            width: Math.min(viewport.width, box.x + box.width + margin) - x,
            height: Math.min(viewport.height, box.y + box.height + margin) - y,
          },
        });
      } else if ('element' in target) {
        const box = await target.element.boundingBox();
        if (!box) throw new Error(`${name}: element is not visible`);
        const padding = target.padding ?? 0;
        await page.screenshot({
          ...options,
          clip: {
            x: Math.max(0, box.x - padding),
            y: Math.max(0, box.y - padding),
            width: box.width + padding * 2,
            height: box.height + padding * 2,
          },
        });
      } else if ('clip' in target) {
        await page.screenshot({ ...options, clip: target.clip });
      } else {
        await page.screenshot({ ...options, fullPage: 'fullPage' in target });
      }
    });
  },
});

export { expect };
