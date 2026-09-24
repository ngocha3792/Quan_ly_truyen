import {
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ArrayUnique,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Trim } from '@/common/decorators';

export class RevenuePolicyRequest {
  @IsBoolean() enabled!: boolean;
  @IsInt() @Min(1) @Max(365) settlementDelayDays!: number;
  @Matches(/^[1-9]\d{0,15}$/u) minimumPayoutCredits!: string;
  @IsInt() @Min(0) @Max(9999) feeBasisPoints!: number;
  @IsInt() @Min(0) @Max(9999) taxBasisPoints!: number;
  @Matches(/^(0|[1-9]\d{0,8})$/u) fiatMinorPerCredit!: string;
  @IsInt() @Min(0) @Max(10000) minimumPlatformFeeBasisPoints!: number;
  @IsOptional() @IsUUID('4') platformUserId?: string;
}
export class CreatePayoutAccountRequest {
  @IsIn(['BANK_TRANSFER', 'MOMO', 'ZALOPAY']) method!:
    'BANK_TRANSFER' | 'MOMO' | 'ZALOPAY';
  @IsOptional() @Trim() @IsString() @MaxLength(255) bankName?: string;
  @IsOptional()
  @Trim()
  @Matches(/^[A-Za-z0-9 -]{4,80}$/u)
  accountNumber?: string;
  @Trim() @IsString() @MinLength(2) @MaxLength(255) accountName!: string;
  @IsOptional() @Matches(/^\+?[0-9]{8,15}$/u) walletPhone?: string;
  @Trim() @IsString() @MinLength(3) @MaxLength(500) kycReference!: string;
}
export class UpdatePayoutAccountRequest {
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
}
export class ReviewPayoutAccountRequest {
  @IsBoolean() verified!: boolean;
  @Trim() @IsString() @MinLength(3) @MaxLength(500) reference!: string;
}
export class CreatePayoutRequest {
  @IsUUID('4') accountId!: string;
  @Matches(/^[1-9]\d{0,15}$/u) grossAmount!: string;
}
export class CreatePayoutBatchRequest {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  requestIds!: string[];
}
export class CompletePayoutRequest {
  @Trim() @IsString() @MinLength(3) @MaxLength(255) providerTxnId!: string;
  @Trim() @IsString() @MinLength(3) @MaxLength(500) evidenceReference!: string;
}
export class FailPayoutRequest {
  @Trim() @IsString() @MinLength(3) @MaxLength(500) reason!: string;
  @Trim() @IsString() @MinLength(3) @MaxLength(500) evidenceReference!: string;
}
