import {
  InvalidInputException,
  ResourceConflictException,
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
