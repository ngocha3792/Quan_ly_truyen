
import { ForgotPasswordResult } from '../domain/forgot-password.models';

export const FORGOT_PASSWORD_RESULT_MOCK:
    ForgotPasswordResult = {
    email: 'example@email.com',
    requestedAt: new Date().toISOString(),
    expiresInMinutes: 15,

    message:
        'Liên kết đặt lại mật khẩu đã được gửi đến email của bạn.',
};