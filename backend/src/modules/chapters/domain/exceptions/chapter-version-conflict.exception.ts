import { ResourceConflictException } from '@/common/exceptions';

export class ChapterVersionConflictException extends ResourceConflictException {
  constructor(currentVersion: number) {
    super({
      code: 'CHAPTER_VERSION_CONFLICT',
      resource: 'chương',
      message:
        'Chương đã được cập nhật bởi người khác. Hãy tải lại bản mới trước khi lưu.',
      details: { currentVersion },
    });
  }
}
