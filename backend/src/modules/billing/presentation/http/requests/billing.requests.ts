import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePaymentOrderRequest {
  @IsUUID('4')
  packageId!: string;
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
