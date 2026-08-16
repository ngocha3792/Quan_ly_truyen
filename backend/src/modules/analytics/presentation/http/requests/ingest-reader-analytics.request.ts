import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ReaderAnalyticsEventType } from '@/generated/prisma/client';

export class ReaderAnalyticsEventRequest {
  @IsUUID('4') eventId!: string;
  @IsEnum(ReaderAnalyticsEventType) type!: ReaderAnalyticsEventType;
  @IsInt() @Min(1) @Max(1) version!: number;
  @IsUUID('4') sessionId!: string;
  @IsUUID('4') storyId!: string;
  @IsOptional() @IsUUID('4') chapterId?: string;
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  progressPercent?: number;
  @IsOptional() @IsInt() @Min(0) @Max(60) activeSeconds?: number;
  @IsDateString({ strict: true }) occurredAt!: string;
}

export class IngestReaderAnalyticsRequest {
  @IsOptional() @IsUUID('4') anonymousReaderId?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ReaderAnalyticsEventRequest)
  events!: ReaderAnalyticsEventRequest[];
}
