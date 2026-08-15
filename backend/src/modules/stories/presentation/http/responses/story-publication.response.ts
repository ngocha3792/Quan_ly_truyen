import type { StoryPublicationRecord } from '../../../application';
import { type StoryResponse, toStoryResponse } from './story.response';

export interface StorySubmissionResponse {
  readonly id: string;
  readonly storyId: string;
  readonly submittedById: string;
  readonly reviewedById: string | null;
  readonly status: string;
  readonly authorNote: string | null;
  readonly reviewerNote: string | null;
  readonly submittedAt: string;
  readonly reviewedAt: string | null;
  readonly canceledAt: string | null;
}

export interface StoryPublicationResponse {
  readonly story: StoryResponse;
  readonly submission: StorySubmissionResponse;
}

export function toStoryPublicationResponse(
  publication: StoryPublicationRecord,
): StoryPublicationResponse {
  return {
    story: toStoryResponse(publication.story),
    submission: {
      id: publication.submission.id,
      storyId: publication.submission.storyId,
      submittedById: publication.submission.submittedById,
      reviewedById: publication.submission.reviewedById,
      status: publication.submission.status,
      authorNote: publication.submission.authorNote,
      reviewerNote: publication.submission.reviewerNote,
      submittedAt: publication.submission.submittedAt.toISOString(),
      reviewedAt: publication.submission.reviewedAt?.toISOString() ?? null,
      canceledAt: publication.submission.canceledAt?.toISOString() ?? null,
    },
  };
}
