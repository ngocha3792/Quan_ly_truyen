import { expect, test } from '@playwright/test';
import { STORY_ID } from '../support/author-studio-editor-api';
import { mockPaymentGatewayApi, PAYMENT_RETURN, PROVIDER_ID } from '../support/payment-gateway-api';

test.describe('Payment gateway administration and checkout with controlled responses', () => {
  test('saves a no-key draft, masks credentials, validates setup before activation and preserves unchanged secrets', async ({
    page,
    context,
  }, testInfo) => {
    const api = await mockPaymentGatewayApi(context);
    await page.goto('/admin/settings/payments');
    await page.getByLabel('Loại kết nối').selectOption('VNPAY');
    await page.getByLabel('Mã ổn định').fill('vnpay-test');
    await page.getByLabel('Tên hiển thị').fill('VNPAY thử nghiệm');
    await expect(page.getByRole('checkbox', { name: /Kích hoạt kết nối/ })).toBeDisabled();
    await page.getByRole('button', { name: 'Lưu bản nháp', exact: true }).click();
    await expect(page.getByText('Bản nháp — chưa sẵn sàng nhận thanh toán')).toBeVisible();
    expect(api.providerWrites[0]).toMatchObject({ enabled: false, kind: 'VNPAY' });
    expect(api.providerWrites[0]).not.toHaveProperty('credentials');
    await page.getByLabel('Mã đơn vị (TMN)').fill('MERCHANT');
    await page.getByLabel('IP máy chủ').fill('103.74.100.55');
    await page.getByLabel('Khóa Hash Secret').fill('private-merchant-secret');
    await expect(page.getByLabel('Khóa Hash Secret')).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
    await expect(page.getByText('Đã đủ cấu hình để kích hoạt')).toBeVisible();
    await expect(page.getByLabel('Khóa Hash Secret')).toHaveValue('');
    await page.getByRole('checkbox', { name: /Kích hoạt kết nối/ }).check();
    await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
    await expect(
      page.locator('.provider-status').getByText('Đang hoạt động', { exact: true }),
    ).toBeVisible();
    expect(api.providerWrites.at(-1)).not.toHaveProperty('credentials');
    expect(api.providerWrites[1]['credentials']).toEqual({ hashSecret: 'private-merchant-secret' });
    await expect(page.locator('body')).not.toContainText('private-merchant-secret');
    await page.getByLabel('Mã truyện', { exact: true }).fill(STORY_ID);
    await page.getByRole('button', { name: 'Tải thiết lập' }).click();
    await page.getByRole('checkbox', { name: 'Mở thanh toán cho truyện này' }).check();
    await page.getByRole('checkbox', { name: 'VNPAY', exact: true }).check();
    await page.getByRole('button', { name: 'Lưu phạm vi' }).click();
    await expect(page.getByText('Đã lưu phạm vi thanh toán cho truyện.')).toBeVisible();
    expect(api.rolloutWrites).toEqual([{ isEnabled: true, enabledProviders: ['VNPAY'] }]);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 960 });
      expect(
        await page
          .locator('.payment-providers-page')
          .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(`gateway-setup-${width}.png`),
        fullPage: true,
        animations: 'disabled',
      });
    }
  });

  test('reconciles an order and blocks repeated refunds while the provider result is unknown', async ({
    page,
    context,
  }) => {
    const api = await mockPaymentGatewayApi(context);
    api.settle();
    await page.goto('/admin/payments/gateway');
    await page.getByRole('button', { name: 'Đối soát', exact: true }).click();
    await expect(page.getByText('Đã đối soát với VNPAY.')).toBeVisible();
    expect(api.reconciliations()).toBe(1);
    await page.getByRole('button', { name: 'Lịch sử / Hoàn tiền' }).click();
    await page.getByLabel('Lý do hoàn tiền').fill('Khách hàng đề nghị hoàn toàn bộ đơn.');
    await page
      .getByRole('checkbox', { name: 'Tôi xác nhận hoàn toàn bộ đơn và thu hồi Credit.' })
      .check();
    await page.getByRole('button', { name: 'Gửi yêu cầu hoàn tiền' }).click();
    await expect(page.getByText('Chưa rõ kết quả', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Gửi yêu cầu hoàn tiền' })).toHaveCount(0);
    expect(api.refunds).toHaveLength(1);
    expect(api.refunds[0]['idempotencyKey']).toBeTruthy();
  });

  test('ignores a forged success callback and waits for the authoritative own-order status', async ({
    page,
    context,
  }) => {
    const api = await mockPaymentGatewayApi(context);
    await page.goto(`${PAYMENT_RETURN}&vnp_ResponseCode=00&vnp_TransactionStatus=00`);
    await expect(page.getByRole('heading', { name: 'Đang chờ xác nhận thanh toán' })).toBeVisible();
    await expect(page.getByText('Đã nạp Credit thành công')).toHaveCount(0);
    api.settle();
    await expect(page.getByRole('heading', { name: 'Đã nạp Credit thành công' })).toBeVisible();
  });

  test('keeps the story rollout scope from wallet selection through order creation', async ({
    page,
    context,
  }) => {
    const api = await mockPaymentGatewayApi(context);
    await page.goto(`/tai-khoan/credit?storyId=${STORY_ID}`);
    await expect(page.getByLabel('Phương thức thanh toán')).toContainText('VNPAY');
    await page.getByRole('button', { name: 'Nạp Credit', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Đang chờ xác nhận thanh toán' })).toBeVisible();
    expect(api.methodsQueries).toContain(STORY_ID);
    expect(api.orderWrites).toEqual([
      { packageId: 'package-1', providerConnectionId: PROVIDER_ID, storyId: STORY_ID },
    ]);
  });
});
