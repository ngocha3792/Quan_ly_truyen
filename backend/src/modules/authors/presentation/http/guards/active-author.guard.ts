import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthenticationRequiredException } from '@/common/exceptions';
import { AuthorLifecycleService } from '../../../application/services';

interface RequestWithUser {
  method?: string;
  user?: { userId?: string };
}
@Injectable()
export class ActiveAuthorGuard implements CanActivate {
  constructor(private readonly lifecycle: AuthorLifecycleService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    if (
      ['GET', 'HEAD', 'OPTIONS'].includes((request.method ?? '').toUpperCase())
    )
      return true;
    const userId = request.user?.userId;
    if (!userId)
      throw new AuthenticationRequiredException({
        code: 'AUTHOR_LIFECYCLE_AUTH_REQUIRED',
        message: 'Bạn cần đăng nhập bằng tài khoản tác giả',
      });
    await this.lifecycle.assertActiveAuthor(userId);
    return true;
  }
}
