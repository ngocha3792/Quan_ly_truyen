import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsIn,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  READER_ANALYTICS_EVENT_TYPE_VALUES,
  type ReaderAnalyticsEventTypeName,
} from '../../../domain';

export class ReaderAnalyticsEventRequest {
  @IsUUID('4') eventId!: string;
  @IsIn(READER_ANALYTICS_EVENT_TYPE_VALUES) type!: ReaderAnalyticsEventTypeName;
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
