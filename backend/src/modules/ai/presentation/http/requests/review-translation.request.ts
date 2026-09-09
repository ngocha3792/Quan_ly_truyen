import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class ReviewTranslationRequest {
  @IsIn(['APPROVE', 'REJECT', 'REQUEST_REVISION'])
  decision!: 'APPROVE' | 'REJECT' | 'REQUEST_REVISION';
  @IsUUID('4') translationId!: string;
  @IsInt() @Min(1) generation!: number;
  @IsInt() @Min(1) expectedVersion!: number;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsOptional() @IsString() @MaxLength(255) translatedTitle?: string;
  @IsOptional() @IsString() @MaxLength(200000) translatedContent?: string;
}
