/**
 * Tác giả sửa được chương ở mọi giai đoạn, kể cả chương độc giả đang đọc. Hai
 * quy tắc dưới đây là phần còn lại phải giữ để việc đó không làm hỏng trải
 * nghiệm đọc.
 */
export class ChapterEditPolicy {
  /**
   * Autosave chỉ chạy cho bản nháp.
   *
   * Chương ở trạng thái khác — nhất là chương đã xuất bản — hiện thẳng cho độc
   * giả, nên mỗi lần ghi phải là chủ ý của tác giả. Để autosave 2.5 giây một
   * lần đẩy lên thì độc giả đọc trúng câu đang gõ dở.
   */
  static allowsAutosave(status: string): boolean {
    return status === 'DRAFT';
  }

  /**
   * Chương độc giả đang thấy, hoặc đã xếp hàng để hiện ra, không được để
   * trống.
   *
   * Sửa ở mọi giai đoạn nghĩa là sửa được nội dung, không phải bỏ trắng một
   * chương đang đọc dở. Bản nháp thì trống thoải mái — chưa ai thấy.
   */
  static requiresContent(status: string): boolean {
    return status === 'PUBLISHED' || status === 'SCHEDULED';
  }

  /**
   * Chương đã từng xuất bản thì khoá slug.
   *
   * Đổi tiêu đề vẫn đổi được, nhưng đường dẫn giữ nguyên để link độc giả đã
   * lưu, lịch sử đọc và kết quả tìm kiếm không chết. Chương chưa từng xuất bản
   * thì chưa ai có link, đổi slug theo tiêu đề mới là đúng.
   */
  static keepsPublishedSlug(publishedAt: Date | null): boolean {
    return publishedAt !== null;
  }
}
