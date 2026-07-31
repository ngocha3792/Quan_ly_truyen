/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison -- Nest HttpStatus is a numeric enum while exception statuses are intentionally transport numbers. */
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

import {
  AppException,
  CommonExceptionCode,
  isAppException,
} from '../exceptions';
import { mapExceptionCategoryToHttpStatus } from './exception-category-status.mapper';
import {
  NormalizedException,
  PublicExceptionDetails,
} from './normalized-exception.interface';

type UnknownRecord = Record<string, unknown>;

interface HttpErrorLike extends UnknownRecord {
  statusCode: number;
}

@Injectable()
export class ExceptionNormalizer {
  normalize(exception: unknown): NormalizedException {
    if (isAppException(exception)) {
      return this.normalizeAppException(exception);
    }

    if (exception instanceof HttpException) {
      return this.normalizeHttpException(exception);
    }

    if (this.isHttpErrorLike(exception)) {
      return this.normalizeHttpErrorLike(exception);
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: CommonExceptionCode.INTERNAL_ERROR,
      message: 'Đã xảy ra lỗi hệ thống',
      retryable: false,
      logLevel: 'error',
    };
  }

  private normalizeAppException(exception: AppException): NormalizedException {
    const status = mapExceptionCategoryToHttpStatus(exception.category);
    const expose = exception.expose && status < 500;

    return {
      status,
      code: expose ? exception.code : CommonExceptionCode.INTERNAL_ERROR,
      message: expose
        ? exception.message
        : this.defaultMessageForStatus(status),
      ...(expose && exception.details ? { details: exception.details } : {}),
      retryable: exception.retryable,
      logLevel: status >= 500 ? 'error' : 'warn',
    };
  }

  private normalizeHttpException(
    exception: HttpException,
  ): NormalizedException {
    const status = exception.getStatus();
    const response = exception.getResponse();

    if (typeof response === 'string') {
      return {
        status,
        code: this.defaultCodeForStatus(status),
        message: response,
        retryable: this.defaultRetryableForStatus(status),
        logLevel: status >= 500 ? 'error' : 'warn',
      };
    }

    const body = this.asRecord(response);
    const code =
      this.readString(body.code) ?? this.defaultCodeForStatus(status);
    const retryable =
      typeof body.retryable === 'boolean'
        ? body.retryable
        : this.defaultRetryableForStatus(status);

    const normalizedMessage = this.extractHttpMessage(body, status);
    const details = this.extractHttpDetails(body);

    return {
      status,
      code,
      message: normalizedMessage,
      ...(details ? { details } : {}),
      retryable,
      logLevel: status >= 500 ? 'error' : 'warn',
    };
  }

  private normalizeHttpErrorLike(
    exception: HttpErrorLike,
  ): NormalizedException {
    const status = exception.statusCode;
    const code =
      this.readString(exception.code) ?? this.defaultCodeForStatus(status);
    const message =
      this.readString(exception.message) ??
      this.defaultMessageForStatus(status);

    return {
      status,
      code,
      message,
      retryable: this.defaultRetryableForStatus(status),
      logLevel: status >= 500 ? 'error' : 'warn',
    };
  }

  private extractHttpMessage(body: UnknownRecord, status: number): string {
    if (typeof body.message === 'string' && body.message.trim()) {
      return body.message;
    }

    if (Array.isArray(body.message)) {
      return status === HttpStatus.BAD_REQUEST
        ? 'Dữ liệu gửi lên không hợp lệ'
        : this.defaultMessageForStatus(status);
    }

    if (typeof body.error === 'string' && body.error.trim()) {
      return body.error;
    }

    return this.defaultMessageForStatus(status);
  }

  private extractHttpDetails(
    body: UnknownRecord,
  ): PublicExceptionDetails | undefined {
    if (this.isRecord(body.details)) {
      return body.details;
    }

    if (Array.isArray(body.issues)) {
      return { issues: body.issues };
    }

    if (Array.isArray(body.message)) {
      return { messages: body.message };
    }

    return undefined;
  }

  private defaultCodeForStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return CommonExceptionCode.INVALID_INPUT;
      case HttpStatus.UNAUTHORIZED:
        return CommonExceptionCode.AUTHENTICATION_REQUIRED;
      case HttpStatus.FORBIDDEN:
        return CommonExceptionCode.ACCESS_DENIED;
      case HttpStatus.NOT_FOUND:
        return CommonExceptionCode.RESOURCE_NOT_FOUND;
      case HttpStatus.GONE:
        return CommonExceptionCode.RESOURCE_GONE;
      case HttpStatus.CONFLICT:
        return CommonExceptionCode.RESOURCE_CONFLICT;
      case HttpStatus.PRECONDITION_FAILED:
        return CommonExceptionCode.PRECONDITION_FAILED;
      case HttpStatus.PAYLOAD_TOO_LARGE:
        return CommonExceptionCode.PAYLOAD_TOO_LARGE;
      case HttpStatus.UNSUPPORTED_MEDIA_TYPE:
        return CommonExceptionCode.UNSUPPORTED_MEDIA_TYPE;
      case HttpStatus.TOO_MANY_REQUESTS:
        return CommonExceptionCode.RATE_LIMIT_EXCEEDED;
      case HttpStatus.REQUEST_TIMEOUT:
        return CommonExceptionCode.REQUEST_TIMEOUT;
      case HttpStatus.BAD_GATEWAY:
        return CommonExceptionCode.EXTERNAL_SERVICE_ERROR;
      case HttpStatus.SERVICE_UNAVAILABLE:
        return CommonExceptionCode.SERVICE_UNAVAILABLE;
      default:
        return status >= 500
          ? CommonExceptionCode.INTERNAL_ERROR
          : `HTTP_${status}`;
    }
  }

  private defaultMessageForStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'Yêu cầu không hợp lệ';
      case HttpStatus.UNAUTHORIZED:
        return 'Bạn cần đăng nhập để thực hiện thao tác này';
      case HttpStatus.FORBIDDEN:
        return 'Bạn không có quyền thực hiện thao tác này';
      case HttpStatus.NOT_FOUND:
        return 'Không tìm thấy tài nguyên';
      case HttpStatus.GONE:
        return 'Tài nguyên không còn tồn tại';
      case HttpStatus.CONFLICT:
        return 'Dữ liệu đang bị xung đột';
      case HttpStatus.PRECONDITION_FAILED:
        return 'Điều kiện thực hiện thao tác chưa được đáp ứng';
      case HttpStatus.PAYLOAD_TOO_LARGE:
        return 'Dữ liệu gửi lên vượt quá giới hạn cho phép';
      case HttpStatus.UNSUPPORTED_MEDIA_TYPE:
        return 'Định dạng dữ liệu không được hỗ trợ';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'Không thể xử lý dữ liệu theo quy tắc nghiệp vụ';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'Bạn đã gửi quá nhiều yêu cầu';
      case HttpStatus.REQUEST_TIMEOUT:
        return 'Yêu cầu đã hết thời gian xử lý';
      case HttpStatus.BAD_GATEWAY:
        return 'Dịch vụ phụ thuộc trả về phản hồi không hợp lệ';
      case HttpStatus.SERVICE_UNAVAILABLE:
        return 'Dịch vụ hiện không khả dụng';
      default:
        return status >= 500
          ? 'Đã xảy ra lỗi hệ thống'
          : 'Yêu cầu không thể được xử lý';
    }
  }

  private defaultRetryableForStatus(status: number): boolean {
    return [
      HttpStatus.REQUEST_TIMEOUT,
      HttpStatus.BAD_GATEWAY,
      HttpStatus.SERVICE_UNAVAILABLE,
      HttpStatus.GATEWAY_TIMEOUT,
    ].includes(status);
  }

  private isHttpErrorLike(value: unknown): value is HttpErrorLike {
    if (!this.isRecord(value)) {
      return false;
    }

    return (
      typeof value.statusCode === 'number' &&
      value.statusCode >= 400 &&
      value.statusCode <= 599
    );
  }

  private asRecord(value: object): UnknownRecord {
    return value as UnknownRecord;
  }

  private isRecord(value: unknown): value is UnknownRecord {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  private readString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim().length > 0
      ? value.trim()
      : undefined;
  }
}
