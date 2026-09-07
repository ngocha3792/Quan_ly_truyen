import {
  BusinessRuleViolationException,
  InvalidInputException,
  InvalidStateTransitionException,
  ResourceNotFoundException,
  ServiceUnavailableException,
} from '@/common/exceptions';

export class InvalidBillingInputException extends InvalidInputException {
  constructor(message: string, field?: string) {
    super({
      code: 'BILLING_INPUT_INVALID',
      message,
      ...(field ? { details: { field } } : {}),
    });
  }
}

export class BillingResourceNotFoundException extends ResourceNotFoundException {
  constructor(resource: string, identifier?: string) {
    super({ code: 'BILLING_RESOURCE_NOT_FOUND', resource, identifier });
  }
}

export class PaymentProviderUnavailableException extends ServiceUnavailableException {
  constructor(message = 'Nhà cung cấp thanh toán chưa được cấu hình') {
    super({
      code: 'PAYMENT_PROVIDER_UNAVAILABLE',
      message,
      service: 'payment-provider',
    });
  }
}

export class PaymentOrderTransitionException extends InvalidStateTransitionException {
  constructor(from: string, to: string) {
    super({
      code: 'PAYMENT_ORDER_TRANSITION_INVALID',
      message: `Không thể chuyển đơn thanh toán từ ${from} sang ${to}`,
      resource: 'payment_order',
      from,
      to,
    });
  }
}

export class PaymentRolloutRestrictedException extends BusinessRuleViolationException {
  constructor() {
    super({
      code: 'PAYMENT_ROLLOUT_RESTRICTED',
      message: 'Nạp Credit chưa được mở cho tài khoản này',
      rule: 'account_must_be_in_payment_rollout',
    });
  }
}
