import type {
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ROLES_KEY } from '../constants';
import type { RoleCode } from '../enums';
import { AccessDeniedException } from '../exceptions';
import { requireGuardPrincipal } from './guard-request.util';

/**
 * Checks role metadata using OR semantics: one matching role is enough.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles =
      this.reflector.getAllAndOverride<
        readonly RoleCode[]
      >(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);

    if (!requiredRoles?.length) {
      return true;
    }

    const principal = requireGuardPrincipal(context);
    const actualRoles = new Set(
      principal.roles ?? [],
    );

    const allowed = requiredRoles.some((role) =>
      actualRoles.has(role),
    );

    if (!allowed) {
      throw new AccessDeniedException({
        code: 'ROLE_REQUIRED',
        message:
          'Tài khoản không có vai trò cần thiết',
        details: {
          requiredRoles,
        },
      });
    }

    return true;
  }
}
