import { InvalidInputException } from '@/common/exceptions';
import {
  CommentTooManyLinksException,
  InvalidReportException,
} from '../exceptions';

export class CommentPolicy {
  static readonly MAX_LENGTH = 4000;

  static normalizeBody(value: string): string {
    return value.normalize('NFKC').trim();
  }

  static validateBody(value: string, maxLinks: number): string {
    const normalized = this.normalizeBody(value);
    if (normalized.length < 1 || normalized.length > this.MAX_LENGTH) {
      throw new InvalidInputException({
        code: 'COMMENT_INVALID_BODY',
        message: 'Nội dung bình luận phải có từ 1 đến 4000 ký tự',
        details: { field: 'body' },
      });
    }
    const links = normalized.match(/https?:\/\/[^\s]+/gi)?.length ?? 0;
    if (links > maxLinks) throw new CommentTooManyLinksException(maxLinks);
    return normalized;
  }

  static fingerprint(value: string): string {
    return this.normalizeBody(value)
      .replace(/\s+/g, ' ')
      .toLocaleLowerCase('vi-VN');
  }

  static normalizeReportDescription(
    reason: string,
    description?: string,
  ): string | undefined {
    const normalized = description
      ?.normalize('NFKC')
      .trim()
      .replace(/\s+/g, ' ');
    if (normalized && normalized.length > 2000)
      throw new InvalidReportException(
        'Mô tả báo cáo không được vượt quá 2000 ký tự',
      );
    if (reason === 'OTHER' && (!normalized || normalized.length < 10))
      throw new InvalidReportException(
        'Lý do Khác yêu cầu mô tả ít nhất 10 ký tự',
      );
    return normalized || undefined;
  }
}
