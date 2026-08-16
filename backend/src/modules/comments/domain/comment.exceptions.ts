import {
  InvalidInputException,
  ResourceConflictException,
  ResourceNotFoundException,
  ServiceUnavailableException,
} from '@/common/exceptions';

export class CommentNotFoundException extends ResourceNotFoundException {
  constructor(id?: string) {
    super({
      code: 'COMMENT_NOT_FOUND',
      resource: 'bình luận',
      identifier: id,
      message: 'Không tìm thấy bình luận',
    });
  }
}

export class CommentNotReplyableException extends ResourceConflictException {
  constructor() {
    super({
      code: 'COMMENT_NOT_REPLYABLE',
      message: 'Bình luận này không còn nhận phản hồi',
    });
  }
}

export class CommentReplyDepthExceededException extends ResourceConflictException {
  constructor() {
    super({
      code: 'COMMENT_REPLY_DEPTH_EXCEEDED',
      message: 'Luồng bình luận chỉ hỗ trợ tối đa hai cấp phản hồi',
    });
  }
}

export class CommentNotReactableException extends ResourceConflictException {
  constructor() {
    super({
      code: 'COMMENT_NOT_REACTABLE',
      message: 'Bình luận này không còn nhận cảm xúc',
    });
  }
}

export class CommentNotReportableException extends ResourceConflictException {
  constructor() {
    super({
      code: 'COMMENT_NOT_REPORTABLE',
      message: 'Bình luận này không còn có thể được báo cáo',
    });
  }
}

export class CommentSelfReportNotAllowedException extends InvalidInputException {
  constructor() {
    super({
      code: 'COMMENT_SELF_REPORT_NOT_ALLOWED',
      message: 'Bạn không thể báo cáo bình luận của chính mình',
    });
  }
}

export class ReportAlreadyOpenException extends ResourceConflictException {
  constructor() {
    super({
      code: 'REPORT_ALREADY_OPEN',
      message: 'Bạn đã có một báo cáo đang được xử lý cho bình luận này',
    });
  }
}

export class InvalidReportException extends InvalidInputException {
  constructor(message = 'Nội dung báo cáo không hợp lệ') {
    super({ code: 'COMMENT_REPORT_INVALID', message });
  }
}

export class CommentDuplicateRecentException extends ResourceConflictException {
  constructor() {
    super({
      code: 'COMMENT_DUPLICATE_RECENT',
      message:
        'Bạn vừa gửi một bình luận có nội dung tương tự trong ngữ cảnh này',
    });
  }
}

export class CommentTooManyLinksException extends InvalidInputException {
  constructor(limit: number) {
    super({
      code: 'COMMENT_TOO_MANY_LINKS',
      message: `Bình luận chỉ được chứa tối đa ${limit} liên kết`,
      details: { limit },
    });
  }
}

export class AbuseProtectionUnavailableException extends ServiceUnavailableException {
  constructor() {
    super({
      code: 'ABUSE_PROTECTION_UNAVAILABLE',
      message: 'Hệ thống chống lạm dụng tạm thời không khả dụng',
      service: 'comment-abuse-protection',
    });
  }
}
