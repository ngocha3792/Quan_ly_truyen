import { ChapterBulkActionPolicy } from './chapter-bulk-action.policy';

describe('ChapterBulkActionPolicy', () => {
  /*
   * Mỗi chương là một giao dịch riêng có khoá truyện. Không chặn trần thì một
   * truyện nghìn chương làm request chết giữa đường, để lại trạng thái dở dang
   * mà người bấm không biết đã xong tới đâu.
   */
  it('chặn trần số chương mỗi lần gọi', () => {
    expect(ChapterBulkActionPolicy.MAX_PER_CALL).toBeGreaterThan(0);
    expect(ChapterBulkActionPolicy.MAX_PER_CALL).toBeLessThanOrEqual(200);
  });

  it('nhắm đúng trạng thái nguồn cho từng thao tác', () => {
    expect(ChapterBulkActionPolicy.sourceStatus('approve')).toBe('IN_REVIEW');
    expect(ChapterBulkActionPolicy.sourceStatus('submit')).toBe('DRAFT');
    expect(ChapterBulkActionPolicy.sourceStatus('publish')).toBe('APPROVED');
  });
});
