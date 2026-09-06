import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { RequirePermissions } from '@/common/decorators';
import { PermissionCode } from '@/common/enums';

import {
  CreateAiConnectionCommand,
  CreateAiConnectionCommandHandler,
  DeleteAiConnectionCommand,
  DeleteAiConnectionCommandHandler,
  ListAiConnectionModelsQuery,
  ListAiConnectionModelsQueryHandler,
  ListAiConnectionsQuery,
  ListAiConnectionsQueryHandler,
  TestAiConnectionCommand,
  TestAiConnectionCommandHandler,
  UpdateAiConnectionCommand,
  UpdateAiConnectionCommandHandler,
} from '../../../application';
import {
  AiConnectionTestResult,
  AiModelInfo,
} from '../../../application/ports/ai-protocol-adapter.port';
import {
  CreateAiConnectionRequest,
  UpdateAiConnectionRequest,
} from '../requests';
import {
  AiConnectionResponse,
  toAiConnectionResponse,
  toAiConnectionResponseList,
} from '../responses';
import { resolveAiConnectionPreset } from '../ai-connection-presets';

@Controller('admin/ai/connections')
@RequirePermissions(PermissionCode.AI_SETTINGS_MANAGE)
export class AdminAiConnectionsController {
  constructor(
    private readonly listConnections: ListAiConnectionsQueryHandler,
    private readonly listModels: ListAiConnectionModelsQueryHandler,
    private readonly createConnection: CreateAiConnectionCommandHandler,
    private readonly updateConnection: UpdateAiConnectionCommandHandler,
    private readonly deleteConnection: DeleteAiConnectionCommandHandler,
    private readonly testConnection: TestAiConnectionCommandHandler,
  ) {}

  @Get()
  async list(): Promise<readonly AiConnectionResponse[]> {
    const result = await this.listConnections.execute(
      new ListAiConnectionsQuery(null),
    );
    return toAiConnectionResponseList(result);
  }

  @Post()
  async create(
    @Body() request: CreateAiConnectionRequest,
  ): Promise<AiConnectionResponse> {
    const defaultModel = request.defaultModel ?? null;
    const preset = resolveAiConnectionPreset(
      request.provider,
      request.baseUrl ?? null,
      defaultModel,
      request.authType,
      request.authHeaderName,
    );
    const result = await this.createConnection.execute(
      new CreateAiConnectionCommand(
        null,
        request.name,
        preset.vendorHint,
        preset.protocol,
        preset.authType,
        preset.authHeaderName,
        request.apiKey,
        preset.baseUrl,
        defaultModel,
      ),
    );
    return toAiConnectionResponse(result);
  }

  @Patch(':connectionId')
  async update(
    @Param('connectionId', new ParseUUIDPipe({ version: '4' }))
    connectionId: string,
    @Body() request: UpdateAiConnectionRequest,
  ): Promise<AiConnectionResponse> {
    const result = await this.updateConnection.execute(
      new UpdateAiConnectionCommand(null, connectionId, request),
    );
    return toAiConnectionResponse(result);
  }

  @Delete(':connectionId')
  async remove(
    @Param('connectionId', new ParseUUIDPipe({ version: '4' }))
    connectionId: string,
  ): Promise<void> {
    await this.deleteConnection.execute(
      new DeleteAiConnectionCommand(null, connectionId),
    );
  }

  @Post(':connectionId/test')
  async test(
    @Param('connectionId', new ParseUUIDPipe({ version: '4' }))
    connectionId: string,
  ): Promise<AiConnectionTestResult> {
    return this.testConnection.execute(
      new TestAiConnectionCommand(null, connectionId),
    );
  }

  @Get(':connectionId/models')
  async models(
    @Param('connectionId', new ParseUUIDPipe({ version: '4' }))
    connectionId: string,
    @Query('refresh') refresh?: string,
  ): Promise<readonly AiModelInfo[]> {
    return this.listModels.execute(
      new ListAiConnectionModelsQuery(
        null,
        connectionId,
        refresh === 'true' || refresh === '1',
      ),
    );
  }
}
