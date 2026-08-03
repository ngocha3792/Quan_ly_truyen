import { MODULE_METADATA } from '@nestjs/common/constants';

describe('maintenance worker isolation', () => {
  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL =
      'postgresql://postgres:postgres@localhost:5432/worker_isolation_test';
    process.env.JWT_ACCESS_SECRET =
      'worker-isolation-test-secret-at-least-32-characters';
    process.env.JWT_REFRESH_SECRET =
      'different-refresh-secret-at-least-32-characters';
    process.env.CLOUDINARY_ENABLED = 'false';
    process.env.MAIL_ENABLED = 'false';
    process.env.REDIS_ENABLED = 'false';
    process.env.QUEUE_ENABLED = 'false';
  });

  it('keeps one-shot command modules isolated from long-running workers', async () => {
    const { MediaCleanupCommandModule } =
      await import('./media-cleanup-command.module');
    const { CloudinaryWebhookCommandModule } =
      await import('./cloudinary-webhook-command.module');
    const { OutboxRetentionCommandModule } =
      await import('./outbox-retention-command.module');

    for (const commandModule of [
      MediaCleanupCommandModule,
      CloudinaryWebhookCommandModule,
      OutboxRetentionCommandModule,
    ]) {
      const imports =
        (Reflect.getMetadata(MODULE_METADATA.IMPORTS, commandModule) as
          unknown[] | undefined) ?? [];
      const importNames = imports.map((value) =>
        typeof value === 'function' ? value.name : String(value),
      );
      expect(importNames).not.toEqual(
        expect.arrayContaining(['WorkerModule', 'MailModule', 'OutboxModule']),
      );
    }
  });
});
