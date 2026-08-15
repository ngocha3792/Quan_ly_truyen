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
