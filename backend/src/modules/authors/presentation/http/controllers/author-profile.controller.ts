import {
  Body,
  Controller,
  Get,
  Header,
  Patch,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ClientIp,
  CurrentUserId,
  RequestId,
  RequirePermissions,
  UserAgent,
} from '@/common/decorators';
import { PermissionCode } from '@/common/enums';
import {
  GetAuthorProfileQuery,
  GetAuthorProfileQueryHandler,
  UpdateAuthorProfileCommand,
  UpdateAuthorProfileCommandHandler,
  type AuthorProfileView,
} from '../../../application';
import { UpdateAuthorProfileRequest } from '../requests/update-author-profile.request';

@Controller('author/profile')
@RequirePermissions(PermissionCode.STORY_CREATE)
export class AuthorProfileController {
  constructor(
    private readonly getProfile: GetAuthorProfileQueryHandler,
    private readonly updateProfile: UpdateAuthorProfileCommandHandler,
  ) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  get(@CurrentUserId() userId: string | undefined): Promise<AuthorProfileView> {
    return this.getProfile.execute(
      new GetAuthorProfileQuery(this.requireUserId(userId)),
    );
  }

  @Patch()
  @Header('Cache-Control', 'private, no-store')
  update(
    @CurrentUserId() userId: string | undefined,
    @Body() request: UpdateAuthorProfileRequest,
    @ClientIp() ipAddress: string | undefined,
    @UserAgent() userAgent: string | undefined,
    @RequestId() requestId: string | undefined,
  ): Promise<AuthorProfileView> {
    return this.updateProfile.execute(
      new UpdateAuthorProfileCommand({
        userId: this.requireUserId(userId),
        displayName: request.displayName,
        bio: request.bio,
        avatarMediaId: request.avatarMediaId,
        bannerMediaId: request.bannerMediaId,
        socialLinks: request.socialLinks,
        audit: { ipAddress, userAgent, requestId },
      }),
    );
  }

  private requireUserId(userId: string | undefined): string {
    if (!userId) throw new UnauthorizedException('Authentication required');
    return userId;
  }
}
