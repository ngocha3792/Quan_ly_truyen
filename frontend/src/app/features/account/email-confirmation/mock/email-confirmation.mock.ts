
import {
    EmailConfirmationResult,
} from '../domain/email-confirmation.models';

export const EMAIL_CONFIRMATION_RESULT_MOCK:
    EmailConfirmationResult = {
    email: 'nguyenvana.author@gmail.com',
    confirmedAt: new Date().toISOString(),

    message:
        'Email mới của bạn đã được xác nhận thành công.',
};