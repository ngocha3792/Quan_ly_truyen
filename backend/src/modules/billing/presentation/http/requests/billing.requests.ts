import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  PAYMENT_ORDER_STATUSES,
  PAYMENT_PROVIDER_KINDS,
} from '../../../domain';

export class CreatePaymentOrderRequest {
  @IsOptional()
  @IsUUID('4')
  storyId?: string;
  @IsUUID('4')
  packageId!: string;

  @IsOptional()
  @IsUUID('4')
  providerConnectionId?: string;
}

export class ListPaymentOrdersRequest {
  @Transform(({ value }) => Number(value ?? 1))
  @IsInt()
  @Min(1)
  page = 1;

  @Transform(({ value }) => Number(value ?? 20))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}

export class UpdateCreditPackageRequest {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @Matches(/^[1-9]\d{0,15}$/u)
  creditAmount?: string;

  @IsOptional()
  @Matches(/^[1-9]\d{0,15}$/u)
  fiatAmountMinor?: string;

  @IsOptional()
  @Matches(/^[A-Za-z]{3}$/u)
  currency?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class AdminPaymentOrderExplorerRequest extends ListPaymentOrdersRequest {
  @IsOptional()
  @IsIn(PAYMENT_ORDER_STATUSES)
  status?: (typeof PAYMENT_ORDER_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(50)
  provider?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class TransferClaimRequest {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  referenceCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ManualPaymentReviewRequest {
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason!: string;
}

export class CreatePaymentProviderRequest {
  @IsOptional()
  @IsObject()
  credentials?: Record<string, string>;
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-]{1,49}$/u)
  code!: string;

  @IsIn(PAYMENT_PROVIDER_KINDS)
  kind!: (typeof PAYMENT_PROVIDER_KINDS)[number];

  @IsString()
  @MaxLength(120)
  displayName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsObject()
  config!: Record<string, unknown>;

  @Matches(/^[A-Za-z]{3}$/u)
  currency!: string;

  @IsBoolean()
  enabled!: boolean;

  @IsInt()
  @Min(0)
  sortOrder!: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(10080)
  orderTtlMinutes?: number;
}

export class UpdatePaymentProviderRequest {
  @IsOptional()
  @IsObject()
  credentials?: Record<string, string>;
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @Matches(/^[A-Za-z]{3}$/u)
  currency?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(10080)
  orderTtlMinutes?: number;
}
