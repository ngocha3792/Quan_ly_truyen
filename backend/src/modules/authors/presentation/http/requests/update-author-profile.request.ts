import { Type } from 'class-transformer';
import { IsObject, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';

export class AuthorSocialLinksRequest {
  @IsOptional() @IsString() @MaxLength(500) website?: string | null;
  @IsOptional() @IsString() @MaxLength(500) facebook?: string | null;
  @IsOptional() @IsString() @MaxLength(500) instagram?: string | null;
  @IsOptional() @IsString() @MaxLength(500) x?: string | null;
  @IsOptional() @IsString() @MaxLength(500) youtube?: string | null;
  @IsOptional() @IsString() @MaxLength(500) tiktok?: string | null;
}

export class UpdateAuthorProfileRequest {
  @IsOptional() @IsString() @MaxLength(120) displayName?: string;
  @IsOptional() @IsString() @MaxLength(5000) bio?: string | null;
  @IsOptional() @IsUUID('4') avatarMediaId?: string | null;
  @IsOptional() @IsUUID('4') bannerMediaId?: string | null;
  @IsOptional() @IsObject() @ValidateNested() @Type(() => AuthorSocialLinksRequest)
  socialLinks?: AuthorSocialLinksRequest;
}
