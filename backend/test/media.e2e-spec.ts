/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { MediaStatus } from '../src/generated/prisma/client';
import { MediaCleanupService } from '../src/infrastructure/media/application/media-cleanup.service';
import { MediaQueryService } from '../src/infrastructure/media/application/media-query.service';
import { MediaService } from '../src/infrastructure/media/application/media.service';
import { MediaController } from '../src/infrastructure/media/media.controller';

describe('Media API lifecycle (e2e)', () => {
  let app: INestApplication;
  const mediaId = '00000000-0000-4000-8000-000000000010';
  const ownerId = '00000000-0000-4000-8000-000000000020';
  const asset = {
    id: mediaId,
    purpose: 'STORY_COVER',
    status: MediaStatus.READY,
    resourceType: 'IMAGE',
    format: 'webp',
    secureUrl: 'https://example.test/original',
    width: 100,
    height: 200,
    sizeBytes: BigInt(100),
    readyAt: new Date('2026-01-01T00:00:00Z'),
    publicId: mediaId,
  };
  const mediaService = {
    createUploadIntent: jest.fn().mockResolvedValue({
      mediaAssetId: mediaId,
      uploadUrl: 'https://api.cloudinary.com/upload',
      apiKey: 'public-key',
      signature: 'signed',
      timestamp: 1,
      resourceType: 'image',
      confirmExpiresAt: '2026-01-01T00:05:00Z',
      parameters: { public_id: mediaId },
    }),
    confirmUpload: jest.fn().mockResolvedValue(asset),
  };
  const queryService = {
    getAccessibleById: jest.fn().mockResolvedValue(asset),
    getDeliveryUrl: jest
      .fn()
      .mockReturnValue('https://example.test/transformed'),
  };
  const cleanupService = { deleteById: jest.fn().mockResolvedValue(undefined) };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [MediaController],
      providers: [
        { provide: MediaService, useValue: mediaService },
        { provide: MediaQueryService, useValue: queryService },
        { provide: MediaCleanupService, useValue: cleanupService },
      ],
    }).compile();
    app = module.createNestApplication();
    app.use(
      (
        req: Request & { user?: unknown },
        _res: Response,
        next: NextFunction,
      ) => {
        req.user = { userId: '00000000-0000-4000-8000-000000000001' };
        next();
      },
    );
    await app.init();
  });

  afterAll(async () => app.close());

  it('creates, confirms, reads and deletes an asset without exposing a secret', async () => {
    const intent = await request(app.getHttpServer())
      .post('/media/upload-intents')
      .send({
        purpose: 'STORY_COVER',
        ownerId,
        originalName: 'cover.webp',
        declaredMimeType: 'image/webp',
        declaredSizeBytes: 100,
      })
      .expect(201);
    expect(intent.body).not.toHaveProperty('apiSecret');
    await request(app.getHttpServer())
      .post(`/media/upload-intents/${mediaId}/confirm`)
      .send({
        publicId: mediaId,
        version: 1,
        signature: 'signed-response',
        resourceType: 'image',
      })
      .expect(201);
    const get = await request(app.getHttpServer())
      .get(`/media/${mediaId}`)
      .expect(200);
    expect(get.body).toMatchObject({
      id: mediaId,
      deliveryUrl: 'https://example.test/transformed',
    });
    await request(app.getHttpServer()).delete(`/media/${mediaId}`).expect(204);
    expect(cleanupService.deleteById).toHaveBeenCalledWith(
      mediaId,
      expect.any(String),
    );
  });
});
