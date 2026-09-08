import { Injectable } from '@nestjs/common';

import type {
  NormalizedPaymentEvent,
  PaymentCheckoutInput,
  PaymentCheckoutResult,
  PaymentProviderAdapter,
} from '../../application';
import { InvalidBillingInputException } from '../../domain';

interface ManualBankConfig extends Readonly<Record<string, unknown>> {
  readonly bankName: string;
  readonly accountNumber: string;
  readonly accountHolder: string;
  readonly branch: string;
  readonly transferNoteTemplate: string;
  readonly instructionNote: string;
}

@Injectable()
export class ManualBankTransferProviderAdapter implements PaymentProviderAdapter {
  readonly kind = 'MANUAL_BANK_TRANSFER' as const;
  readonly supportsWebhook = false;
  readonly requiresManualReview = true;

  validateConfig(config: unknown): ManualBankConfig {
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      throw new InvalidBillingInputException(
        'Cấu hình ngân hàng không hợp lệ',
        'config',
      );
    }
    const value = config as Record<string, unknown>;
    const transferNoteTemplate = required(value, 'transferNoteTemplate', 200);
    if (!transferNoteTemplate.includes('{{reference}}')) {
      throw new InvalidBillingInputException(
        'Mẫu nội dung chuyển khoản phải chứa {{reference}}',
        'config.transferNoteTemplate',
      );
    }
    return {
      bankName: required(value, 'bankName', 120),
      accountNumber: required(value, 'accountNumber', 80),
      accountHolder: required(value, 'accountHolder', 120),
      branch: optional(value.branch, 120),
      transferNoteTemplate,
      instructionNote: optional(value.instructionNote, 500),
    };
  }

  createCheckout(input: PaymentCheckoutInput): Promise<PaymentCheckoutResult> {
    const config = this.validateConfig(input.connection.config);
    const providerReference = `TT${input.orderId.replace(/-/gu, '').slice(0, 12).toUpperCase()}`;
    return Promise.resolve({
      kind: 'instructions',
      providerReference,
      instructions: {
        bankName: config.bankName,
        accountNumber: config.accountNumber,
        accountHolder: config.accountHolder,
        branch: config.branch || null,
        transferNote: config.transferNoteTemplate.replaceAll(
          '{{reference}}',
          providerReference,
        ),
        instructionNote: config.instructionNote || null,
      },
    });
  }

  verifyWebhook(): Promise<NormalizedPaymentEvent> {
    return Promise.reject(
      new InvalidBillingInputException(
        'Chuyển khoản thủ công không hỗ trợ webhook',
      ),
    );
  }
}

function required(
  value: Record<string, unknown>,
  field: string,
  max: number,
): string {
  const normalized = optional(value[field], max);
  if (!normalized) {
    throw new InvalidBillingInputException(
      `${field} là bắt buộc`,
      `config.${field}`,
    );
  }
  return normalized;
}

function optional(value: unknown, max: number): string {
  if (value == null) return '';
  if (typeof value !== 'string' || value.trim().length > max) {
    throw new InvalidBillingInputException(
      'Giá trị cấu hình không hợp lệ',
      'config',
    );
  }
  return value.trim();
}
