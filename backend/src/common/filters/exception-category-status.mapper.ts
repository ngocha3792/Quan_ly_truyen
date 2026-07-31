import { HttpStatus } from '@nestjs/common';

import { ExceptionCategory } from '../exceptions';

const CATEGORY_STATUS_MAP: Readonly<Record<ExceptionCategory, number>> = {
  [ExceptionCategory.BAD_REQUEST]: HttpStatus.BAD_REQUEST,
  [ExceptionCategory.UNAUTHORIZED]: HttpStatus.UNAUTHORIZED,
  [ExceptionCategory.FORBIDDEN]: HttpStatus.FORBIDDEN,
  [ExceptionCategory.NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ExceptionCategory.GONE]: HttpStatus.GONE,
  [ExceptionCategory.CONFLICT]: HttpStatus.CONFLICT,
  [ExceptionCategory.PRECONDITION_FAILED]: HttpStatus.PRECONDITION_FAILED,
  [ExceptionCategory.PAYLOAD_TOO_LARGE]: HttpStatus.PAYLOAD_TOO_LARGE,
  [ExceptionCategory.UNSUPPORTED_MEDIA_TYPE]: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
  [ExceptionCategory.UNPROCESSABLE_ENTITY]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ExceptionCategory.TOO_MANY_REQUESTS]: HttpStatus.TOO_MANY_REQUESTS,
  [ExceptionCategory.REQUEST_TIMEOUT]: HttpStatus.REQUEST_TIMEOUT,
  [ExceptionCategory.BAD_GATEWAY]: HttpStatus.BAD_GATEWAY,
  [ExceptionCategory.SERVICE_UNAVAILABLE]: HttpStatus.SERVICE_UNAVAILABLE,
  [ExceptionCategory.INTERNAL]: HttpStatus.INTERNAL_SERVER_ERROR,
};

export function mapExceptionCategoryToHttpStatus(
  category: ExceptionCategory,
): number {
  return CATEGORY_STATUS_MAP[category] ?? HttpStatus.INTERNAL_SERVER_ERROR;
}
