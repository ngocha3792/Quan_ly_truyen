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

export class InvalidStoryCategoriesException extends InvalidInputException {
  constructor(invalidIds: readonly string[]) {
    super({
      code: 'STORY_INVALID_CATEGORIES',
      message: 'Một hoặc nhiều thể loại không tồn tại hoặc đã bị vô hiệu hóa',
      details: {
        invalidCategoryIds: [...invalidIds],
      },
    });
  }
}

export class InvalidStoryTagsException extends InvalidInputException {
  constructor(invalidIds: readonly string[]) {
    super({
      code: 'STORY_INVALID_TAGS',
      message: 'Một hoặc nhiều tag không tồn tại',
      details: {
        invalidTagIds: [...invalidIds],
      },
    });
  }
}

export class InvalidStoryCoverException extends InvalidInputException {
  constructor() {
    super({
      code: 'STORY_INVALID_COVER',
      message: [
        'Ảnh bìa không hợp lệ, chưa sẵn sàng',
        'hoặc không thuộc truyện hiện tại',
      ].join(' '),
      details: {
        field: 'coverMediaId',
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
      message: 'Chỉ truyện bản nháp hoặc truyện bị từ chối mới có thể chỉnh sửa hoặc xóa',
    });
  }
}

export class StoryNotSubmittableException extends ResourceConflictException {
  constructor() {
    super({
      code: 'STORY_NOT_SUBMITTABLE',
      resource: 'truyện',
      message: 'Chỉ truyện bản nháp hoặc truyện bị từ chối mới có thể gửi duyệt',
    });
  }
}

export class StorySubmissionAlreadyPendingException extends ResourceConflictException {
  constructor() {
    super({
      code: 'STORY_SUBMISSION_ALREADY_PENDING',
      resource: 'truyện',
      message: 'Truyện đang có một yêu cầu duyệt chưa hoàn tất',
    });
  }
}

export class StoryNotReadyForReviewException extends InvalidInputException {
  constructor(missing: readonly string[]) {
    super({
      code: 'STORY_NOT_READY_FOR_REVIEW',
      message: 'Truyện chưa đủ điều kiện để gửi duyệt hoặc xuất bản',
      details: { missing: [...missing] },
    });
  }
}

export class StorySubmissionNotPendingException extends ResourceConflictException {
  constructor() {
    super({
      code: 'STORY_SUBMISSION_NOT_PENDING',
      resource: 'yêu cầu duyệt truyện',
      message: 'Yêu cầu duyệt không còn ở trạng thái chờ xử lý',
    });
  }
}

export class StorySubmissionNotFoundException extends ResourceNotFoundException {
  constructor(submissionId?: string) {
    super({
      code: 'STORY_SUBMISSION_NOT_FOUND',
      resource: 'yêu cầu duyệt truyện',
      ...(submissionId ? { identifier: submissionId } : {}),
      message: 'Không tìm thấy yêu cầu duyệt truyện',
    });
  }
}

export class StorySubmissionSelfReviewException extends ResourceConflictException {
  constructor() {
    super({
      code: 'STORY_SUBMISSION_SELF_REVIEW',
      resource: 'yêu cầu duyệt truyện',
      message: 'Người gửi không thể tự duyệt truyện của chính mình',
    });
  }
}
