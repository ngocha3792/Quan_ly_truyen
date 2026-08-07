import {
    expect,
    test,
} from '../fixtures/authenticated-test';

test(
    'hiển thị các thiết lập bảo mật',
    async ({
        page,
    }) => {
        await page.goto(
            '/tai-khoan/bao-mat',
        );

        await expect(
            page.getByRole(
                'heading',

                {
                    name:
                        'Bảo mật tài khoản',

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
                        'Đổi mật khẩu',

                    level:
                        3,
                },
            ),
        ).toBeVisible();

        await expect(
            page.getByRole(
                'heading',

                {
                    name:
                        'Xác thực 2 lớp (2FA)',

                    level:
                        3,
                },
            ),
        ).toBeVisible();

        await expect(
            page.getByRole(
                'heading',

                {
                    name:
                        'Email khôi phục',

                    level:
                        3,
                },
            ),
        ).toBeVisible();
    },
);