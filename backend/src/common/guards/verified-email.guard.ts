import type {
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import { Injectable } from '@nestjs/common';

import { AccessDeniedException } from '../exceptions';
import { requireGuardPrincipal } from './guard-request.util';

/**
 * Route-level guard for operations requiring a verified email address.
 * The JWT strategy must populate emailVerified or emailVerifiedAt.
 */
@Injectable()
export class VerifiedEmailGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const principal = requireGuardPrincipal(context);

    const isVerified =
      principal.emailVerified === true ||
      principal.emailVerifiedAt !== undefined &&
        principal.emailVerifiedAt !== null;

    if (!isVerified) {
      throw new AccessDeniedException({
        code: 'EMAIL_VERIFICATION_REQUIRED',
        message:
          'Bạn cần xác minh email để thực hiện thao tác này',
      });
    }

    return true;
  }
}
