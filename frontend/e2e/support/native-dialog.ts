import { expect } from '@playwright/test';

import type { Dialog, Locator, Page } from '@playwright/test';

export async function clickAndAcceptDialog(
  page: Page,
  trigger: Locator,
  expectedMessage?: string | RegExp,
): Promise<void> {
  let resolveDialog!: () => void;
  let rejectDialog!: (error: unknown) => void;

  const handled = new Promise<void>((resolve, reject) => {
    resolveDialog = resolve;
    rejectDialog = reject;
  });

  const handler = (dialog: Dialog): void => {
    try {
      if (typeof expectedMessage === 'string') {
        expect(dialog.message()).toContain(expectedMessage);
      } else if (expectedMessage) {
        expect(dialog.message()).toMatch(expectedMessage);
      }
    } catch (error: unknown) {
      void dialog
        .dismiss()
        .catch(() => undefined)
        .finally(() => rejectDialog(error));

      return;
    }

    void dialog.accept().then(resolveDialog, rejectDialog);
  };

  page.once('dialog', handler);

  try {
    await trigger.click();
    await handled;
  } catch (error: unknown) {
    page.off('dialog', handler);
    throw error;
  }
}
