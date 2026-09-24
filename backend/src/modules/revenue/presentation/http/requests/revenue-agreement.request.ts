import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsISO8601,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class ContributorRevenueShareRequest {
  @IsUUID('4') userId!: string;
  @IsInt() @Min(1) @Max(10000) shareBps!: number;
}
export class CreateRevenueAgreementRequest {
  @IsUUID('4') storyId!: string;
  @IsInt() @Min(0) @Max(10000) authorShareBps!: number;
  @IsInt() @Min(0) @Max(10000) platformFeeBps!: number;
  @IsOptional() @IsISO8601({ strict: true }) effectiveFrom?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(16)
  @ValidateNested({ each: true })
  @Type(() => ContributorRevenueShareRequest)
  contributorShares?: ContributorRevenueShareRequest[];
}
export class ListRevenueAgreementRequest {
  @IsUUID('4') storyId!: string;
}
export class SettleRevenueRequest {
  @IsOptional() @IsInt() @Min(1) @Max(500) limit?: number;
}
