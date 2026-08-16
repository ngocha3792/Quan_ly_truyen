import { InvalidInputException, ResourceConflictException, ResourceNotFoundException } from '@/common/exceptions';

export class ReportNotFoundException extends ResourceNotFoundException {
  constructor(id?: string) {
    super({ code: 'REPORT_NOT_FOUND', resource: 'báo cáo', identifier: id, message: 'Không tìm thấy báo cáo' });
  }
}

export class ReportAlreadyClosedException extends ResourceConflictException {
  constructor() {
    super({ code: 'REPORT_ALREADY_CLOSED', message: 'Báo cáo đã được đóng bởi một moderator khác' });
  }
}

export class InvalidReportResolutionException extends InvalidInputException {
  constructor() {
    super({ code: 'REPORT_RESOLUTION_NOTE_REQUIRED', message: 'Ghi chú xử lý phải có từ 10 đến 2000 ký tự', details: { field: 'note' } });
  }
}

export class InvalidCommentModerationTransitionException extends ResourceConflictException {
  constructor(from: string, to: string) {
    super({ code: 'COMMENT_MODERATION_TRANSITION_INVALID', message: `Không thể chuyển trạng thái bình luận từ ${from} sang ${to}`, details: { from, to } });
  }
}

export class ModerationReportMismatchException extends ResourceConflictException {
  constructor() {
    super({ code: 'MODERATION_REPORT_COMMENT_MISMATCH', message: 'Báo cáo không thuộc bình luận đang được xử lý' });
  }
}

export class InvalidModerationReasonException extends InvalidInputException {
  constructor() {
    super({ code: 'COMMENT_MODERATION_REASON_REQUIRED', message: 'Lý do kiểm duyệt phải có từ 10 đến 2000 ký tự', details: { field: 'reason' } });
  }
}

export class InvalidWarningMessageException extends InvalidInputException {
  constructor() {
    super({ code: 'COMMENT_WARNING_MESSAGE_INVALID', message: 'Nội dung cảnh báo phải có từ 10 đến 1000 ký tự', details: { field: 'message' } });
  }
}
