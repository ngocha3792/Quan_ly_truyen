import { Inject, Injectable } from '@nestjs/common';

import {
  InvalidBillingInputException,
  requireBillingUserId,
} from '../../../domain';
import type { CreditPackageResultDto } from '../../dto';
import { toCreditPackageResult } from '../../mappers';
import {
  BILLING_PERSISTENCE_PORT,
  type BillingPersistencePort,
} from '../../ports';
import { UpdateCreditPackageCommand } from './update-credit-package.command';

const MAX_AMOUNT = 9_000_000_000_000_000n;

@Injectable()
export class UpdateCreditPackageCommandHandler {
  constructor(
    @Inject(BILLING_PERSISTENCE_PORT)
    private readonly persistence: BillingPersistencePort,
  ) {}

  async execute(
    command: UpdateCreditPackageCommand,
  ): Promise<CreditPackageResultDto> {
    const creditAmount = parseOptionalAmount(
      command.creditAmount,
      'creditAmount',
    );
    const fiatAmountMinor = parseOptionalAmount(
      command.fiatAmountMinor,
      'fiatAmountMinor',
    );
    const currency = command.currency?.trim().toUpperCase();
    if (currency && !/^[A-Z]{3}$/u.test(currency)) {
      throw new InvalidBillingInputException(
        'Mã tiền tệ không hợp lệ',
        'currency',
      );
    }
    const label = command.label?.trim();
    if (label !== undefined && (!label || label.length > 120)) {
      throw new InvalidBillingInputException('Tên gói không hợp lệ', 'label');
    }
    return toCreditPackageResult(
      await this.persistence.updatePackage({
        actorId: requireBillingUserId(command.actorId),
        packageId: command.packageId,
        ...(label !== undefined ? { label } : {}),
        ...(creditAmount !== undefined ? { creditAmount } : {}),
        ...(fiatAmountMinor !== undefined ? { fiatAmountMinor } : {}),
        ...(currency !== undefined ? { currency } : {}),
        ...(command.isActive !== undefined
          ? { isActive: command.isActive }
          : {}),
        ...(command.sortOrder !== undefined
          ? { sortOrder: command.sortOrder }
          : {}),
      }),
    );
  }
}

function parseOptionalAmount(
  value: string | undefined,
  field: string,
): bigint | undefined {
  if (value === undefined) return undefined;
  if (!/^[1-9]\d*$/u.test(value)) {
    throw new InvalidBillingInputException(
      `${field} phải là số nguyên dương`,
      field,
    );
  }
  const amount = BigInt(value);
  if (amount > MAX_AMOUNT) {
    throw new InvalidBillingInputException(`${field} vượt giới hạn`, field);
  }
  return amount;
}
