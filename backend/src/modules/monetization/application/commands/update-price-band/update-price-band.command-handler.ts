import { Inject, Injectable } from '@nestjs/common';
import { isUuidV4 } from '@/common/utils';

import {
  assertCreditPrice,
  InvalidMonetizationInputException,
  requireMonetizationUserId,
} from '../../../domain';
import type { PriceBandResultDto } from '../../dto';
import { toPriceBandResult } from '../../mappers';
import {
  MONETIZATION_PERSISTENCE_PORT,
  type MonetizationPersistencePort,
} from '../../ports';
import { UpdatePriceBandCommand } from './update-price-band.command';

@Injectable()
export class UpdatePriceBandCommandHandler {
  constructor(
    @Inject(MONETIZATION_PERSISTENCE_PORT)
    private readonly persistence: MonetizationPersistencePort,
  ) {}

  async execute(command: UpdatePriceBandCommand): Promise<PriceBandResultDto> {
    const actorId = requireMonetizationUserId(command.actorId);
    if (!isUuidV4(command.priceBandId)) {
      throw new InvalidMonetizationInputException(
        'Price band không hợp lệ',
        'priceBandId',
      );
    }
    const label = command.label?.trim();
    if (label !== undefined && (label.length < 1 || label.length > 120)) {
      throw new InvalidMonetizationInputException(
        'Nhãn price band phải có từ 1 đến 120 ký tự',
        'label',
      );
    }
    let creditPrice: bigint | undefined;
    if (command.creditPrice !== undefined) {
      try {
        creditPrice = BigInt(command.creditPrice);
      } catch {
        throw new InvalidMonetizationInputException(
          'Giá Credit phải là số nguyên',
          'creditPrice',
        );
      }
      assertCreditPrice(creditPrice);
    }
    if (
      label === undefined &&
      creditPrice === undefined &&
      command.isActive === undefined &&
      command.sortOrder === undefined
    ) {
      throw new InvalidMonetizationInputException(
        'Không có thay đổi price band',
      );
    }

    return toPriceBandResult(
      await this.persistence.updatePriceBand({
        actorId,
        priceBandId: command.priceBandId,
        ...(label !== undefined ? { label } : {}),
        ...(creditPrice !== undefined ? { creditPrice } : {}),
        ...(command.isActive !== undefined
          ? { isActive: command.isActive }
          : {}),
        ...(command.sortOrder !== undefined
          ? { sortOrder: command.sortOrder }
          : {}),
        ...(command.ipAddress ? { ipAddress: command.ipAddress } : {}),
        ...(command.userAgent ? { userAgent: command.userAgent } : {}),
        ...(command.requestId ? { requestId: command.requestId } : {}),
      }),
    );
  }
}
