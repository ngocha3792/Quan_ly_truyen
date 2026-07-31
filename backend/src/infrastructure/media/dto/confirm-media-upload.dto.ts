import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export enum ConfirmResourceType {
  IMAGE = 'image',
  VIDEO = 'video',
  RAW = 'raw',
}

export class ConfirmMediaUploadDto {
  @IsUUID()
  mediaAssetId!: string;

  @IsString()
  @IsNotEmpty()
  publicId!: string;

  @IsInt()
  @Min(1)
  version!: number;

  @IsString()
  @IsNotEmpty()
  signature!: string;

  @IsEnum(ConfirmResourceType)
  resourceType!: ConfirmResourceType;
}
