import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UnauthorizedException,
} from '@nestjs/common';

import { CurrentUserId, RequirePermissions } from '@/common/decorators';
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
import { AiConnectionTestResult } from '../../../application/ports/ai-provider-client.port';
import {
  CreateAiConnectionRequest,
  UpdateAiConnectionRequest,
} from '../requests';
import {
  AiConnectionResponse,
  toAiConnectionResponse,
  toAiConnectionResponseList,
} from '../responses';

@Controller('ai/connections')
@RequirePermissions(PermissionCode.AI_CHAT_USE)
export class AiConnectionsController {
  constructor(
    private readonly listConnections: ListAiConnectionsQueryHandler,
    private readonly listModels: ListAiConnectionModelsQueryHandler,
    private readonly createConnection: CreateAiConnectionCommandHandler,
    private readonly updateConnection: UpdateAiConnectionCommandHandler,
    private readonly deleteConnection: DeleteAiConnectionCommandHandler,
    private readonly testConnection: TestAiConnectionCommandHandler,
  ) {}

  @Get()
  async list(
    @CurrentUserId() userId: string | undefined,
  ): Promise<readonly AiConnectionResponse[]> {
    const result = await this.listConnections.execute(
      new ListAiConnectionsQuery(this.requireUserId(userId)),
    );
    return toAiConnectionResponseList(result);
  }

  @Post()
  async create(
    @CurrentUserId() userId: string | undefined,
    @Body() request: CreateAiConnectionRequest,
  ): Promise<AiConnectionResponse> {
    const result = await this.createConnection.execute(
      new CreateAiConnectionCommand(
        this.requireUserId(userId),
        request.name,
        request.provider,
        request.apiKey,
        request.baseUrl ?? null,
        request.defaultModel ?? null,
      ),
    );
    return toAiConnectionResponse(result);
  }

  @Patch(':connectionId')
  async update(
    @CurrentUserId() userId: string | undefined,
    @Param('connectionId', new ParseUUIDPipe({ version: '4' }))
    connectionId: string,
    @Body() request: UpdateAiConnectionRequest,
  ): Promise<AiConnectionResponse> {
    const result = await this.updateConnection.execute(
      new UpdateAiConnectionCommand(
        this.requireUserId(userId),
        connectionId,
        request,
      ),
    );
    return toAiConnectionResponse(result);
  }

  @Delete(':connectionId')
  async remove(
    @CurrentUserId() userId: string | undefined,
    @Param('connectionId', new ParseUUIDPipe({ version: '4' }))
    connectionId: string,
  ): Promise<void> {
    await this.deleteConnection.execute(
      new DeleteAiConnectionCommand(this.requireUserId(userId), connectionId),
    );
  }

  @Post(':connectionId/test')
  async test(
    @CurrentUserId() userId: string | undefined,
    @Param('connectionId', new ParseUUIDPipe({ version: '4' }))
    connectionId: string,
  ): Promise<AiConnectionTestResult> {
    return this.testConnection.execute(
      new TestAiConnectionCommand(this.requireUserId(userId), connectionId),
    );
  }

  @Get(':connectionId/models')
  async models(
    @CurrentUserId() userId: string | undefined,
    @Param('connectionId', new ParseUUIDPipe({ version: '4' }))
    connectionId: string,
  ): Promise<readonly string[]> {
    return this.listModels.execute(
      new ListAiConnectionModelsQuery(this.requireUserId(userId), connectionId),
    );
  }

  private requireUserId(userId: string | undefined): string {
    if (!userId) throw new UnauthorizedException('Authentication required');
    return userId;
  }
}
