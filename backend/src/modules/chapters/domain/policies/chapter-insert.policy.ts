/**
 * Cột `chapters.number` là `Decimal(10, 2)`: hai chữ số thập phân, không hơn.
 * Nhân 100 rồi làm việc trên số nguyên để khỏi dính sai số dấu phẩy động —
 * `(1.1 + 1.2) / 2` trong JavaScript không ra đúng số mà Postgres sẽ lưu.
 */
const SCALE = 100;

export class ChapterInsertPolicy {
  /** Số chữ số thập phân cột number giữ được. */
  static readonly DECIMAL_PLACES = 2;

  /**
   * Số cho chương chèn ngay sau `after`.
   *
   * `before` là số của chương liền kề phía sau, hoặc null khi `after` đang là
   * chương cuối — lúc đó chèn chính là thêm vào đuôi.
   *
   * Trả null khi hai chương liền kề đã sát nhau tới mức không còn số nào nằm
   * giữa (ví dụ 1.50 và 1.51). Gọi nơi khác phải báo lỗi cho tác giả chứ không
   * được tự làm tròn vào một trong hai số đã có: `@@unique([storyId, number])`
   * sẽ vỡ.
   */
  static numberBetween(after: number, before: number | null): number | null {
    if (!Number.isFinite(after) || after < 0) return null;

    if (before === null) return Math.floor(after) + 1;

    if (!Number.isFinite(before) || before <= after) return null;

    const afterScaled = Math.round(after * SCALE);
    const beforeScaled = Math.round(before * SCALE);

    // Cần ít nhất một bậc trống ở giữa; chênh 1 nghĩa là đã liền kề.
    if (beforeScaled - afterScaled < 2) return null;

    return Math.floor((afterScaled + beforeScaled) / 2) / SCALE;
  }
}
