import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';

import {
  CurrentUserId,
  RequirePermissions,
  RequestTimeout,
  SkipResponseEnvelope,
} from '@/common/decorators';
import { PermissionCode } from '@/common/enums';
import { AppException } from '@/common/exceptions';

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
  SendAiMessageStreamCommand,
  SendAiMessageStreamCommandHandler,
} from '../../../application';
import {
  AI_STREAM_HEARTBEAT_MS,
  AI_STREAM_TIMEOUT_MS,
} from '../../../application/constants/ai-generation.constants';
import { CreateAiConversationRequest, SendAiMessageRequest } from '../requests';
import {
  AiConversationDetailResponse,
  AiConversationSummaryResponse,
  SendAiMessageResponse,
  toAiConversationDetailResponse,
  toAiConversationSummaryListResponse,
  toSendAiMessageResponse,
} from '../responses';

function writeSseEvent(response: Response, payload: unknown): void {
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
}

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
    private readonly sendMessageStream: SendAiMessageStreamCommandHandler,
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
        request.modelId?.trim() || null,
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

  @Post(':conversationId/messages/stream')
  @SkipResponseEnvelope()
  @RequestTimeout(AI_STREAM_TIMEOUT_MS)
  async streamMessage(
    @CurrentUserId() userId: string | undefined,
    @Param('conversationId', new ParseUUIDPipe({ version: '4' }))
    conversationId: string,
    @Body() request: SendAiMessageRequest,
    @Res() response: Response,
  ): Promise<void> {
    const resolvedUserId = this.requireUserId(userId);

    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');
    response.flushHeaders();
    const heartbeat = setInterval(() => {
      if (!response.destroyed && !response.writableEnded) {
        response.write(': keep-alive\n\n');
      }
    }, AI_STREAM_HEARTBEAT_MS);

    try {
      const stream = this.sendMessageStream.execute(
        new SendAiMessageStreamCommand(
          resolvedUserId,
          conversationId,
          request.content,
        ),
      );

      for await (const event of stream) {
        if (event.type === 'TEXT_DELTA') {
          writeSseEvent(response, {
            type: 'delta',
            event: event.type,
            text: event.text,
          });
          continue;
        }

        if (event.type === 'USAGE') {
          writeSseEvent(response, {
            type: 'delta',
            event: event.type,
            text: '',
            usage: event.usage,
          });
          continue;
        }

        writeSseEvent(response, {
          type: 'done',
          event: event.type,
          ...toSendAiMessageResponse({
            userMessage: event.userMessage,
            assistantMessage: event.assistantMessage,
          }),
        });
      }
    } catch (error) {
      const message =
        error instanceof AppException && error.expose
          ? error.message
          : 'Đã xảy ra lỗi khi kết nối tới AI. Vui lòng thử lại.';

      writeSseEvent(response, { type: 'error', event: 'ERROR', message });
    } finally {
      clearInterval(heartbeat);
      response.end();
    }
  }

  private requireUserId(userId: string | undefined): string {
    if (!userId) throw new UnauthorizedException('Authentication required');
    return userId;
  }
}
