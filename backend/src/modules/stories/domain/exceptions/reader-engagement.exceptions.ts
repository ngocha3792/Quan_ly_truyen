import {
  InvalidInputException,
  ResourceNotFoundException,
} from '@/common/exceptions';

export class InvalidCommentBodyException extends InvalidInputException {
  constructor() {
    super({
      code: 'COMMENT_INVALID_BODY',
      message: 'Nội dung bình luận phải có từ 1 đến 4000 ký tự',
      details: { field: 'body' },
    });
  }
}

export class CommentNotFoundException extends ResourceNotFoundException {
  constructor(commentId?: string) {
    super({
      code: 'COMMENT_NOT_FOUND',
      resource: 'bình luận',
      ...(commentId ? { identifier: commentId } : {}),
      message: 'Không tìm thấy bình luận',
    });
  }
}
