import { RegisterRequest } from './auth.models';

const USERNAME_PATTERN = /^[A-Za-z0-9_]+$/;
const SIMPLE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate trước ở frontend để cải thiện UX.
 * Backend vẫn là nơi quyết định dữ liệu có hợp lệ hay không.
 */
export function getRegisterValidationMessage(request: RegisterRequest): string | null {
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

  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialCharacter = /[^A-Za-z0-9]/.test(password);

  if (
    password.length < 8 ||
    password.length > 72 ||
    !hasLowercase ||
    !hasUppercase ||
    !hasNumber ||
    !hasSpecialCharacter
  ) {
    return [
      'Mật khẩu phải dài 8–72 ký tự,',
      'gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt.',
    ].join(' ');
  }

  return null;
}
