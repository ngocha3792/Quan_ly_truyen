import {
  InvalidInputException,
  ResourceConflictException,
  ResourceNotFoundException,
} from '@/common/exceptions';

import { ChapterImportPolicy } from '../policies/chapter-import.policy';

export class InvalidChapterFieldException extends InvalidInputException {
  constructor(field: string, message: string) {
    super({
      code: 'CHAPTER_INVALID_FIELD',
      message,
      details: {
        field,
      },
    });
  }
}

export class ChapterStoryNotFoundException extends ResourceNotFoundException {
  constructor(storyId?: string) {
    super({
      code: 'STORY_NOT_FOUND',
      resource: 'truyện',
      ...(storyId ? { identifier: storyId } : {}),
      message: 'Không tìm thấy truyện',
    });
  }
}

export class ChapterNotFoundException extends ResourceNotFoundException {
  constructor(chapterId?: string) {
    super({
      code: 'CHAPTER_NOT_FOUND',
      resource: 'chương',
      ...(chapterId
        ? {
            identifier: chapterId,
          }
        : {}),
      message: 'Không tìm thấy chương',
    });
  }
}

export class ChapterVersionNotFoundException extends ResourceNotFoundException {
  constructor(chapterId: string, version: number) {
    super({
      code: 'CHAPTER_VERSION_NOT_FOUND',
      resource: 'phiên bản chương',
      identifier: `${chapterId}:${version}`,
      message: `Không tìm thấy phiên bản ${version} của chương`,
    });
  }
}

export class ChapterDraftOnlyMutationException extends ResourceConflictException {
  constructor() {
    super({
      code: 'CHAPTER_DRAFT_ONLY_MUTATION',
      resource: 'chương',
      message: 'Chỉ chương ở trạng thái bản nháp mới có thể xóa',
    });
  }
}

export class ChapterStoryNotPublishedException extends ResourceConflictException {
  constructor() {
    super({
      code: 'CHAPTER_STORY_NOT_PUBLISHED',
      resource: 'chương',
      message: 'Chỉ có thể xuất bản chương khi truyện đã được xuất bản',
    });
  }
}

export class ChapterNotPublishableException extends ResourceConflictException {
  constructor() {
    super({
      code: 'CHAPTER_NOT_PUBLISHABLE',
      resource: 'chương',
      message: 'Chương phải được duyệt hoặc đã lên lịch trước khi xuất bản',
    });
  }
}

export class ChapterNotSchedulableException extends ResourceConflictException {
  constructor() {
    super({
      code: 'CHAPTER_NOT_SCHEDULABLE',
      resource: 'chương',
      message: 'Chương phải được duyệt trước khi lên lịch xuất bản',
    });
  }
}

export class ChapterNotScheduledException extends ResourceConflictException {
  constructor() {
    super({
      code: 'CHAPTER_NOT_SCHEDULED',
      resource: 'chương',
      message: 'Chương chưa được lên lịch xuất bản',
    });
  }
}

export class ChapterScheduleMustBeFutureException extends InvalidInputException {
  constructor() {
    super({
      code: 'CHAPTER_SCHEDULE_MUST_BE_FUTURE',
      message: 'Thời điểm xuất bản phải nằm trong tương lai',
      details: { field: 'scheduledAt' },
    });
  }
}

export class ChapterEmptyContentException extends InvalidInputException {
  constructor() {
    super({
      code: 'CHAPTER_EMPTY_CONTENT',
      message: 'Chương phải có nội dung trước khi xuất bản',
      details: { field: 'content' },
    });
  }
}

/**
 * Autosave 2.5 giây một lần là để cứu bản nháp đang gõ. Chương đã xuất bản
 * hiện thẳng cho độc giả nên chỉ nhận cái bấm Lưu của tác giả.
 */
export class ChapterAutosaveNotAllowedException extends ResourceConflictException {
  constructor() {
    super({
      code: 'CHAPTER_AUTOSAVE_NOT_ALLOWED',
      resource: 'chương',
      message:
        'Chương đã lên bài không tự lưu nháp; hãy bấm Lưu khi sửa xong vì độc giả thấy ngay',
    });
  }
}

export class ChapterLiveContentRequiredException extends InvalidInputException {
  constructor() {
    super({
      code: 'CHAPTER_LIVE_CONTENT_REQUIRED',
      message:
        'Chương đang hiển thị cho độc giả không được để trống; hãy giữ lại nội dung hoặc gỡ chương xuống trước',
      details: { field: 'content' },
    });
  }
}

export class InvalidChapterMediaException extends InvalidInputException {
  constructor(invalidIds: readonly string[]) {
    super({
      code: 'CHAPTER_MEDIA_INVALID',
      message: 'Một hoặc nhiều ảnh trang không hợp lệ hoặc chưa upload xong',
      details: { field: 'pages', invalidIds },
    });
  }
}

export class ChapterMediaReorderMismatchException extends InvalidInputException {
  constructor() {
    super({
      code: 'CHAPTER_MEDIA_REORDER_MISMATCH',
      message: 'Danh sách sắp xếp không khớp với các trang hiện có của chương',
      details: { field: 'orderedMediaAssetIds' },
    });
  }
}

export class ChapterInsertAmbiguousAnchorException extends InvalidInputException {
  constructor() {
    super({
      code: 'CHAPTER_INSERT_AMBIGUOUS_ANCHOR',
      message:
        'Chỉ chọn một mốc chèn: trước một chương hoặc sau một chương, không cả hai',
      details: { field: 'beforeChapterId' },
    });
  }
}

export class ChapterImportTooManyException extends InvalidInputException {
  constructor(received: number) {
    super({
      code: 'CHAPTER_IMPORT_TOO_MANY',
      message: `Mỗi lần chỉ nhập được tối đa ${ChapterImportPolicy.MAX_PER_CALL} chương, nhận được ${received}`,
      details: { field: 'chapters' },
    });
  }
}

export class ChapterInsertAnchorNotFoundException extends ResourceConflictException {
  constructor() {
    super({
      code: 'CHAPTER_INSERT_ANCHOR_NOT_FOUND',
      resource: 'chương',
      message: 'Không tìm thấy chương để chèn vào sau; hãy tải lại danh sách',
    });
  }
}

export class ChapterInsertNoGapException extends ResourceConflictException {
  constructor(afterNumber: number, beforeNumber: number) {
    super({
      code: 'CHAPTER_INSERT_NO_GAP',
      resource: 'chương',
      message:
        `Không còn số chương nào nằm giữa ${afterNumber} và ${beforeNumber}. ` +
        'Hãy chèn vào một khoảng khác, hoặc đánh số lại hai chương này.',
    });
  }
}

export class ChapterStoryPendingReviewException extends ResourceConflictException {
  constructor() {
    super({
      code: 'CHAPTER_STORY_PENDING_REVIEW',
      resource: 'chương',
      message:
        'Không thể thay đổi chương khi truyện đang chờ duyệt; hãy hủy yêu cầu duyệt trước',
    });
  }
}
