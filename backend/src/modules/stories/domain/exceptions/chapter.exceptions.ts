import {
  InvalidInputException,
  ResourceConflictException,
  ResourceNotFoundException,
} from '@/common/exceptions';

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

export class ChapterDraftOnlyMutationException extends ResourceConflictException {
  constructor() {
    super({
      code: 'CHAPTER_DRAFT_ONLY_MUTATION',
      resource: 'chương',
      message: 'Chỉ chương ở trạng thái bản nháp mới có thể chỉnh sửa hoặc xóa',
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
      message: 'Chỉ chương bản nháp mới có thể được xuất bản',
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
