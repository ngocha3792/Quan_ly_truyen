import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { AuthorLifecycleStatus } from '../../../domain';

export class UpdateAuthorStatusRequest {
  @IsEnum(AuthorLifecycleStatus)
  status!: AuthorLifecycleStatus;
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
