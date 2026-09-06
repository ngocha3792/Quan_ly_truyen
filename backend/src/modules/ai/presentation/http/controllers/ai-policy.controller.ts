import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UnauthorizedException,
} from '@nestjs/common';

import { CurrentUserId, RequirePermissions } from '@/common/decorators';
import { PermissionCode } from '@/common/enums';

import { AiPolicyManager } from '../../../application';
import {
  UpdateManagedAiPolicyRequest,
  UpdateOwnAiPolicyRequest,
} from '../requests';
import {
  AiPolicyResponse,
  toAiPolicyResponse,
} from '../responses/ai-policy.response';

@Controller('ai/policy')
@RequirePermissions(PermissionCode.AI_CHAT_USE)
export class AiPolicyController {
  constructor(private readonly policies: AiPolicyManager) {}

  @Get()
  async get(
    @CurrentUserId() userId: string | undefined,
  ): Promise<AiPolicyResponse> {
    return toAiPolicyResponse(
      await this.policies.get(this.requireUserId(userId)),
    );
  }

  @Patch()
  async update(
    @CurrentUserId() userId: string | undefined,
    @Body() request: UpdateOwnAiPolicyRequest,
  ): Promise<AiPolicyResponse> {
    return toAiPolicyResponse(
      await this.policies.update(this.requireUserId(userId), {
        fallbackPolicy: request.fallbackPolicy,
      }),
    );
  }

  private requireUserId(userId: string | undefined): string {
    if (!userId) throw new UnauthorizedException('Authentication required');
    return userId;
  }
}

@Controller('admin/ai/users')
@RequirePermissions(PermissionCode.AI_SETTINGS_MANAGE)
export class AdminAiPolicyController {
  constructor(private readonly policies: AiPolicyManager) {}

  @Get(':userId/policy')
  async get(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
  ): Promise<AiPolicyResponse> {
    return toAiPolicyResponse(await this.policies.get(userId));
  }

  @Patch(':userId/policy')
  async update(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Body() request: UpdateManagedAiPolicyRequest,
  ): Promise<AiPolicyResponse> {
    return toAiPolicyResponse(await this.policies.update(userId, request));
  }
}
