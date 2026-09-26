/**
 * Các thao tác hàng loạt trên chương: duyệt hết, gửi duyệt hết, xuất bản hết.
 */
export class ChapterBulkActionPolicy {
  /**
   * Số chương xử tối đa trong một lần gọi.
   *
   * Mỗi chương là một giao dịch riêng có khoá truyện, nên một truyện nghìn
   * chương sẽ ăn hết thời gian chờ của request rồi chết giữa đường. Chia nhỏ
   * thành nhiều lần gọi thì phần đã xong vẫn còn, và giao diện biết còn lại
   * bao nhiêu để gọi tiếp.
   */
  static readonly MAX_PER_CALL = 100;

  /**
   * Trạng thái mà một thao tác hàng loạt nhắm vào.
   *
   * Chỉ chương đang ở đúng trạng thái này mới được chọn; chương khác không phải
   * lỗi, chỉ là không thuộc lô này.
   */
  static sourceStatus(
    action: 'approve' | 'submit' | 'publish',
  ): 'IN_REVIEW' | 'DRAFT' | 'APPROVED' {
    if (action === 'approve') return 'IN_REVIEW';
    if (action === 'submit') return 'DRAFT';
    return 'APPROVED';
  }
}
