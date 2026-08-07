import {
    expect,
    test,
} from '../fixtures/authenticated-test';

test(
    '@smoke mở trang tổng quan tài khoản',
    async ({
        page,
    }) => {
        await page.goto(
            '/tai-khoan',
        );

        await expect(
            page,
        ).toHaveURL(
            /\/tai-khoan$/,
        );

        await expect(
            page.getByRole(
                'heading',
                {
                    name:
                        'Tổng quan tài khoản',

                    level:
                        1,
                },
            ),
        ).toBeVisible();

        /**
         * "Email đã xác minh" xuất hiện ở cả:
         *
         * - sidebar
         * - overview card
         *
         * Vì vậy phải scope locator vào overview card.
         */
        const overviewCard =
            page.locator(
                'app-account-overview-card',
            );

        await expect(
            overviewCard,
        ).toBeVisible();

        await expect(
            overviewCard.getByText(
                'Email đã xác minh',
                {
                    exact:
                        true,
                },
            ),
        ).toBeVisible();
    },
);