import { IsISO8601 } from 'class-validator';

export class ScheduleAuthorChapterRequest {
  @IsISO8601({ strict: true, strictSeparator: true })
  scheduledAt!: string;
}
