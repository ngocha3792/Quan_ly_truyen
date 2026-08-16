import { IsBoolean } from 'class-validator';

export class SetNotificationFlagRequest {
  @IsBoolean()
  readonly value!: boolean;
}
