import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  Put,
  UnauthorizedException,
} from '@nestjs/common';

import { CurrentUserId, RequirePermissions } from '@/common/decorators';
import { PermissionCode } from '@/common/enums';
import { AiProvider } from '@/generated/prisma/client';

import {
  ListAiKeysQuery,
  ListAiKeysQueryHandler,
  RemoveAiKeyCommand,
  RemoveAiKeyCommandHandler,
  SaveAiKeyCommand,
  SaveAiKeyCommandHandler,
} from '../../../application';
import { SaveAiKeyRequest } from '../requests';
import { AiKeyStatusResponse, toAiKeyStatusResponse } from '../responses';

@Controller('ai/keys')
@RequirePermissions(PermissionCode.AI_CHAT_USE)
export class AiKeysController {
  constructor(
    private readonly listKeys: ListAiKeysQueryHandler,
    private readonly saveKey: SaveAiKeyCommandHandler,
    private readonly removeKey: RemoveAiKeyCommandHandler,
  ) {}

  @Get()
  async list(
    @CurrentUserId() userId: string | undefined,
  ): Promise<readonly AiKeyStatusResponse[]> {
    const result = await this.listKeys.execute(
      new ListAiKeysQuery(this.requireUserId(userId)),
    );
    return result.map(toAiKeyStatusResponse);
  }

  @Put(':provider')
  async save(
    @CurrentUserId() userId: string | undefined,
    @Param('provider', new ParseEnumPipe(AiProvider)) provider: AiProvider,
    @Body() request: SaveAiKeyRequest,
  ): Promise<void> {
    await this.saveKey.execute(
      new SaveAiKeyCommand(
        this.requireUserId(userId),
        provider,
        request.apiKey,
      ),
    );
  }

  @Delete(':provider')
  async remove(
    @CurrentUserId() userId: string | undefined,
    @Param('provider', new ParseEnumPipe(AiProvider)) provider: AiProvider,
  ): Promise<void> {
    await this.removeKey.execute(
      new RemoveAiKeyCommand(this.requireUserId(userId), provider),
    );
  }

  private requireUserId(userId: string | undefined): string {
    if (!userId) throw new UnauthorizedException('Authentication required');
    return userId;
  }
}
