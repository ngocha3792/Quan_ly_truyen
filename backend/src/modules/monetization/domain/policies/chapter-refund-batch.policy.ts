/**
 * Hoàn tiền hàng loạt khi một chương bị xoá.
 */
export class ChapterRefundBatchPolicy {
  /**
   * Số giao dịch mua hoàn được trong một lần gọi.
   *
   * Mỗi lần hoàn là một giao dịch có advisory lock riêng, cộng thêm cập nhật
   * ví và sổ cái. Một chương bán được vài nghìn lượt sẽ ăn hết thời gian chờ
   * của request rồi chết giữa chừng, để lại một nửa số người đã được hoàn còn
   * chương thì vẫn nằm đó.
   *
   * Quá ngưỡng này thì từ chối thẳng: xoá một chương có hàng nghìn lượt mua đã
   * là việc của quản trị và kế toán, không phải một nút tự phục vụ.
   */
  static readonly MAX_REFUNDS_PER_DELETE = 200;
}
