import {
  describeChapterDeleteWarning,
  describeStoryDeleteWarning,
  isReaderVisible,
} from './delete-warning';

describe('delete-warning', () => {
  it('coi PUBLISHED và SCHEDULED là độc giả nhìn thấy được', () => {
    expect(isReaderVisible('PUBLISHED')).toBe(true);
    expect(isReaderVisible('SCHEDULED')).toBe(true);
    expect(isReaderVisible('DRAFT')).toBe(false);
    expect(isReaderVisible('APPROVED')).toBe(false);
  });

  it('nói rõ hoàn tiền khi xóa chương đã xuất bản', () => {
    const warning = describeChapterDeleteWarning({
      number: 12,
      title: 'Đêm dài',
      status: 'PUBLISHED',
    });

    expect(warning).toContain('Xóa chương 12: “Đêm dài”?');
    expect(warning).toContain('hoàn tiền tự động');
    expect(warning).toContain('Không hoàn tác được');
  });

  it('không dọa hoàn tiền khi chương chưa ra mắt', () => {
    const warning = describeChapterDeleteWarning({
      number: 3,
      title: 'Bản nháp',
      status: 'DRAFT',
    });

    expect(warning).toContain('chỉ mình bạn mất bản thảo này');
    expect(warning).not.toContain('hoàn tiền');
  });

  it('cảnh báo hoàn tiền và mất chương khi xóa truyện đã xuất bản', () => {
    const warning = describeStoryDeleteWarning({
      title: 'Kiếm khách',
      status: 'PUBLISHED',
    });

    expect(warning).toContain('Xóa truyện “Kiếm khách”?');
    expect(warning).toContain('Mọi chương của truyện cũng bị xóa theo');
    expect(warning).toContain('hoàn tiền tự động');
  });

  it('vẫn cảnh báo mất chương khi truyện chưa xuất bản', () => {
    const warning = describeStoryDeleteWarning({
      title: 'Nháp',
      status: 'DRAFT',
    });

    expect(warning).toContain('Mọi chương của truyện cũng bị xóa theo');
    expect(warning).not.toContain('hoàn tiền');
  });
});
