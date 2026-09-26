/**
 * Lời cảnh báo trước khi xoá, viết đúng thứ thực sự sẽ xảy ra.
 *
 * Xoá chương hay truyện đã bán là lấy lại thứ độc giả đã trả tiền, nên hộp
 * xác nhận phải nói thẳng rằng tiền được hoàn và nội dung biến mất khỏi tủ
 * sách của họ — không được viết chung chung kiểu "bạn có chắc không?".
 */

/** Trạng thái chương/truyện mà độc giả đang nhìn thấy được. */
const READER_VISIBLE_STATUSES = new Set(['PUBLISHED', 'SCHEDULED']);

export function isReaderVisible(status: string): boolean {
  return READER_VISIBLE_STATUSES.has(status);
}

export function describeChapterDeleteWarning(input: {
  readonly number: number;
  readonly title: string;
  readonly status: string;
}): string {
  const head = `Xóa chương ${input.number}: “${input.title}”?`;

  if (!isReaderVisible(input.status)) {
    return `${head}\n\nChương chưa hiện với độc giả nên chỉ mình bạn mất bản thảo này.`;
  }

  return (
    `${head}\n\n` +
    'Chương đang hiện với độc giả. Xóa xong:\n' +
    '• Chương biến mất khỏi truyện và khỏi tủ sách người đã mua.\n' +
    '• Mọi lượt mua chương này được hoàn tiền tự động, trừ lại vào doanh thu của bạn.\n' +
    '• Không hoàn tác được.'
  );
}

export function describeStoryDeleteWarning(input: {
  readonly title: string;
  readonly status: string;
}): string {
  const head = `Xóa truyện “${input.title}”?`;
  const chapters = 'Mọi chương của truyện cũng bị xóa theo.';

  if (!isReaderVisible(input.status)) {
    return `${head}\n\n${chapters}`;
  }

  return (
    `${head}\n\n` +
    'Truyện đang hiện với độc giả. Xóa xong:\n' +
    `• ${chapters}\n` +
    '• Truyện biến mất khỏi tủ sách của mọi người đã mua chương.\n' +
    '• Mọi lượt mua chương của truyện được hoàn tiền tự động, trừ lại vào doanh thu của bạn.\n' +
    '• Không hoàn tác được.'
  );
}
