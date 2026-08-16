import { HttpErrorResponse } from '@angular/common/http';

import { ApiErrorEnvelope } from './api-envelope.model';

interface ApiValidationIssue {
  readonly field?: unknown;

  readonly message?: unknown;
}

/**
 * Đọc stable backend error code từ ApiErrorEnvelope.
 *
 * Ví dụ:
 *
 * AUTH_INVALID_REFRESH_TOKEN
 * AUTH_REFRESH_TOKEN_REUSE_DETECTED
 * AUTH_CSRF_TOKEN_MISMATCH
 *
 * Không suy luận code từ HTTP status.
 */
export function getApiErrorCode(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }

  const body = error.error as Partial<ApiErrorEnvelope> | null | undefined;

  const code = body?.error?.code;

  if (typeof code !== 'string' || !code.trim()) {
    return null;
  }

  return code.trim();
}

export function getApiErrorMessage(
  error: unknown,

  fallbackMessage = 'Đã có lỗi xảy ra. Vui lòng thử lại.',
): string {
  if (error instanceof HttpErrorResponse) {
    const body = error.error as Partial<ApiErrorEnvelope> | undefined;

    const validationMessage = getValidationIssueMessage(body);

    if (validationMessage) {
      return validationMessage;
    }

    const backendMessage = body?.error?.message;
    const retryAfterSeconds = readRetryAfterSeconds(body);

    if (error.status === 429 && retryAfterSeconds !== null) {
      const message = typeof backendMessage === 'string' && backendMessage.trim()
        ? backendMessage.trim()
        : 'Bạn thao tác quá nhanh.';
      return `${message} Vui lòng thử lại sau ${retryAfterSeconds} giây.`;
    }

    if (typeof backendMessage === 'string' && backendMessage.trim()) {
      return backendMessage.trim();
    }

    if (error.status === 0) {
      return [
        'Không thể kết nối backend.',
        'Hãy kiểm tra server NestJS đang chạy ở cổng 3000.',
      ].join(' ');
    }

    if (error.status === 400) {
      return 'Dữ liệu gửi lên không hợp lệ.';
    }

    if (error.status === 401) {
      return 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.';
    }

    if (error.status === 403) {
      return 'Bạn không có quyền thực hiện thao tác này.';
    }

    if (error.status >= 500) {
      return 'Backend đang gặp lỗi. Vui lòng thử lại sau.';
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return fallbackMessage;
}

function getValidationIssueMessage(body: Partial<ApiErrorEnvelope> | undefined): string | null {
  const details = body?.error?.details;

  if (!isRecord(details)) {
    return null;
  }

  const issues = details['issues'];

  if (!Array.isArray(issues)) {
    return null;
  }

  const messages = issues
    .map((issue: unknown) => readIssueMessage(issue))
    .filter((message): message is string => Boolean(message));

  const uniqueMessages = [...new Set(messages)];

  return uniqueMessages.length > 0 ? uniqueMessages.join(' ') : null;
}

function readIssueMessage(issue: unknown): string | null {
  if (!isRecord(issue)) {
    return null;
  }

  const validationIssue = issue as ApiValidationIssue;

  if (typeof validationIssue.message === 'string' && validationIssue.message.trim()) {
    return validationIssue.message.trim();
  }

  return null;
}

function readRetryAfterSeconds(body: Partial<ApiErrorEnvelope> | undefined): number | null {
  const details = body?.error?.details;
  if (!isRecord(details)) return null;
  const value = details['retryAfterSeconds'];
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return Math.ceil(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
