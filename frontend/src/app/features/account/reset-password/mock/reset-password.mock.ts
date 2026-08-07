
import {
    ResetPasswordConfig,
    ResetPasswordResult,
    ResetPasswordTokenValidation,
} from '../domain/reset-password.models';

export const RESET_PASSWORD_CONFIG_MOCK:
    ResetPasswordConfig = {
    minimumLength: 8,
    maximumLength: 64,
    tokenExpiresInMinutes: 15,
};

export const RESET_PASSWORD_TOKEN_MOCK:
    ResetPasswordTokenValidation = {
    email: 'nguyenvana@gmail.com',

    expiresAt: new Date(
        Date.now() + 15 * 60 * 1000,
    ).toISOString(),

    isValid: true,
};

export const RESET_PASSWORD_RESULT_MOCK:
    ResetPasswordResult = {
    email: 'nguyenvana@gmail.com',
    changedAt: new Date().toISOString(),

    message:
        'Mật khẩu của bạn đã được cập nhật thành công.',
};