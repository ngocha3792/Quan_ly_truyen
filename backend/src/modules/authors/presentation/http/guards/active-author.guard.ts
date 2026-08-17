import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthenticationRequiredException } from '@/common/exceptions';
import { AssertActiveAuthorQuery, AssertActiveAuthorQueryHandler } from '../../../application';

interface RequestWithUser {
  method?: string;
  user?: { userId?: string };
}
@Injectable()
export class ActiveAuthorGuard implements CanActivate {
  constructor(private readonly assertActiveAuthor: AssertActiveAuthorQueryHandler) {}
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
    await this.assertActiveAuthor.execute(new AssertActiveAuthorQuery(userId));
    return true;
  }
}
