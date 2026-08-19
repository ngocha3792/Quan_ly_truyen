import type { AuthPasswordPolicyConfig } from '../config/app-config.token';
import { evaluatePasswordPolicy, passwordPolicyHint } from './password-policy';
import { RegisterRequest } from './auth.models';

const USERNAME_PATTERN = /^[A-Za-z0-9_]+$/;
const SIMPLE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate trước ở frontend để cải thiện UX.
 * Backend vẫn là nơi quyết định dữ liệu có hợp lệ hay không.
 */
export function getRegisterValidationMessage(
  request: RegisterRequest,
  passwordPolicy: AuthPasswordPolicyConfig,
): string | null {
  const email = request.email.trim();
  const username = request.username.trim();
  const displayName = request.displayName.trim();
  const password = request.password;

  if (email.length < 3 || email.length > 320 || !SIMPLE_EMAIL_PATTERN.test(email)) {
    return 'Email không hợp lệ.';
  }

  if (username.length < 3 || username.length > 50) {
    return 'Tên đăng nhập phải có độ dài từ 3 đến 50 ký tự.';
  }

  if (!USERNAME_PATTERN.test(username)) {
    return 'Tên đăng nhập chỉ được chứa chữ cái, chữ số và dấu gạch dưới.';
  }

  if (displayName.length < 1 || displayName.length > 120) {
    return 'Tên hiển thị phải có độ dài từ 1 đến 120 ký tự.';
  }

  if (!evaluatePasswordPolicy(password, passwordPolicy).valid) {
    return passwordPolicyHint(passwordPolicy);
  }

  return null;
}
