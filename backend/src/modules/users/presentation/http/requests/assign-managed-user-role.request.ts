import { IsEnum } from 'class-validator';

import { RoleCode } from '@/common/enums';

export class AssignManagedUserRoleRequest {
  @IsEnum(RoleCode)
  roleCode!: RoleCode;
}
