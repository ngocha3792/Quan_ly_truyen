import { AuthorChapterDraftInput } from './author-story-management.models';

/** Mốc chèn mà danh sách chương truyền sang trình soạn thảo qua query param. */
export type ChapterInsertAnchor = Pick<
  AuthorChapterDraftInput,
  'afterChapterId' | 'beforeChapterId'
>;

/**
 * Đọc mốc chèn từ URL.
 *
 * `chen-sau` là chèn ngay sau một chương, `chen-truoc` là chèn ngay trước một
 * chương — trỏ vào chương đầu truyện để thêm chương mở đầu. Không có cái nào
 * thì chương mới thêm vào đuôi truyện như cũ.
 */
/**
 * Chỉ cần đọc được query param, nên khai báo đúng phần đó thay vì kéo
 * `ParamMap` của Angular vào tầng domain. `ParamMap` khớp sẵn hình này.
 */
export interface ReadableQueryParams {
  get(key: string): string | null;
}

export function readInsertAnchor(params: ReadableQueryParams): ChapterInsertAnchor {
  const after = params.get('chen-sau');
  const before = params.get('chen-truoc');

  return {
    ...(after ? { afterChapterId: after } : {}),
    ...(before ? { beforeChapterId: before } : {}),
  };
}

/**
 * Câu giải thích cho tác giả biết chương sắp lưu sẽ nằm ở đâu, hoặc null khi
 * không chèn vào đâu cả.
 *
 * Máy chủ chọn số chương nên không hứa trước một con số cụ thể ở đây.
 */
export function describeInsertAnchor(anchor: ChapterInsertAnchor): string | null {
  const keepsNumbers = 'Số chương do hệ thống đặt để giữ nguyên số của các chương đã có.';

  if (anchor.beforeChapterId)
    return `Chương này sẽ thành chương mở đầu, đặt trước chương đầu tiên hiện tại. ${keepsNumbers}`;

  if (anchor.afterChapterId)
    return `Chương này sẽ được chèn ngay sau chương bạn đã chọn, không thêm vào cuối truyện. ${keepsNumbers}`;

  return null;
}
