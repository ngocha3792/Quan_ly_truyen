import type { AuthorApplicationRecord } from '../ports';

import type { AuthorApplicationResultDto } from '../dto';

export class AuthorApplicationResultMapper {
  static toDto(
    application: AuthorApplicationRecord,
  ): AuthorApplicationResultDto {
    return {
      applicationId: application.id,

      userId: application.userId,

      status: application.status,

      penName: application.penName,

      fullName: application.fullName,

      email: application.email,

      phone: application.phone,

      portfolioUrl: application.portfolioUrl,

      primaryGenre: application.primaryGenre,

      experience: application.experience,

      introduction: application.introduction,

      firstWorkSynopsis: application.firstWorkSynopsis,

      acceptedTerms: application.acceptedTerms,

      sample: application.sample
        ? {
            id: application.sample.id,

            fileName: application.sample.fileName,

            mimeType: application.sample.mimeType,

            sizeBytes:
              application.sample.sizeBytes !== null
                ? application.sample.sizeBytes.toString()
                : null,

            url: application.sample.url,
          }
        : null,

      submittedAt: application.submittedAt,

      reviewedAt: application.reviewedAt,

      reviewedById: application.reviewedById,

      rejectionReason: application.rejectionReason,

      createdAt: application.createdAt,

      updatedAt: application.updatedAt,
    };
  }
}
