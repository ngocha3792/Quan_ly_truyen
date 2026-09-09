import { Prisma } from '@/generated/prisma/client';
import type {
  AuthorJob,
  AuthorResult,
} from '../../application/author-tools/ai-author.types';

export async function persistAuthorResults(
  tx: Prisma.TransactionClient,
  job: AuthorJob,
  result: AuthorResult,
): Promise<void> {
  if ('characters' in result) {
    for (const character of result.characters) {
      const existing = await tx.storyCharacter.findUnique({
        where: { storyId_name: { storyId: job.storyId, name: character.name } },
        select: { isVerified: true },
      });
      if (existing?.isVerified) continue;
      await tx.storyCharacter.upsert({
        where: { storyId_name: { storyId: job.storyId, name: character.name } },
        create: { ...character, storyId: job.storyId, extractedBy: job.id },
        update: { ...character, extractedBy: job.id },
      });
    }
  }
  if ('issues' in result) {
    await tx.chapterConsistencyIssue.createMany({
      data: result.issues.map((issue) => ({
        ...issue,
        detectedBy: job.id,
        sourceVersion: job.sourceSnapshot.chapters.find(
          (c) => c.id === issue.chapterId,
        )!.version,
      })),
    });
  }
}
export async function writeAuthorAudit(
  tx: Prisma.TransactionClient,
  job: Pick<AuthorJob, 'id' | 'userId' | 'storyId' | 'jobType'>,
  action: string,
  metadata: Prisma.InputJsonObject = {},
): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorId: job.userId,
      action: `ai.author-job.${action}`,
      entityType: 'AiAuthorJob',
      entityId: job.id,
      metadata: { storyId: job.storyId, jobType: job.jobType, ...metadata },
    },
  });
}
