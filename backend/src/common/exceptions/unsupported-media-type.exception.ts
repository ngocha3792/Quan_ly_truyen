import { AppException } from './app.exception';
import { CommonExceptionCode } from './common-exception-code.enum';
import { ExceptionCategory } from './exception-category.enum';

export class UnsupportedMediaTypeException extends AppException {
  constructor(options: {
    received?: string;
    supported?: readonly string[];
    message?: string;
  } = {}) {
    super({
      code: CommonExceptionCode.UNSUPPORTED_MEDIA_TYPE,
      message: options.message ?? 'Định dạng nội dung không được hỗ trợ',
      category: ExceptionCategory.UNSUPPORTED_MEDIA_TYPE,
      details: {
        ...(options.received ? { received: options.received } : {}),
        ...(options.supported ? { supported: options.supported } : {}),
      },
    });
  }
}
