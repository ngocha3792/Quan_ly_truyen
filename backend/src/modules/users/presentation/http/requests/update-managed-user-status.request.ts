import { IsEnum } from 'class-validator';

import { ManagedUserStatus } from '../../../domain';

export class UpdateManagedUserStatusRequest {
  @IsEnum(ManagedUserStatus)
  status!: ManagedUserStatus;
}
