import { Injectable } from '@nestjs/common';
import { Prisma, SubmissionStatus } from '@/generated/prisma/client';
import { mapPrismaError, PrismaService } from '@/infrastructure/database';
import type { ListStorySubmissionsInput, ListStorySubmissionsResult, StoryModerationReaderPort, StorySubmissionDetailRecord } from '../../application/ports';

@Injectable()
export class PrismaStoryModerationReader implements StoryModerationReaderPort {
  constructor(private readonly prisma: PrismaService) {}
  async listStorySubmissions(input: ListStorySubmissionsInput): Promise<ListStorySubmissionsResult> {
    try {
      const author = input.author?.trim();
      const story = input.story?.trim();
      const reviewer = input.reviewer?.trim();
      const storyWhere: Prisma.StoryWhereInput = {
        ...(author
          ? {
              author: {
                OR: [
                  { penName: { contains: author, mode: 'insensitive' } },
                  { slug: { contains: author, mode: 'insensitive' } },
                  {
                    user: {
                      OR: [
                        { displayName: { contains: author, mode: 'insensitive' } },
                        { email: { contains: author, mode: 'insensitive' } },
                      ],
                    },
                  },
                ],
              },
            }
          : {}),
        ...(story
          ? {
              OR: [
                { title: { contains: story, mode: 'insensitive' } },
                { slug: { contains: story, mode: 'insensitive' } },
              ],
            }
          : {}),
      };
      const where: Prisma.StorySubmissionWhereInput = {
        ...(input.status ? { status: input.status as SubmissionStatus } : {}),
        ...(input.submittedFrom || input.submittedTo
          ? {
              submittedAt: {
                ...(input.submittedFrom ? { gte: input.submittedFrom } : {}),
                ...(input.submittedTo ? { lte: input.submittedTo } : {}),
              },
            }
          : {}),
        ...(author || story ? { story: storyWhere } : {}),
        ...(reviewer
          ? {
              reviewedBy: {
                OR: [
                  { displayName: { contains: reviewer, mode: 'insensitive' } },
                  { username: { contains: reviewer, mode: 'insensitive' } },
                  { email: { contains: reviewer, mode: 'insensitive' } },
                  ...(looksLikeUuid(reviewer) ? [{ id: reviewer }] : []),
                ],
              },
            }
          : {}),
      };
      const direction: Prisma.SortOrder = input.sort.endsWith(':asc') ? 'asc' : 'desc'; const skip=(input.page-1)*input.pageSize;
      const [totalItems, records] = await Promise.all([
        this.prisma.storySubmission.count({ where }),
        this.prisma.storySubmission.findMany({ where, orderBy: [{ submittedAt: direction }, { id: direction }], skip, take: input.pageSize, select: { id: true, status: true, submittedAt: true, reviewedAt: true, reviewerNote: true,
          story: { select: { id: true, title: true, slug: true, chapterCount: true, author: { select: { userId: true, slug: true, user: { select: { displayName: true } } } } } },
          reviewedBy: { select: { id: true, displayName: true } } } }),
      ]);
      return { totalItems, items: records.map((record) => ({ submissionId: record.id, status: record.status, story: { id: record.story.id, title: record.story.title, slug: record.story.slug }, author: { id: record.story.author.userId, displayName: record.story.author.user.displayName, slug: record.story.author.slug }, submittedAt: record.submittedAt, reviewer: record.reviewedBy, reviewedAt: record.reviewedAt, rejectionReason: record.status === SubmissionStatus.REJECTED ? record.reviewerNote : null, chapterCount: record.story.chapterCount })) };
    } catch (error: unknown) { throw mapPrismaError(error, { operation: 'admin-story-submission-list', resource: 'Yêu cầu duyệt truyện' }); }
  }
  async getStorySubmission(submissionId: string): Promise<StorySubmissionDetailRecord | null> {
    try {
      const record = await this.prisma.storySubmission.findUnique({ where: { id: submissionId }, select: { id: true, status: true, authorNote: true, reviewerNote: true, submittedAt: true, reviewedAt: true, reviewedBy: { select: { id: true, displayName: true } }, story: { select: { id: true, title: true, slug: true, synopsis: true, status: true, visibility: true, coverMedia: { select: { secureUrl: true, publicUrl: true } },
        author: { select: { userId: true, penName: true, slug: true, lifecycleStatus: true, user: { select: { displayName: true } } } },
        categories: { orderBy: [{ isPrimary: 'desc' }, { categoryId: 'asc' }], select: { category: { select: { id: true, name: true, slug: true } } } },
        tags: { orderBy: { tagId: 'asc' }, select: { tag: { select: { id: true, name: true, slug: true } } } },
        chapters: { where: { deletedAt: null }, orderBy: [{ number: 'asc' }, { id: 'asc' }], select: { id: true, number: true, title: true, status: true, content: true, updatedAt: true } },
        submissions: { orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }], select: { id: true, status: true, submittedAt: true, reviewedAt: true, reviewerNote: true, reviewedBy: { select: { id: true, displayName: true } } } },
      } } } });
      if (!record) return null;
      const audit = await this.prisma.auditLog.findMany({ where: { entityType: 'story', entityId: record.story.id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 20, select: { id: true, action: true, actorId: true, requestId: true, createdAt: true } });
      return { submission: { id: record.id, status: record.status, authorNote: record.authorNote, submittedAt: record.submittedAt, reviewedAt: record.reviewedAt, rejectionReason: record.status === SubmissionStatus.REJECTED ? record.reviewerNote : null, reviewer: record.reviewedBy },
        author: { id: record.story.author.userId, displayName: record.story.author.user.displayName, penName: record.story.author.penName, slug: record.story.author.slug, status: record.story.author.lifecycleStatus },
        story: { id: record.story.id, title: record.story.title, slug: record.story.slug, synopsis: record.story.synopsis, status: record.story.status, visibility: record.story.visibility, coverUrl: record.story.coverMedia?.secureUrl ?? record.story.coverMedia?.publicUrl ?? null, categories: record.story.categories.map((item) => item.category), tags: record.story.tags.map((item) => item.tag) },
        chapters: record.story.chapters.map((chapter) => ({ id: chapter.id, number: chapter.number.toString(), title: chapter.title, status: chapter.status, content: chapter.content, updatedAt: chapter.updatedAt })),
        submissionHistory: record.story.submissions.map((submission) => ({ id: submission.id, status: submission.status, submittedAt: submission.submittedAt, reviewedAt: submission.reviewedAt, reviewer: submission.reviewedBy, rejectionReason: submission.status === SubmissionStatus.REJECTED ? submission.reviewerNote : null })), recentAudit: audit };
    } catch (error: unknown) { throw mapPrismaError(error, { operation: 'admin-story-submission-detail', resource: 'Yêu cầu duyệt truyện' }); }
  }
}
function looksLikeUuid(value: string): boolean { return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
