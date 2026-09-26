/**
 * Nhập nhiều chương từ một bản thảo.
 *
 * Tách chương chạy ở trình duyệt vì file nằm sẵn ở máy tác giả; máy chủ chỉ
 * nhận danh sách đã tách và tạo từng bản nháp. Các con số dưới đây là chỗ máy
 * chủ tự bảo vệ mình, không tin vào giới hạn phía giao diện.
 */
export class ChapterImportPolicy {
  /**
   * Số chương nhận tối đa trong một lần gọi.
   *
   * Mỗi chương là một giao dịch riêng có khoá truyện, nên một bản thảo nghìn
   * chương sẽ ăn hết thời gian chờ của request. Giao diện chia bản thảo ra
   * nhiều lần gọi, và `remaining` cho biết còn bao nhiêu.
   */
  static readonly MAX_PER_CALL = 50;

  /**
   * Độ dài tối đa của một chương, tính bằng ký tự.
   *
   * Cột `content` là `text` nên không có trần ở tầng database. Không chặn thì
   * một file hỏng thành một chương vài chục megabyte nằm trong bảng.
   */
  static readonly MAX_CONTENT_LENGTH = 500_000;
}
