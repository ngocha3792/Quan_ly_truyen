import { expect, Locator, Page } from '@playwright/test';

export class AuthDialogPage {
  constructor(private readonly page: Page) {}

  get dialog(): Locator {
    return this.page.getByRole('dialog');
  }

  get credentialsForm(): Locator {
    return this.dialog.locator('form').first();
  }

  get error(): Locator {
    return this.dialog.locator('.alert.error');
  }

  async open(): Promise<void> {
    /**
     * Chỉ nút login ở header.
     */
    await this.page.locator('header .login-button').click();

    await expect(this.dialog).toBeVisible();
  }

  async login(
    identifier: string,

    password: string,
  ): Promise<void> {
    await this.credentialsForm.getByLabel('Email hoặc tên đăng nhập').fill(identifier);

    await this.credentialsForm.getByLabel('Mật khẩu').fill(password);

    /**
     * Dialog có:
     *
     * - tab "Đăng nhập"
     * - submit "Đăng nhập"
     *
     * Nên phải khóa type=submit.
     */
    await this.credentialsForm.locator('button.submit[type="submit"]').click();
  }
}
