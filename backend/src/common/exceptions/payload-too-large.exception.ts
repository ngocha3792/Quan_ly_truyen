import { AppException } from './app.exception';
import { CommonExceptionCode } from './common-exception-code.enum';
import { ExceptionCategory } from './exception-category.enum';

export class PayloadTooLargeException extends AppException {
  constructor(
    options: {
      maxBytes?: number;
      actualBytes?: number;
      message?: string;
    } = {},
  ) {
    super({
      code: CommonExceptionCode.PAYLOAD_TOO_LARGE,
      message:
        options.message ?? 'Dữ liệu tải lên vượt quá kích thước cho phép',
      category: ExceptionCategory.PAYLOAD_TOO_LARGE,
      details: {
        ...(options.maxBytes !== undefined
          ? { maxBytes: options.maxBytes }
          : {}),
        ...(options.actualBytes !== undefined
          ? { actualBytes: options.actualBytes }
          : {}),
      },
    });
  }
}
