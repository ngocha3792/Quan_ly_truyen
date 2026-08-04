import { InvalidTokenException } from '@/common/exceptions';

export class InvalidMfaTicketException extends InvalidTokenException {
  constructor() {
    super({
      code: 'AUTH_MFA_TICKET_INVALID',
      message: 'Phiên xác minh MFA không hợp lệ hoặc đã hết hạn',
    });
  }
}
