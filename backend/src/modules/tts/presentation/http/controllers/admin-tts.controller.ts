import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CurrentUserId, RequirePermissions } from '@/common/decorators';
import { PermissionCode } from '@/common/enums';
import {
  CreateTtsConnectionCommandHandler,
  DeleteTtsConnectionCommandHandler,
  type TtsConnectionDto,
} from '../../../application';
import { TtsFeatureGuard } from '../guards';
import { CreateTtsConnectionRequest } from '../requests';

@Controller('admin/tts/connections')
@UseGuards(TtsFeatureGuard)
@RequirePermissions(PermissionCode.TTS_SETTINGS_MANAGE)
export class AdminTtsController {
  constructor(
    private readonly createConnection: CreateTtsConnectionCommandHandler,
    private readonly deleteConnection: DeleteTtsConnectionCommandHandler,
  ) {}

  @Post()
  create(
    @CurrentUserId() actorUserId: string | undefined,
    @Body() request: CreateTtsConnectionRequest,
  ): Promise<TtsConnectionDto> {
    return this.createConnection.execute({
      actorUserId: actorUserId ?? '',
      system: true,
      ...request,
    });
  }

  @Delete(':connectionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUserId() actorUserId: string | undefined,
    @Param('connectionId', new ParseUUIDPipe({ version: '4' }))
    connectionId: string,
  ): Promise<void> {
    return this.deleteConnection.execute(actorUserId, connectionId, true);
  }
}
