import { ChapterEditPolicy } from './chapter-edit.policy';

describe('ChapterEditPolicy', () => {
  describe('allowsAutosave', () => {
    it('chỉ cho autosave bản nháp', () => {
      expect(ChapterEditPolicy.allowsAutosave('DRAFT')).toBe(true);
    });

    /*
     * Chương đã xuất bản hiện thẳng cho độc giả. Autosave gõ dở một câu là đủ
     * để độc giả đọc trúng bản chưa xong.
     */
    it('chặn autosave ở mọi trạng thái khác', () => {
      for (const status of [
        'IN_REVIEW',
        'APPROVED',
        'SCHEDULED',
        'PUBLISHED',
        'HIDDEN',
        'ARCHIVED',
      ]) {
        expect(ChapterEditPolicy.allowsAutosave(status)).toBe(false);
      }
    });
  });

  describe('requiresContent', () => {
    it('bắt chương đã xuất bản và chương đã hẹn giờ phải có nội dung', () => {
      expect(ChapterEditPolicy.requiresContent('PUBLISHED')).toBe(true);
      expect(ChapterEditPolicy.requiresContent('SCHEDULED')).toBe(true);
    });

    it('để bản nháp và chương đang duyệt được trống', () => {
      for (const status of ['DRAFT', 'IN_REVIEW', 'APPROVED']) {
        expect(ChapterEditPolicy.requiresContent(status)).toBe(false);
      }
    });
  });

  describe('keepsPublishedSlug', () => {
    it('khoá slug của chương đã từng xuất bản', () => {
      expect(ChapterEditPolicy.keepsPublishedSlug(new Date())).toBe(true);
    });

    it('cho slug chạy theo tiêu đề khi chương chưa từng xuất bản', () => {
      expect(ChapterEditPolicy.keepsPublishedSlug(null)).toBe(false);
    });
  });
});
