import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PERMISSIONS_KEY } from '../constants';
import type { PermissionCode } from '../enums';
import { MissingPermissionException } from '../exceptions';
import { requireGuardPrincipal } from './guard-request.util';

/**
 * Checks permission metadata using AND semantics: every declared permission is required.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<
      readonly PermissionCode[]
    >(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredPermissions?.length) {
      return true;
    }

    const principal = requireGuardPrincipal(context);
    const actualPermissions = new Set(principal.permissions ?? []);

    const missingPermissions = requiredPermissions.filter(
      (permission) => !actualPermissions.has(permission),
    );

    if (missingPermissions.length > 0) {
      throw new MissingPermissionException(missingPermissions);
    }

    return true;
  }
}
