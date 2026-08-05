import {
    expect,
    type Page,
} from '@playwright/test';

export class AuthDialogPage {
    constructor(
        private readonly page: Page,
    ) { }

    async open(): Promise<void> {
        await this.page
            .getByTestId('header-login')
            .click();

        await expect(
            this.page.getByTestId(
                'auth-dialog',
            ),
        ).toBeVisible();
    }

    async login(
        identifier: string,
        password: string,
    ): Promise<void> {
        await this.page
            .getByTestId('auth-identifier')
            .fill(identifier);

        await this.page
            .getByTestId('auth-password')
            .fill(password);

        await this.page
            .getByTestId('auth-submit')
            .click();
    }
}