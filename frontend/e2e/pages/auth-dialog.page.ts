import {
    expect,
    Locator,
    Page,
} from '@playwright/test';

export class AuthDialogPage {
    constructor(
        private readonly page:
            Page,
    ) { }

    get dialog():
        Locator {
        return this.page
            .getByRole(
                'dialog',
            );
    }

    get error():
        Locator {
        return this.dialog
            .locator(
                '.alert.error',
            );
    }

    async open():
        Promise<void> {
        await this.page
            .getByRole(
                'button',

                {
                    name:
                        'Đăng nhập',

                    exact:
                        true,
                },
            )
            .click();

        await expect(
            this.dialog,
        ).toBeVisible();
    }

    async login(
        identifier:
            string,

        password:
            string,
    ): Promise<void> {
        await this.dialog
            .getByLabel(
                'Email hoặc tên đăng nhập',
            )
            .fill(
                identifier,
            );

        await this.dialog
            .getByLabel(
                'Mật khẩu',
            )
            .fill(
                password,
            );

        await this.dialog
            .getByRole(
                'button',

                {
                    name:
                        'Đăng nhập',

                    exact:
                        true,
                },
            )
            .click();
    }
}