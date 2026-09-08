import type { ConfigType } from '@nestjs/config';
import type { Socket } from 'socket.io';

import { readerFeaturesConfig } from '@/config';
import type { SaveReadingProgressCommandHandler } from '../../application';
import type { ReadingProgressRateLimiter } from './reading-progress-rate-limiter';
import type { ReadingProgressSocketAuthenticator } from './reading-progress-socket-authenticator';
import { ReadingProgressGateway } from './reading-progress.gateway';

const userId = '11111111-1111-4111-8111-111111111111';
const storyId = '22222222-2222-4222-8222-222222222222';
const chapterId = '33333333-3333-4333-8333-333333333333';
const deviceId = '44444444-4444-4444-8444-444444444444';
const clientEventId = '55555555-5555-4555-8555-555555555555';

describe('ReadingProgressGateway', () => {
  it('authenticates the handshake and joins the canonical user room', async () => {
    const authenticator = { authenticate: jest.fn().mockResolvedValue(userId) };
    const socket = createSocket();
    const gateway = createGateway(authenticator);

    await gateway.handleConnection(socket.value);

    expect(socket.data['userId']).toBe(userId);
    expect(socket.join).toHaveBeenCalledWith(`user:${userId}`);
  });

  it('acks the sender and broadcasts changed state to the second device', async () => {
    const socket = createSocket({ userId });
    const entry = progressEntry();
    const handler = {
      executeForSync: jest.fn().mockResolvedValue({ status: 'saved', entry }),
    };
    const gateway = createGateway({ authenticate: jest.fn() }, handler, {
      accept: jest.fn().mockResolvedValue(true),
    });

    await gateway.update(socket.value, {
      storyId,
      chapterId,
      position: 8,
      cursor: {
        schemaVersion: 1,
        kind: 'text',
        blockId: '66666666-6666-4666-8666-666666666666',
        characterOffset: 8,
        viewportRatio: 0.4,
      },
      baseRevision: 0,
      deviceId,
      clientEventId,
    });

    expect(socket.emit).toHaveBeenCalledWith(
      'progress:ack',
      expect.objectContaining({ clientEventId, duplicate: false }),
    );
    expect(socket.to).toHaveBeenCalledWith(`user:${userId}`);
    expect(socket.roomEmit).toHaveBeenCalledWith(
      'progress:changed',
      expect.objectContaining({ storyId, sourceDeviceId: deviceId }),
    );
  });
});

function createGateway(
  authenticator: { authenticate: jest.Mock },
  handler: { executeForSync: jest.Mock } = {
    executeForSync: jest.fn(),
  },
  limiter: { accept: jest.Mock } = {
    accept: jest.fn().mockResolvedValue(true),
  },
): ReadingProgressGateway {
  return new ReadingProgressGateway(
    authenticator as unknown as ReadingProgressSocketAuthenticator,
    limiter as unknown as ReadingProgressRateLimiter,
    handler as unknown as SaveReadingProgressCommandHandler,
    {
      realtimeProgressSyncEnabled: true,
    } as ConfigType<typeof readerFeaturesConfig>,
  );
}

function createSocket(initialData: Record<string, unknown> = {}) {
  const roomEmit = jest.fn();
  const socket = {
    id: 'socket-1',
    data: initialData,
    emit: jest.fn(),
    join: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn(),
    to: jest.fn().mockReturnValue({ emit: roomEmit }),
  };
  return {
    value: socket as unknown as Socket,
    data: socket.data,
    emit: socket.emit,
    join: socket.join,
    to: socket.to,
    roomEmit,
  };
}

function progressEntry() {
  return {
    story: {
      id: storyId,
      slug: 'story',
      title: 'Story',
      author: 'Author',
      coverUrl: null,
      categories: [],
      latestChapterNumber: 1,
      chapterCount: 1,
    },
    currentChapter: { id: chapterId, number: 1, title: 'Chapter' },
    position: 8,
    revision: 1,
    deviceId,
    clientEventId,
    lastServerSequence: '1',
    progressPercent: 100,
    lastReadAt: '2026-09-08T00:00:00.000Z',
  };
}
