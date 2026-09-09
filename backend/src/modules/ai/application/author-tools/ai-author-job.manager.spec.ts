import { AiAuthorJobManager, authorJobView } from './ai-author-job.manager';
import { AiAuthorConnectionResolver } from './ai-author-connection.resolver';
import { AiAuthorPersistencePort } from './ai-author.persistence.port';
import type { AuthorJob, CreateAuthorJob } from './ai-author.types';
import {
  AiConnectionResolver,
  AiResolvedConnectionFactory,
} from '../connection-resolution';

describe('Author tools access and request boundaries', () => {
  const input: CreateAuthorJob = {
    userId: 'user',
    storyId: 'story',
    chapterId: 'chapter',
    jobType: 'CHAPTER_SUMMARY',
    connectionId: 'connection',
    expectedVersion: 2,
  };
  function setup() {
    const persistence = {
      assertAccess: jest.fn().mockResolvedValue(undefined),
      source: jest.fn().mockResolvedValue({
        storyVersion: 1,
        chapters: [
          {
            id: 'chapter',
            version: 2,
            number: '1',
            title: 'Title',
            content: 'Private draft',
          },
        ],
      }),
      create: jest.fn().mockResolvedValue({
        id: 'job',
        totalCost: null,
        leaseToken: 'secret-token',
        leaseExpiresAt: new Date(),
      }),
      find: jest.fn(),
    };
    const resolver = {
      resolve: jest.fn().mockResolvedValue({ primary: { id: 'connection' } }),
    };
    return {
      persistence,
      resolver,
      manager: new AiAuthorJobManager(
        persistence as unknown as AiAuthorPersistencePort,
        resolver as unknown as AiAuthorConnectionResolver,
      ),
    };
  }
  it('requires editor version and stores hashes without raw source text', async () => {
    const { persistence, manager } = setup();
    expect(await manager.create(input)).toMatchObject({
      id: 'job',
      costStatus: 'UNAVAILABLE',
      totalCost: null,
    });
    const snapshot = (persistence.create.mock.calls[0] as unknown[])[1];
    expect(JSON.stringify(snapshot)).not.toMatch(/Private draft|Title/u);
    expect(snapshot).toMatchObject({
      chapters: [
        expect.objectContaining({
          version: 2,
          hash: expect.any(String) as unknown,
        }) as unknown,
      ],
    });
  });
  it('rejects an unsaved/stale editor before enqueuing', async () => {
    const { persistence, manager } = setup();
    await expect(
      manager.create({ ...input, expectedVersion: 1 }),
    ).rejects.toMatchObject({ code: 'AI_AUTHOR_SOURCE_CHANGED' });
    expect(persistence.create).not.toHaveBeenCalled();
  });
  it('does not allow a chapter id to masquerade as a whole-story summary', async () => {
    const { persistence, manager } = setup();
    await expect(
      manager.create({ ...input, jobType: 'STORY_SUMMARY' }),
    ).rejects.toMatchObject({ code: 'AI_AUTHOR_CHAPTER_REQUIRED' });
    expect(persistence.create).not.toHaveBeenCalled();
  });
  it('checks per-job requester and story on read', async () => {
    const { persistence, manager } = setup();
    persistence.find.mockResolvedValue({
      userId: 'other-user',
      storyId: 'story',
    });
    await expect(manager.get('user', 'story', 'job')).rejects.toThrow();
    persistence.find.mockResolvedValue({
      userId: 'user',
      storyId: 'other-story',
    });
    await expect(manager.get('user', 'story', 'job')).rejects.toThrow();
    expect(persistence.assertAccess).toHaveBeenCalledTimes(2);
  });
  it('never exposes lease credentials or fake zero cost', () => {
    const view = authorJobView({
      id: 'job',
      leaseToken: 'secret',
      leaseExpiresAt: new Date(),
      totalCost: null,
    } as AuthorJob);
    expect(view).not.toHaveProperty('leaseToken');
    expect(view).not.toHaveProperty('leaseExpiresAt');
    expect(view).toMatchObject({ totalCost: null, costStatus: 'UNAVAILABLE' });
  });
  it('rejects resolver substitution when the requested connection was foreign or deleted', async () => {
    const resolver = {
      resolvePlan: jest.fn().mockResolvedValue({
        primary: { id: 'another-personal-connection' },
        systemFallback: null,
      }),
    };
    const factory = { fromRecord: jest.fn() };
    const connections = new AiAuthorConnectionResolver(
      resolver as unknown as AiConnectionResolver,
      factory as unknown as AiResolvedConnectionFactory,
    );
    await expect(
      connections.execution('user', 'foreign-connection'),
    ).rejects.toThrow('CONNECTION_UNAVAILABLE');
    expect(factory.fromRecord).not.toHaveBeenCalled();
  });
});
