import {
  IsIn,
  IsInt,
  IsMimeType,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import {
  MEDIA_PURPOSE_VALUES,
  type MediaPurposeName,
} from '../../../application/dto';

export class CreateMediaUploadIntentDto {
  @IsIn(MEDIA_PURPOSE_VALUES)
  purpose!: MediaPurposeName;

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
