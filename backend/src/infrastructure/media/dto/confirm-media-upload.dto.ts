import { IsEnum, IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export enum ConfirmResourceType {
  IMAGE = 'image',
  VIDEO = 'video',
  RAW = 'raw',
}

export class ConfirmMediaUploadDto {
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
