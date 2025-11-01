import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

export const withinModal = async (
  callback: (modal: Locator) => Promise<void>,
  {
    page,
    title,
    assertClosed = true,
  }: { page: Page; title?: string | RegExp; assertClosed?: boolean },
) => {
  const modal = page.getByRole('dialog');
  if (title) {
    await expect(modal.getByRole('heading', { level: 2, name: title })).toBeVisible();
  }

  await expect(modal).toBeVisible();

  await callback(modal);

  if (assertClosed) {
    await expect(modal).not.toBeVisible();
  }
};

