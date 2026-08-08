import {
  expect,
  test,
} from '../fixtures/managed-admin-test';

const TARGET_EMAIL =
  'e2e.managed-user@truyenhub.test';

test(
  'manager suspend rồi activate user end-to-end',

  async ({
    page,
  }) => {
    await page.goto(
      '/admin/users',
    );

    await expect(
      page.getByRole(
        'heading',

        {
          name:
            'Quản lý người dùng',
        },
      ),
    ).toBeVisible();

    await page
      .getByPlaceholder(
        'Email, username hoặc tên hiển thị...',
      )
      .fill(
        TARGET_EMAIL,
      );

    await page
      .getByRole(
        'button',

        {
          name:
            'Tìm',
        },
      )
      .click();

    const row =
      page
        .getByRole(
          'row',
        )
        .filter({
          hasText:
            TARGET_EMAIL,
        });

    await expect(
      row,
    ).toBeVisible();

    await row
      .getByRole(
        'link',

        {
          name:
            'Chi tiết',
        },
      )
      .click();

    await expect(
      page.getByRole(
        'heading',

        {
          name:
            'Chi tiết người dùng',
        },
      ),
    ).toBeVisible();

    page.once(
      'dialog',

      async (
        dialog,
      ) => {
        expect(
          dialog.message(),
        ).toContain(
          'Tạm khóa',
        );

        await dialog.accept();
      },
    );

    await page
      .getByRole(
        'button',

        {
          name:
            'Tạm khóa',
        },
      )
      .click();

    await expect(
      page.getByText(
        /Tài khoản đã bị tạm khóa/,
      ),
    ).toBeVisible();

    page.once(
      'dialog',

      async (
        dialog,
      ) => {
        await dialog.accept();
      },
    );

    await page
      .getByRole(
        'button',

        {
          name:
            'Kích hoạt',
        },
      )
      .click();

    await expect(
      page.getByText(
        /Tài khoản đã được kích hoạt/,
      ),
    ).toBeVisible();
  },
);

test(
  'manager cấp rồi gỡ ADMIN role end-to-end',

  async ({
    page,
  }) => {
    await page.goto(
      '/admin/users',
    );

    await page
      .getByPlaceholder(
        'Email, username hoặc tên hiển thị...',
      )
      .fill(
        TARGET_EMAIL,
      );

    await page
      .getByRole(
        'button',

        {
          name:
            'Tìm',
        },
      )
      .click();

    const row =
      page
        .getByRole(
          'row',
        )
        .filter({
          hasText:
            TARGET_EMAIL,
        });

    await row
      .getByRole(
        'link',

        {
          name:
            'Chi tiết',
        },
      )
      .click();

    page.once(
      'dialog',

      async (
        dialog,
      ) => {
        await dialog.accept();
      },
    );

    await page
      .getByRole(
        'button',

        {
          name:
            'Cấp quyền ADMIN',
        },
      )
      .click();

    await expect(
      page.getByText(
        /Đã cấp quyền ADMIN/,
      ),
    ).toBeVisible();

    await expect(
      page.getByRole(
        'button',

        {
          name:
            'Gỡ quyền ADMIN',
        },
      ),
    ).toBeVisible();

    page.once(
      'dialog',

      async (
        dialog,
      ) => {
        await dialog.accept();
      },
    );

    await page
      .getByRole(
        'button',

        {
          name:
            'Gỡ quyền ADMIN',
        },
      )
      .click();

    await expect(
      page.getByText(
        /Đã gỡ quyền ADMIN/,
      ),
    ).toBeVisible();

    await expect(
      page.getByRole(
        'button',

        {
          name:
            'Cấp quyền ADMIN',
        },
      ),
    ).toBeVisible();
  },
);
