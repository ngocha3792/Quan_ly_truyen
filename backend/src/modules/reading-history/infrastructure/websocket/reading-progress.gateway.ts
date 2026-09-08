import { Inject, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Socket } from 'socket.io';

import { readerFeaturesConfig } from '@/config';
import {
  SaveReadingProgressCommand,
  SaveReadingProgressCommandHandler,
} from '../../application';
import { ReadingProgressSocketAuthenticator } from './reading-progress-socket-authenticator';
import { ReadingProgressRateLimiter } from './reading-progress-rate-limiter';
import {
  READING_PROGRESS_ACK_EVENT,
  READING_PROGRESS_CHANGED_EVENT,
  READING_PROGRESS_CONFLICT_EVENT,
  READING_PROGRESS_ERROR_EVENT,
  READING_PROGRESS_MAX_MESSAGE_BYTES,
  READING_PROGRESS_NAMESPACE,
  READING_PROGRESS_ROOM_PREFIX,
  READING_PROGRESS_UPDATE_EVENT,
  type ReadingProgressAckEvent,
  type ReadingProgressChangedEvent,
  type ReadingProgressConflictEvent,
  parseReadingProgressUpdateEvent,
} from './reading-progress.events';

@WebSocketGateway({
  namespace: READING_PROGRESS_NAMESPACE,
  transports: ['websocket'],
  maxHttpBufferSize: READING_PROGRESS_MAX_MESSAGE_BYTES,
})
export class ReadingProgressGateway implements OnGatewayConnection {
  private readonly logger = new Logger(ReadingProgressGateway.name);

  constructor(
    private readonly authenticator: ReadingProgressSocketAuthenticator,
    private readonly rateLimiter: ReadingProgressRateLimiter,
    private readonly saveProgress: SaveReadingProgressCommandHandler,
    @Inject(readerFeaturesConfig.KEY)
    private readonly features: ConfigType<typeof readerFeaturesConfig>,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    if (!this.features.realtimeProgressSyncEnabled) {
      client.emit(READING_PROGRESS_ERROR_EVENT, {
        code: 'READER_REALTIME_PROGRESS_SYNC_DISABLED',
      });
      client.disconnect(true);
      return;
    }

    try {
      const userId = await this.authenticator.authenticate(client);
      socketData(client)['userId'] = userId;
      await client.join(`${READING_PROGRESS_ROOM_PREFIX}${userId}`);
    } catch (error: unknown) {
      this.logger.warn({
        event: 'reading-progress.socket.authentication-rejected',
        socketId: client.id,
        errorType: error instanceof Error ? error.name : 'UnknownError',
      });
      client.emit(READING_PROGRESS_ERROR_EVENT, {
        code: 'READING_PROGRESS_SOCKET_AUTH_REJECTED',
      });
      client.disconnect(true);
    }
  }

  @SubscribeMessage(READING_PROGRESS_UPDATE_EVENT)
  async update(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawPayload: unknown,
  ): Promise<void> {
    const userId = socketData(client)['userId'];
    if (typeof userId !== 'string') {
      client.disconnect(true);
      return;
    }
    if (!(await this.rateLimiter.accept(userId))) {
      client.emit(READING_PROGRESS_ERROR_EVENT, {
        code: 'READING_PROGRESS_RATE_LIMITED',
      });
      return;
    }
    const payload = parseReadingProgressUpdateEvent(rawPayload);
    if (!payload) {
      client.emit(READING_PROGRESS_ERROR_EVENT, {
        code: 'READING_PROGRESS_PAYLOAD_INVALID',
      });
      return;
    }

    try {
      const result = await this.saveProgress.executeForSync(
        new SaveReadingProgressCommand(
          userId,
          payload.storyId,
          payload.chapterId,
          payload.position,
          payload.cursor,
          {
            baseRevision: payload.baseRevision,
            deviceId: payload.deviceId,
            clientEventId: payload.clientEventId,
          },
        ),
      );

      if (result.status === 'revision_conflict') {
        const conflict: ReadingProgressConflictEvent = {
          storyId: payload.storyId,
          clientEventId: payload.clientEventId,
          expectedRevision: result.expectedRevision,
          actualRevision: result.actualRevision,
          progress: result.entry,
        };
        client.emit(READING_PROGRESS_CONFLICT_EVENT, conflict);
        return;
      }

      const ack: ReadingProgressAckEvent = {
        storyId: payload.storyId,
        clientEventId: payload.clientEventId,
        duplicate: result.status === 'duplicate',
        progress: result.entry,
      };
      client.emit(READING_PROGRESS_ACK_EVENT, ack);
      if (result.status === 'duplicate') return;

      const changed: ReadingProgressChangedEvent = {
        storyId: payload.storyId,
        sourceDeviceId: payload.deviceId,
        progress: result.entry,
      };
      client
        .to(`${READING_PROGRESS_ROOM_PREFIX}${userId}`)
        .emit(READING_PROGRESS_CHANGED_EVENT, changed);
    } catch (error: unknown) {
      this.logger.warn({
        event: 'reading-progress.socket.update-rejected',
        socketId: client.id,
        errorType: error instanceof Error ? error.name : 'UnknownError',
      });
      client.emit(READING_PROGRESS_ERROR_EVENT, {
        code: 'READING_PROGRESS_UPDATE_REJECTED',
      });
    }
  }
}

function socketData(client: Socket): Record<string, unknown> {
  const data: unknown = client.data;
  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  throw new TypeError('Socket data must be an object');
}
