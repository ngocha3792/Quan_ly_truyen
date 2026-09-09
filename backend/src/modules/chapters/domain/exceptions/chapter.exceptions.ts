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
