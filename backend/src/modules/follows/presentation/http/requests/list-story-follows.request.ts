import { Transform } from 'class-transformer';
import { IsArray, IsOptional, IsUUID } from 'class-validator';

export class ListStoryFollowsRequest {
  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value))
      return value
        .flatMap((item) => String(item).split(','))
        .map((item) => item.trim())
        .filter(Boolean);
    return String(value ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  })
  @IsArray()
  @IsUUID('4', { each: true })
  storyIds: string[] = [];
}
