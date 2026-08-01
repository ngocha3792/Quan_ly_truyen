import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { IDEMPOTENCY_STORE } from '../src/common/constants';
import { JwtTokenType, PermissionCode, RoleCode } from '../src/common/enums';
import { configureApplication } from '../src/bootstrap/application-configurator';
import type { AppConfig } from '../src/config';
import { PrismaService } from '../src/infrastructure/database/prisma';
import { InMemoryIdempotencyStore } from '../src/infrastructure/idempotency/in-memory-idempotency.store';
import { CloudinaryWebhookInboxProcessor } from '../src/infrastructure/media/cloudinary/cloudinary-webhook-inbox.processor';
import { CLOUDINARY_CLIENT } from '../src/infrastructure/media/cloudinary/cloudinary.constants';
import { CloudinaryUrlService } from '../src/infrastructure/media/cloudinary/cloudinary-url.service';
import {
  MEDIA_STORAGE,
  type ConfirmUploadInput,
  type CreateSignedUploadInput,
  type DeleteStoredMediaInput,
  type DeleteStoredMediaResult,
} from '../src/infrastructure/media/contracts/media-storage.port';

const accessSecret = 'e2e-access-secret-at-least-32-characters';

class FakeMediaStorage {
  readonly signed = new Map<string, CreateSignedUploadInput>();
  readonly deleted: DeleteStoredMediaInput[] = [];
  readonly confirmUpload = jest.fn((input: ConfirmUploadInput) => {
    const expected = this.signed.get(input.publicId);
    if (!expected) throw new Error('Unknown fake media identity');
    return Promise.resolve({
      providerAssetId: `provider-${expected.mediaAssetId}`,
      publicId: input.publicId,
      version: input.version,
      resourceType: input.resourceType,
      deliveryType: 'upload',
      format: input.resourceType === 'raw' ? 'pdf' : 'webp',
      assetFolder: expected.assetFolder,
      secureUrl: `https://media.example.test/${input.publicId}`,
      bytes: 100,
      width: input.resourceType === 'image' ? 100 : undefined,
      height: input.resourceType === 'image' ? 200 : undefined,
    });
  });
  deleteOutcomes: Array<'deleted' | 'not_found' | Error> = [];

  createSignedUpload(input: CreateSignedUploadInput) {
    this.signed.set(input.publicId, input);
    return {
      mediaAssetId: input.mediaAssetId,
      uploadUrl: `https://api.cloudinary.test/${input.resourceType}/upload`,
      cloudName: 'e2e-cloud',
      apiKey: 'public-key',
      signature: 'signed-upload',
      timestamp: Math.floor(Date.now() / 1000),
      resourceType: input.resourceType,
      confirmExpiresAt: input.confirmExpiresAt.toISOString(),
      parameters: {
        upload_preset: 'test',
        public_id: input.publicId,
        asset_folder: input.assetFolder,
        overwrite: false,
        tags: 'e2e',
      },
    };
  }

  delete(input: DeleteStoredMediaInput): Promise<DeleteStoredMediaResult> {
    this.deleted.push(input);
    const outcome = this.deleteOutcomes.shift() ?? 'deleted';
    if (outcome instanceof Error) return Promise.reject(outcome);
    return Promise.resolve({ outcome });
  }

  buildUrl(input: { publicId: string }) {
    return `https://media.example.test/delivery/${input.publicId}`;
  }
}

describe('Media lifecycle with runtime auth wiring (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let processor: CloudinaryWebhookInboxProcessor;
  let idempotencyStore: InMemoryIdempotencyStore;
  const storage = new FakeMediaStorage();
  const runId = randomUUID();
  const userId = randomUUID();
  const otherUserId = randomUUID();
  const adminId = randomUUID();
  const sessionId = randomUUID();
  const otherSessionId = randomUUID();
  const adminSessionId = randomUUID();
  const storyId = randomUUID();

  beforeAll(async () => {
    idempotencyStore = new InMemoryIdempotencyStore(
      new ConfigService({
        infrastructureFallback: {
          inMemoryStoreMaxEntries: 1000,
          inMemoryStoreSweepIntervalMs: 60_000,
        },
        idempotency: { maxResponseBytes: 1_048_576 },
      }),
    );
    const cloudinary = {
      utils: {
        verifyNotificationSignature: jest.fn().mockReturnValue(true),
        api_sign_request: jest.fn().mockReturnValue('signature'),
      },
    };
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MEDIA_STORAGE)
      .useValue(storage)
      .overrideProvider(CLOUDINARY_CLIENT)
      .useValue(cloudinary)
      .overrideProvider(CloudinaryUrlService)
      .useValue({
        build: (input: { publicId: string }) => storage.buildUrl(input),
      })
      .overrideProvider(IDEMPOTENCY_STORE)
      .useValue(idempotencyStore)
      .compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    const config = app.get(ConfigService).getOrThrow<AppConfig>('app');
    configureApplication(app, config);
    await app.init();
    prisma = app.get(PrismaService);
    processor = app.get(CloudinaryWebhookInboxProcessor);
    await seedActors();
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.mediaAsset.deleteMany({
      where: { uploaderId: { in: [userId, otherUserId, adminId] } },
    });
    await prisma.inboundWebhookEvent.deleteMany({
      where: { eventKey: { startsWith: `e2e-${runId}` } },
    });
    await prisma.story.deleteMany({ where: { id: storyId } });
    await prisma.user.deleteMany({
      where: { id: { in: [userId, otherUserId, adminId] } },
    });
    await app?.close();
    idempotencyStore?.onModuleDestroy();
  });

  const token = (sub: string, sid: string) =>
    jwt.sign({ sub, sid, typ: JwtTokenType.ACCESS, ver: 0 }, accessSecret, {
      algorithm: 'HS256',
      issuer: process.env.JWT_ISSUER,
      audience: process.env.JWT_AUDIENCE,
      expiresIn: '5m',
    });

  const httpServer = () => app.getHttpServer() as Parameters<typeof request>[0];

  const unwrap = <T>(body: unknown): T => {
    if (body && typeof body === 'object' && 'data' in body) {
      return (body as { data: T }).data;
    }
    return body as T;
  };

  async function createIntent(input: {
    purpose: string;
    ownerId: string;
    originalName: string;
    declaredMimeType: string;
  }) {
    const response = await request(httpServer())
      .post('/api/v1/media/upload-intents')
      .set('Authorization', `Bearer ${token(userId, sessionId)}`)
      .set('x-idempotency-key', randomUUID())
      .send({ ...input, declaredSizeBytes: 100 })
      .expect(201);
    return unwrap<{
      mediaAssetId: string;
      resourceType: 'image' | 'raw';
      parameters: { public_id: string };
    }>(response.body as unknown);
  }

  function confirmIntent(intent: {
    mediaAssetId: string;
    resourceType: 'image' | 'raw';
    parameters: { public_id: string };
  }): request.Test {
    return request(httpServer())
      .post(`/api/v1/media/upload-intents/${intent.mediaAssetId}/confirm`)
      .set('Authorization', `Bearer ${token(userId, sessionId)}`)
      .send({
        publicId: intent.parameters.public_id,
        version: 1,
        signature: 'provider-response-signature',
        resourceType: intent.resourceType,
      });
  }

  async function createReadyAvatar() {
    const intent = await createIntent({
      purpose: 'AVATAR',
      ownerId: userId,
      originalName: 'avatar.webp',
      declaredMimeType: 'image/webp',
    });
    await confirmIntent(intent).expect(201);
    return intent;
  }

  it('runs an authenticated image lifecycle and persists each DB state', async () => {
    const intent = await createIntent({
      purpose: 'AVATAR',
      ownerId: userId,
      originalName: 'avatar.webp',
      declaredMimeType: 'image/webp',
    });
    expect(intent.parameters.public_id).not.toContain('.webp');
    await expect(
      prisma.mediaAsset.findUnique({ where: { id: intent.mediaAssetId } }),
    ).resolves.toMatchObject({ status: 'PENDING', uploaderId: userId });

    await confirmIntent(intent).expect(201);
    await expect(
      prisma.mediaAsset.findUnique({ where: { id: intent.mediaAssetId } }),
    ).resolves.toMatchObject({ status: 'READY', resourceType: 'IMAGE' });

    const found = await request(httpServer())
      .get(`/api/v1/media/${intent.mediaAssetId}`)
      .set('Authorization', `Bearer ${token(userId, sessionId)}`)
      .expect(200);
    expect(
      unwrap<{ deliveryUrl: string }>(found.body as unknown).deliveryUrl,
    ).toContain(intent.parameters.public_id);

    await request(httpServer())
      .delete(`/api/v1/media/${intent.mediaAssetId}`)
      .set('Authorization', `Bearer ${token(userId, sessionId)}`)
      .expect(204);
    await expect(
      prisma.mediaAsset.findUnique({ where: { id: intent.mediaAssetId } }),
    ).resolves.toMatchObject({ status: 'DELETED' });
  });

  it('enforces replay, payload conflict, principal isolation and in-flight exclusion', async () => {
    const key = `media-intent-${runId}`;
    const payload = {
      purpose: 'AVATAR',
      ownerId: userId,
      originalName: 'idempotent.webp',
      declaredMimeType: 'image/webp',
      declaredSizeBytes: 100,
    };
    const send = (
      actorToken: string,
      body: typeof payload,
      idempotencyKey: string,
    ) =>
      request(httpServer())
        .post('/api/v1/media/upload-intents')
        .set('Authorization', `Bearer ${actorToken}`)
        .set('x-idempotency-key', idempotencyKey)
        .send(body);

    const first = await send(token(userId, sessionId), payload, key).expect(
      201,
    );
    const replay = await send(token(userId, sessionId), payload, key).expect(
      201,
    );
    expect(replay.headers['x-idempotent-replayed']).toBe('true');
    expect(replay.body).toEqual(first.body);

    await send(
      token(userId, sessionId),
      { ...payload, originalName: 'different.webp' },
      key,
    ).expect(409);

    const other = await send(
      token(otherUserId, otherSessionId),
      { ...payload, ownerId: otherUserId },
      key,
    ).expect(201);
    expect(other.headers['x-idempotent-replayed']).toBeUndefined();
    expect(other.body).not.toEqual(first.body);

    const concurrentKey = `${key}-concurrent`;
    const concurrent = await Promise.all([
      send(token(userId, sessionId), payload, concurrentKey),
      send(token(userId, sessionId), payload, concurrentKey),
    ]);
    expect(concurrent.map(({ status }) => status).sort()).toEqual([201, 409]);
  });

  it('keeps a raw extension through intent, confirm and delete', async () => {
    const intent = await createIntent({
      purpose: 'ATTACHMENT',
      ownerId: storyId,
      originalName: 'chapter-notes.PDF',
      declaredMimeType: 'application/pdf',
    });
    expect(intent.parameters.public_id).toMatch(/\.pdf$/);
    expect(intent.resourceType).toBe('raw');
    await confirmIntent(intent).expect(201);
    await request(httpServer())
      .delete(`/api/v1/media/${intent.mediaAssetId}`)
      .set('Authorization', `Bearer ${token(userId, sessionId)}`)
      .expect(204);
    expect(storage.deleted).toContainEqual(
      expect.objectContaining({
        publicId: intent.parameters.public_id,
        resourceType: 'raw',
      }),
    );
  });

  it('rejects missing and invalid access tokens', async () => {
    await request(httpServer())
      .post('/api/v1/media/upload-intents')
      .send({})
      .expect(401);
    await request(httpServer())
      .post('/api/v1/media/upload-intents')
      .set('Authorization', 'Bearer invalid-token')
      .send({})
      .expect(401);
  });

  it('forbids another uploader but permits explicit admin permission', async () => {
    const intent = await createReadyAvatar();
    await request(httpServer())
      .delete(`/api/v1/media/${intent.mediaAssetId}`)
      .set('Authorization', `Bearer ${token(otherUserId, otherSessionId)}`)
      .expect(403);
    await request(httpServer())
      .delete(`/api/v1/media/${intent.mediaAssetId}`)
      .set('Authorization', `Bearer ${token(adminId, adminSessionId)}`)
      .expect(204);
  });

  it('makes duplicate and concurrent confirmation provider-idempotent', async () => {
    const intent = await createIntent({
      purpose: 'AVATAR',
      ownerId: userId,
      originalName: 'race.webp',
      declaredMimeType: 'image/webp',
    });
    const callsBefore = storage.confirmUpload.mock.calls.length;
    const [first, second] = await Promise.all([
      confirmIntent(intent),
      confirmIntent(intent),
    ]);
    expect([first.status, second.status].sort()).toEqual(
      expect.arrayContaining([201]),
    );
    expect([201, 409]).toContain(first.status);
    expect([201, 409]).toContain(second.status);
    await confirmIntent(intent).expect(201);
    expect(storage.confirmUpload.mock.calls.length - callsBefore).toBe(1);
  });

  it('treats provider not-found as deleted and retries DELETE_FAILED', async () => {
    const notFound = await createReadyAvatar();
    storage.deleteOutcomes.push('not_found');
    await request(httpServer())
      .delete(`/api/v1/media/${notFound.mediaAssetId}`)
      .set('Authorization', `Bearer ${token(userId, sessionId)}`)
      .expect(204);

    const retry = await createReadyAvatar();
    storage.deleteOutcomes.push(new Error('temporary provider failure'));
    await request(httpServer())
      .delete(`/api/v1/media/${retry.mediaAssetId}`)
      .set('Authorization', `Bearer ${token(userId, sessionId)}`)
      .expect(500);
    await expect(
      prisma.mediaAsset.findUnique({ where: { id: retry.mediaAssetId } }),
    ).resolves.toMatchObject({ status: 'DELETE_FAILED' });
    storage.deleteOutcomes.push('deleted');
    await request(httpServer())
      .delete(`/api/v1/media/${retry.mediaAssetId}`)
      .set('Authorization', `Bearer ${token(userId, sessionId)}`)
      .expect(204);
  });

  it('persists a webhook before response and processes it once', async () => {
    const intent = await createIntent({
      purpose: 'AVATAR',
      ownerId: userId,
      originalName: 'webhook.webp',
      declaredMimeType: 'image/webp',
    });
    const eventKey = `e2e-${runId}-upload`;
    const webhookResponse = await request(httpServer())
      .post('/api/v1/webhooks/cloudinary')
      .set('x-cld-timestamp', String(Math.floor(Date.now() / 1000)))
      .set('x-cld-signature', 'valid')
      .send({
        notification_id: eventKey,
        notification_type: 'upload',
        public_id: intent.parameters.public_id,
        resource_type: 'image',
      });
    if (webhookResponse.status !== 200) {
      throw new Error(
        `Webhook request failed: ${webhookResponse.status} ${JSON.stringify(webhookResponse.body)}`,
      );
    }
    await expect(
      prisma.inboundWebhookEvent.findUnique({
        where: { provider_eventKey: { provider: 'cloudinary', eventKey } },
      }),
    ).resolves.toMatchObject({ status: 'PENDING' });
    await processor.processBatch();
    await processor.processBatch();
    await expect(
      prisma.inboundWebhookEvent.findUnique({
        where: { provider_eventKey: { provider: 'cloudinary', eventKey } },
      }),
    ).resolves.toMatchObject({ status: 'PROCESSED', attempts: 1 });
    await expect(
      prisma.mediaAsset.findUnique({ where: { id: intent.mediaAssetId } }),
    ).resolves.toMatchObject({ status: 'UPLOADED' });
  });

  async function seedActors(): Promise<void> {
    await prisma.user.createMany({
      data: [userId, otherUserId, adminId].map((id, index) => ({
        id,
        email: `media-e2e-${runId}-${index}@example.test`,
        username: `media_e2e_${runId.replaceAll('-', '').slice(0, 12)}_${index}`,
        displayName: `Media E2E ${index}`,
        emailVerifiedAt: new Date(),
      })),
    });
    await prisma.authorProfile.create({
      data: { userId, penName: `media-e2e-${runId}` },
    });
    await prisma.story.create({
      data: {
        id: storyId,
        authorId: userId,
        title: 'Media E2E story',
        slug: `media-e2e-${runId}`,
        synopsis: 'E2E fixture',
      },
    });
    await seedRoles();
    await prisma.session.createMany({
      data: [
        { id: sessionId, userId },
        { id: otherSessionId, userId: otherUserId },
        { id: adminSessionId, userId: adminId },
      ].map((session) => ({
        ...session,
        refreshTokenHash: `refresh-${session.id}`,
        expiresAt: new Date(Date.now() + 60 * 60_000),
      })),
    });
  }

  async function seedRoles(): Promise<void> {
    const upload = await prisma.permission.upsert({
      where: { code: PermissionCode.MEDIA_UPLOAD },
      update: {},
      create: {
        code: PermissionCode.MEDIA_UPLOAD,
        name: 'Upload media',
        resource: 'media',
        action: 'upload',
      },
    });
    const manage = await prisma.permission.upsert({
      where: { code: PermissionCode.MEDIA_MANAGE_ANY },
      update: {},
      create: {
        code: PermissionCode.MEDIA_MANAGE_ANY,
        name: 'Manage any media',
        resource: 'media',
        action: 'manage.any',
      },
    });
    const userRole = await prisma.role.upsert({
      where: { code: RoleCode.USER },
      update: {},
      create: { code: RoleCode.USER, name: 'User', isSystem: true },
    });
    const adminRole = await prisma.role.upsert({
      where: { code: RoleCode.ADMIN },
      update: {},
      create: { code: RoleCode.ADMIN, name: 'Admin', isSystem: true },
    });
    await prisma.rolePermission.createMany({
      data: [
        { roleId: userRole.id, permissionId: upload.id },
        { roleId: adminRole.id, permissionId: upload.id },
        { roleId: adminRole.id, permissionId: manage.id },
      ],
      skipDuplicates: true,
    });
    await prisma.userRole.createMany({
      data: [
        { userId, roleId: userRole.id },
        { userId: otherUserId, roleId: userRole.id },
        { userId: adminId, roleId: adminRole.id },
      ],
      skipDuplicates: true,
    });
  }
});
