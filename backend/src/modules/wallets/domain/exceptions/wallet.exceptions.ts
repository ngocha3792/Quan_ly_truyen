import {
  BusinessRuleViolationException,
  InvalidInputException,
  ResourceNotFoundException,
} from '@/common/exceptions';

export class WalletInsufficientFundsException extends BusinessRuleViolationException {
  constructor(options: { available: bigint; required: bigint }) {
    super({
      code: 'WALLET_INSUFFICIENT_FUNDS',
      message: 'Số dư Credit không đủ để thực hiện giao dịch',
      rule: 'wallet_balance_non_negative',
      details: {
        available: options.available.toString(),
        required: options.required.toString(),
      },
    });
  }
}

export class WalletOwnerNotFoundException extends ResourceNotFoundException {
  constructor(userId: string) {
    super({
      code: 'WALLET_OWNER_NOT_FOUND',
      resource: 'tài khoản ví',
      identifier: userId,
      message: 'Không tìm thấy tài khoản có thể sở hữu ví',
    });
  }
}

export class WalletBalanceLimitExceededException extends BusinessRuleViolationException {
  constructor(limit: bigint) {
    super({
      code: 'WALLET_BALANCE_LIMIT_EXCEEDED',
      message: 'Số dư Credit đã đạt giới hạn cho phép',
      rule: 'wallet_balance_within_limit',
      details: { limit: limit.toString() },
    });
  }
}

export class InvalidWalletTransactionException extends InvalidInputException {
  constructor(message: string, field?: string) {
    super({
      code: 'WALLET_TRANSACTION_INVALID',
      message,
      ...(field ? { details: { field } } : {}),
    });
  }
}
