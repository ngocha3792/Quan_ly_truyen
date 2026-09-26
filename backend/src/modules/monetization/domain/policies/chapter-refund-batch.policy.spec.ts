import { ChapterRefundBatchPolicy } from './chapter-refund-batch.policy';

describe('ChapterRefundBatchPolicy', () => {
  /*
   * Mỗi lần hoàn là một giao dịch có advisory lock, cập nhật ví và ghi sổ cái.
   * Không chặn trần thì một chương bán nghìn lượt làm request chết giữa chừng,
   * để lại một nửa số người đã được hoàn còn chương thì vẫn nằm đó.
   */
  it('chặn trần số lần hoàn trong một lượt xoá', () => {
    expect(ChapterRefundBatchPolicy.MAX_REFUNDS_PER_DELETE).toBeGreaterThan(0);
    expect(ChapterRefundBatchPolicy.MAX_REFUNDS_PER_DELETE).toBeLessThanOrEqual(
      500,
    );
  });
});
