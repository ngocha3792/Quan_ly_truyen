import { PrismaReportRepository } from './prisma-report.repository';

describe('comment report context with a single database target', () => {
  function setup() {
    const now = new Date();
    const row = {
      id: 'report',
      status: 'OPEN',
      reason: 'SPAM',
      evidence: {},
      createdAt: now,
      updatedAt: now,
      resolvedAt: null,
      reporter: { id: 'reporter', displayName: 'Reporter' },
      reportedUser: null,
      story: null,
      chapter: null,
      moderationActions: [],
      comment: {
        id: 'comment',
        body: 'Reported text',
        createdAt: now,
        editedAt: null,
        deletedAt: null,
        user: {
          id: 'author',
          displayName: 'Author',
          email: 'author@example.test',
          status: 'ACTIVE',
        },
        story: { id: 'story', title: 'Story', slug: 'story' },
        chapter: { id: 'chapter', title: 'Chapter', number: 1 },
      },
    };
    const prisma = {
      report: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([row]),
        findUnique: jest.fn().mockResolvedValue(row),
      },
      moderationAction: { count: jest.fn().mockResolvedValue(2) },
      $transaction: (queries: Promise<unknown>[]) => Promise.all(queries),
    };
    return { prisma, repository: new PrismaReportRepository(prisma as never) };
  }
  it('lists the related author/story/chapter and filters through the comment author', async () => {
    const { prisma, repository } = setup();
    const result = await repository.list({
      page: 1,
      pageSize: 20,
      reportedUser: 'author@example.test',
    });
    expect(result.items[0]).toMatchObject({
      reportedUser: { id: 'author' },
      story: { id: 'story' },
      chapter: { id: 'chapter' },
    });
    expect(prisma.report.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          comment: { user: expect.any(Object) as unknown },
        }) as unknown,
      }),
    );
  });
  it('uses the comment author for detail and moderation history when user target is null', async () => {
    const { prisma, repository } = setup();
    const detail = await repository.get('report');
    expect(detail).toMatchObject({
      reportedUser: { id: 'author' },
      story: { id: 'story' },
      chapter: { id: 'chapter' },
      recentUserModerationCount: 2,
    });
    expect(prisma.moderationAction.count).toHaveBeenCalledWith({
      where: {
        targetUserId: 'author',
        createdAt: { gte: expect.any(Date) as unknown },
      },
    });
  });
});
