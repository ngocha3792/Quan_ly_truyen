import {
  ResourceConflictException,
  InvalidInputException,
  ResourceNotFoundException,
} from '@/common/exceptions';

export class InvalidStoryFieldException extends InvalidInputException {
  constructor(field: string, message: string) {
    super({
      code: 'STORY_INVALID_FIELD',
      message,
      details: {
        field,
      },
    });
  }
}

export class AuthorProfileUnavailableException extends ResourceNotFoundException {
  constructor() {
    super({
      code: 'AUTHOR_PROFILE_UNAVAILABLE',
      resource: 'hồ sơ tác giả',
      message: 'Không tìm thấy hồ sơ tác giả',
    });
  }
}

export class StoryNotFoundException extends ResourceNotFoundException {
  constructor(storyId?: string) {
    super({
      code: 'STORY_NOT_FOUND',
      resource: 'truyện',
      ...(storyId
        ? {
            identifier: storyId,
          }
        : {}),
      message: 'Không tìm thấy truyện',
    });
  }
}

export class StoryDraftOnlyMutationException extends ResourceConflictException {
  constructor() {
    super({
      code: 'STORY_DRAFT_ONLY_MUTATION',
      resource: 'truyện',
      message: 'Chỉ truyện ở trạng thái bản nháp mới có thể chỉnh sửa hoặc xóa',
    });
  }
}
