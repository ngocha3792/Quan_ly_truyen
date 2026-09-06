import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UnauthorizedException,
} from '@nestjs/common';

import { CurrentUserId, RequirePermissions } from '@/common/decorators';
import { PermissionCode } from '@/common/enums';

import {
  CreateAiConversationCommand,
  CreateAiConversationCommandHandler,
  DeleteAiConversationCommand,
  DeleteAiConversationCommandHandler,
  GetAiConversationQuery,
  GetAiConversationQueryHandler,
  ListAiConversationsQuery,
  ListAiConversationsQueryHandler,
  SendAiMessageCommand,
  SendAiMessageCommandHandler,
} from '../../../application';
import { CreateAiConversationRequest, SendAiMessageRequest } from '../requests';
import {
  AiConversationDetailResponse,
  AiConversationSummaryResponse,
  SendAiMessageResponse,
  toAiConversationDetailResponse,
  toAiConversationSummaryListResponse,
  toSendAiMessageResponse,
} from '../responses';

const DEFAULT_TITLE = 'Cuộc trò chuyện mới';

@Controller('ai/conversations')
@RequirePermissions(PermissionCode.AI_CHAT_USE)
export class AiChatController {
  constructor(
    private readonly listConversations: ListAiConversationsQueryHandler,
    private readonly getConversation: GetAiConversationQueryHandler,
    private readonly createConversation: CreateAiConversationCommandHandler,
    private readonly deleteConversation: DeleteAiConversationCommandHandler,
    private readonly sendMessage: SendAiMessageCommandHandler,
  ) {}

  @Get()
  async list(
    @CurrentUserId() userId: string | undefined,
  ): Promise<readonly AiConversationSummaryResponse[]> {
    const result = await this.listConversations.execute(
      new ListAiConversationsQuery(this.requireUserId(userId)),
    );
    return toAiConversationSummaryListResponse(result);
  }

  @Post()
  async create(
    @CurrentUserId() userId: string | undefined,
    @Body() request: CreateAiConversationRequest,
  ): Promise<AiConversationSummaryResponse> {
    const result = await this.createConversation.execute(
      new CreateAiConversationCommand(
        this.requireUserId(userId),
        request.connectionId,
        request.title?.trim() || DEFAULT_TITLE,
      ),
    );
    return toAiConversationSummaryListResponse([result])[0];
  }

  @Get(':conversationId')
  async findOne(
    @CurrentUserId() userId: string | undefined,
    @Param('conversationId', new ParseUUIDPipe({ version: '4' }))
    conversationId: string,
  ): Promise<AiConversationDetailResponse> {
    const result = await this.getConversation.execute(
      new GetAiConversationQuery(this.requireUserId(userId), conversationId),
    );
    return toAiConversationDetailResponse(result);
  }

  @Delete(':conversationId')
  async remove(
    @CurrentUserId() userId: string | undefined,
    @Param('conversationId', new ParseUUIDPipe({ version: '4' }))
    conversationId: string,
  ): Promise<void> {
    await this.deleteConversation.execute(
      new DeleteAiConversationCommand(
        this.requireUserId(userId),
        conversationId,
      ),
    );
  }

  @Post(':conversationId/messages')
  async postMessage(
    @CurrentUserId() userId: string | undefined,
    @Param('conversationId', new ParseUUIDPipe({ version: '4' }))
    conversationId: string,
    @Body() request: SendAiMessageRequest,
  ): Promise<SendAiMessageResponse> {
    const result = await this.sendMessage.execute(
      new SendAiMessageCommand(
        this.requireUserId(userId),
        conversationId,
        request.content,
      ),
    );
    return toSendAiMessageResponse(result);
  }

  private requireUserId(userId: string | undefined): string {
    if (!userId) throw new UnauthorizedException('Authentication required');
    return userId;
  }
}
