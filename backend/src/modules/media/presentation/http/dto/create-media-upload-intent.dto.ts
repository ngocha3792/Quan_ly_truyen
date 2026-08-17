import {
  IsEnum,
  IsInt,
  IsMimeType,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { MediaPurpose } from '@/generated/prisma/client';

export class CreateMediaUploadIntentDto {
  @IsEnum(MediaPurpose)
  purpose!: MediaPurpose;

  @IsUUID()
  ownerId!: string;

  @IsString()
  @MaxLength(255)
  originalName!: string;

  @IsMimeType()
  @MaxLength(120)
  declaredMimeType!: string;

  @IsInt()
  @Min(1)
  declaredSizeBytes!: number;
}
