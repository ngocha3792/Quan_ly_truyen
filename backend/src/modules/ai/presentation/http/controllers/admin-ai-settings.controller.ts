import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  Put,
} from '@nestjs/common';

import { RequirePermissions } from '@/common/decorators';
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

@Controller('admin/ai/keys')
@RequirePermissions(PermissionCode.AI_SETTINGS_MANAGE)
export class AdminAiSettingsController {
  constructor(
    private readonly listKeys: ListAiKeysQueryHandler,
    private readonly saveKey: SaveAiKeyCommandHandler,
    private readonly removeKey: RemoveAiKeyCommandHandler,
  ) {}

  @Get()
  async list(): Promise<readonly AiKeyStatusResponse[]> {
    const result = await this.listKeys.execute(new ListAiKeysQuery(null));
    return result.map(toAiKeyStatusResponse);
  }

  @Put(':provider')
  async save(
    @Param('provider', new ParseEnumPipe(AiProvider)) provider: AiProvider,
    @Body() request: SaveAiKeyRequest,
  ): Promise<void> {
    await this.saveKey.execute(
      new SaveAiKeyCommand(null, provider, request.apiKey),
    );
  }

  @Delete(':provider')
  async remove(
    @Param('provider', new ParseEnumPipe(AiProvider)) provider: AiProvider,
  ): Promise<void> {
    await this.removeKey.execute(new RemoveAiKeyCommand(null, provider));
  }
}
