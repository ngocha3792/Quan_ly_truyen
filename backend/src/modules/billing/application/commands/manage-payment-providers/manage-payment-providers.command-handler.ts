import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PAYMENT_CREDENTIAL_VAULT_PORT,
  type PaymentCredentialVaultPort,
} from '../../ports/payment-credential-vault.port';
import {
  publicProviderConfiguration,
  suppliedCredentials,
  VNPAY_ADMIN_FIELDS,
} from './provider-configuration';

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
  readonly credentials?: Readonly<Record<string, string>>;
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
    @Inject(PAYMENT_CREDENTIAL_VAULT_PORT)
    private readonly vault: PaymentCredentialVaultPort,
    private readonly configService: ConfigService,
  ) {}

  async list(enabledOnly = false) {
    return (await this.persistence.listConnections(enabledOnly)).map((item) =>
      this.view(item),
    );
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
          : kind === 'VNPAY'
            ? VNPAY_ADMIN_FIELDS
            : [],
    }));
  }

  async create(
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
    const secrets = suppliedCredentials(input.credentials);
    if (secrets && input.kind !== 'VNPAY')
      throw new InvalidBillingInputException(
        'Loại kết nối này không nhận khóa ký',
        'credentials',
      );
    this.validateReturnUrl(input.kind, config);
    if (validated.enabled) this.validateActivation(input.kind, config);
    if (validated.enabled)
      this.registry.getAdapter(input.kind).assertReady?.({
        id: '',
        code,
        kind: input.kind,
        config,
        displayName: validated.displayName,
        currency: validated.currency,
        orderTtlMinutes: validated.orderTtlMinutes ?? null,
        secrets,
      });
    return this.view(
      await this.persistence.createConnection({
        actorId,
        code,
        kind: input.kind,
        ...validated,
        config,
        ...(secrets
          ? { encryptedCredential: this.vault.seal(code, secrets) }
          : {}),
      }),
    );
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
    const supplied = suppliedCredentials(input.credentials);
    if (supplied && current.kind !== 'VNPAY')
      throw new InvalidBillingInputException(
        'Loại kết nối này không nhận khóa ký',
        'credentials',
      );
    const secrets =
      supplied ??
      (common.enabled
        ? this.vault.open(current.code, current.encryptedCredential)
        : undefined);
    this.validateReturnUrl(current.kind, config ?? current.config);
    if (common.enabled)
      this.validateActivation(current.kind, config ?? current.config);
    if (common.enabled)
      this.registry.getAdapter(current.kind).assertReady?.({
        ...current,
        ...common,
        config: config ?? current.config,
        orderTtlMinutes: common.orderTtlMinutes ?? null,
        secrets,
      });
    return this.view(
      await this.persistence.updateConnection({
        actorId,
        id,
        ...common,
        ...(config ? { config } : {}),
        ...(supplied
          ? { encryptedCredential: this.vault.seal(current.code, supplied) }
          : {}),
      }),
    );
  }

  delete(actorIdValue: string | undefined, id: string) {
    return this.persistence.deleteConnection(actor(actorIdValue), id);
  }

  private view(
    record: Awaited<ReturnType<BillingPersistencePort['resolveConnection']>>,
  ) {
    return publicProviderConfiguration(
      record,
      this.vault.available(),
      this.configService.get<string>('app.publicUrl') ??
        'http://localhost:4200',
    );
  }
  private validateReturnUrl(
    kind: PaymentProviderKindName,
    config: Readonly<Record<string, unknown>>,
  ) {
    if (kind !== 'VNPAY' || !config.returnUrl) return;
    const origin = new URL(
      this.configService.get<string>('app.publicUrl') ??
        'http://localhost:4200',
    ).origin;
    if (
      typeof config.returnUrl !== 'string' ||
      new URL(config.returnUrl).origin !== origin
    )
      throw new InvalidBillingInputException(
        'URL quay lại phải thuộc website này',
        'returnUrl',
      );
  }

  private validateActivation(
    kind: PaymentProviderKindName,
    config: Readonly<Record<string, unknown>>,
  ) {
    if (
      kind === 'VNPAY' &&
      this.configService.get<string>('app.environment') === 'production' &&
      config.environment !== 'PRODUCTION'
    )
      throw new InvalidBillingInputException(
        'Production chỉ kích hoạt cấu hình VNPAY Production. Bạn vẫn có thể lưu Sandbox ở trạng thái tắt.',
        'environment',
      );
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
