import {
    expect,
    test,
} from '../fixtures/authenticated-test';

test(
    'hiển thị phiên hiện tại và các phiên khác',
    async ({
        page,
    }) => {
        await page.goto(
            '/tai-khoan/thiet-bi',
        );

        await expect(
            page.getByRole(
                'heading',

                {
                    name:
                        'Thiết bị đăng nhập',

                    level:
                        1,
                },
            ),
        ).toBeVisible();

        await expect(
            page.getByRole(
                'heading',

                {
                    name:
                        'Thiết bị hiện tại',

                    level:
                        2,
                },
            ),
        ).toBeVisible();

        await expect(
            page.getByRole(
                'heading',

                {
                    name:
                        'Các phiên đăng nhập khác',

                    level:
                        2,
                },
            ),
        ).toBeVisible();
    },
);  