/**
 * Tác giả sửa được thông tin truyện ở mọi giai đoạn, kể cả truyện đã xuất bản.
 */
export class StoryEditPolicy {
  /**
   * Truyện đã từng xuất bản thì khoá slug.
   *
   * Tiêu đề hiển thị vẫn đổi được, nhưng đường dẫn giữ nguyên. Repo không có
   * bảng lưu slug cũ, nên đổi slug là mọi link đã chia sẻ, bookmark và kết quả
   * tìm kiếm chết hẳn chứ không chuyển hướng được.
   */
  static keepsPublishedSlug(publishedAt: Date | null): boolean {
    return publishedAt !== null;
  }

  /**
   * Truyện đã xuất bản thì khoá định dạng.
   *
   * Chương truyện chữ lưu nội dung ở `content`, chương truyện tranh lưu ở các
   * trang ảnh. Lật NOVEL sang MANGA khi độc giả đang đọc là mọi chương cũ hoá
   * trang trắng. Truyện chưa xuất bản thì chưa ai đọc, đổi thoải mái.
   */
  static allowsFormatChange(publishedAt: Date | null): boolean {
    return publishedAt === null;
  }
}
