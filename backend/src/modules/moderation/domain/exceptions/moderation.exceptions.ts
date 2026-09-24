import {
  InvalidInputException,
  ResourceConflictException,
  ResourceNotFoundException,
} from '@/common/exceptions';

export class InvalidCommentModerationTransitionException extends ResourceConflictException {
  constructor(from: string, to: string) {
    super({
      code: 'COMMENT_MODERATION_TRANSITION_INVALID',
      message: `Không thể chuyển trạng thái bình luận từ ${from} sang ${to}`,
      details: { from, to },
    });
  }
}

export class ModerationReportMismatchException extends ResourceConflictException {
  constructor() {
    super({
      code: 'MODERATION_REPORT_COMMENT_MISMATCH',
      message: 'Báo cáo không thuộc bình luận đang được xử lý',
    });
  }
}

export class InvalidModerationReasonException extends InvalidInputException {
  constructor() {
    super({
      code: 'COMMENT_MODERATION_REASON_REQUIRED',
      message: 'Lý do kiểm duyệt phải có từ 10 đến 2000 ký tự',
      details: { field: 'reason' },
    });
  }
}

export class InvalidWarningMessageException extends InvalidInputException {
  constructor() {
    super({
      code: 'COMMENT_WARNING_MESSAGE_INVALID',
      message: 'Nội dung cảnh báo phải có từ 10 đến 1000 ký tự',
      details: { field: 'message' },
    });
  }
}

export class InvalidTakedownReasonException extends InvalidInputException {
  constructor() {
    super({
      code: 'CONTENT_TAKEDOWN_REASON_REQUIRED',
      message: 'Lý do gỡ nội dung phải có từ 10 đến 2000 ký tự',
      details: { field: 'reason' },
    });
  }
}

export class TakedownStoryNotFoundException extends ResourceNotFoundException {
  constructor(storyId: string) {
    super({
      code: 'STORY_NOT_FOUND',
      resource: 'truyện',
      identifier: storyId,
      message: 'Không tìm thấy truyện',
    });
  }
}

export class TakedownChapterNotFoundException extends ResourceNotFoundException {
  constructor(chapterId: string) {
    super({
      code: 'CHAPTER_NOT_FOUND',
      resource: 'chương',
      identifier: chapterId,
      message: 'Không tìm thấy chương',
    });
  }
}

/**
 * Chặn mặc định khi nội dung đã có người mua: admin phải gửi
 * `acknowledgePurchases` để nhận trách nhiệm cắt quyền đọc đã trả tiền.
 */
export class ContentTakedownPurchasesExistException extends ResourceConflictException {
  constructor(purchaseCount: number) {
    super({
      code: 'CONTENT_TAKEDOWN_PURCHASES_EXIST',
      message: `Nội dung này đã có ${purchaseCount} lượt mua. Gửi lại với acknowledgePurchases = true nếu vẫn muốn gỡ.`,
      details: { purchaseCount },
    });
  }
}
