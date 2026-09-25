import { StoryEditPolicy } from './story-edit.policy';

describe('StoryEditPolicy', () => {
  /*
   * Không có bảng redirect slug cũ, nên đổi slug của truyện đã xuất bản là
   * giết mọi link cũ chứ không phải chuyển hướng chúng.
   */
  it('khoá slug của truyện đã từng xuất bản', () => {
    expect(StoryEditPolicy.keepsPublishedSlug(new Date())).toBe(true);
  });

  it('cho slug chạy theo tiêu đề khi truyện chưa từng xuất bản', () => {
    expect(StoryEditPolicy.keepsPublishedSlug(null)).toBe(false);
  });

  /*
   * Chương truyện chữ và chương truyện tranh lưu nội dung ở hai chỗ khác
   * nhau, nên lật định dạng của truyện đang đọc là mọi chương cũ thành trắng.
   */
  it('khoá định dạng của truyện đã xuất bản', () => {
    expect(StoryEditPolicy.allowsFormatChange(new Date())).toBe(false);
  });

  it('cho đổi định dạng khi truyện chưa xuất bản', () => {
    expect(StoryEditPolicy.allowsFormatChange(null)).toBe(true);
  });
});
