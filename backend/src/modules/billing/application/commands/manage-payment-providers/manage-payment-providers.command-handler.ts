import { Inject, Injectable } from '@nestjs/common';

import { AuthenticationRequiredException } from '@/common/exceptions';
import { isUuidV4 } from '@/common/utils';

import type { PaymentProviderKindName } from '../../../domain';
import { InvalidBillingInputException } from '../../../domain';
import {
  BILLING_PERSISTENCE_PORT,
  type BillingPersistencePort,
  PAYMENT_PROVIDER_REGISTRY_PORT,
  type PaymentProviderRegistryPort,
} from '../../ports';

export interface PaymentProviderMutationInput {
  readonly displayName?: string;
  readonly description?: string | null;
  readonly config?: Readonly<Record<string, unknown>>;
  readonly currency?: string;
  readonly enabled?: boolean;
  readonly sortOrder?: number;
  readonly orderTtlMinutes?: number | null;
}

@Injectable()
export class ManagePaymentProvidersCommandHandler {
  constructor(
    @Inject(BILLING_PERSISTENCE_PORT)
    private readonly persistence: BillingPersistencePort,
    @Inject(PAYMENT_PROVIDER_REGISTRY_PORT)
    private readonly registry: PaymentProviderRegistryPort,
  ) {}

  list(enabledOnly = false) {
    return this.persistence.listConnections(enabledOnly);
  }

  listKinds() {
    return this.registry.listKinds().map((kind) => ({
      kind,
      supportsWebhook: this.registry.getAdapter(kind).supportsWebhook,
      requiresManualReview: this.registry.getAdapter(kind).requiresManualReview,
      fields:
        kind === 'MANUAL_BANK_TRANSFER'
          ? [
              { name: 'bankName', label: 'Ngân hàng', required: true },
              { name: 'accountNumber', label: 'Số tài khoản', required: true },
              { name: 'accountHolder', label: 'Chủ tài khoản', required: true },
              { name: 'branch', label: 'Chi nhánh', required: false },
              {
                name: 'transferNoteTemplate',
                label: 'Mẫu nội dung',
                required: true,
                placeholder: 'NAP {{reference}}',
              },
              {
                name: 'instructionNote',
                label: 'Hướng dẫn thêm',
                required: false,
              },
            ]
          : [],
    }));
  }

  create(
    actorIdValue: string | undefined,
    input: PaymentProviderMutationInput & {
      code: string;
      kind: PaymentProviderKindName;
    },
  ) {
    const actorId = actor(actorIdValue);
    const code = input.code.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{1,49}$/u.test(code))
      throw new InvalidBillingInputException('Mã kết nối không hợp lệ', 'code');
    const validated = validateCommon(input);
    const config = this.registry
      .getAdapter(input.kind)
      .validateConfig(input.config ?? {});
    return this.persistence.createConnection({
      actorId,
      code,
      kind: input.kind,
      ...validated,
      config,
    });
  }

  async update(
    actorIdValue: string | undefined,
    id: string,
    input: PaymentProviderMutationInput,
  ) {
    const actorId = actor(actorIdValue);
    if (!isUuidV4(id))
      throw new InvalidBillingInputException('Kết nối không hợp lệ', 'id');
    const current = (await this.persistence.listConnections(false)).find(
      (item) => item.id === id,
    );
    if (!current)
      throw new InvalidBillingInputException('Không tìm thấy kết nối', 'id');
    const common = validateCommon({
      displayName: input.displayName ?? current.displayName,
      description:
        input.description === undefined
          ? current.description
          : input.description,
      currency: input.currency ?? current.currency,
      enabled: input.enabled ?? current.enabled,
      sortOrder: input.sortOrder ?? current.sortOrder,
      orderTtlMinutes:
        input.orderTtlMinutes === undefined
          ? current.orderTtlMinutes
          : input.orderTtlMinutes,
    });
    const config =
      input.config === undefined
        ? undefined
        : this.registry.getAdapter(current.kind).validateConfig(input.config);
    return this.persistence.updateConnection({
      actorId,
      id,
      ...common,
      ...(config ? { config } : {}),
    });
  }

  delete(actorIdValue: string | undefined, id: string) {
    return this.persistence.deleteConnection(actor(actorIdValue), id);
  }
}

function actor(value: string | undefined): string {
  if (!value || !isUuidV4(value)) throw new AuthenticationRequiredException();
  return value;
}

function validateCommon(input: PaymentProviderMutationInput) {
  const displayName = input.displayName?.trim() ?? '';
  const currency = input.currency?.trim().toUpperCase() ?? '';
  if (!displayName || displayName.length > 120)
    throw new InvalidBillingInputException(
      'Tên hiển thị không hợp lệ',
      'displayName',
    );
  if (!/^[A-Z]{3}$/u.test(currency))
    throw new InvalidBillingInputException('Tiền tệ không hợp lệ', 'currency');
  const description = input.description?.trim() || undefined;
  if (description && description.length > 500)
    throw new InvalidBillingInputException('Mô tả quá dài', 'description');
  const sortOrder = input.sortOrder ?? 0;
  if (!Number.isInteger(sortOrder) || sortOrder < 0)
    throw new InvalidBillingInputException('Thứ tự không hợp lệ', 'sortOrder');
  const orderTtlMinutes = input.orderTtlMinutes ?? undefined;
  if (
    orderTtlMinutes !== undefined &&
    (!Number.isInteger(orderTtlMinutes) ||
      orderTtlMinutes < 5 ||
      orderTtlMinutes > 10080)
  ) {
    throw new InvalidBillingInputException(
      'TTL phải từ 5 đến 10080 phút',
      'orderTtlMinutes',
    );
  }
  return {
    displayName,
    description,
    currency,
    enabled: input.enabled ?? false,
    sortOrder,
    orderTtlMinutes,
  };
}
