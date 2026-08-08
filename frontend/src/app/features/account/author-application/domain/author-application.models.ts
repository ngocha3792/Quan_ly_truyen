export interface AuthorApplicationOption {
  readonly value: string;

  readonly label: string;
}

export interface AuthorReviewRequirement {
  readonly id: string;

  readonly content: string;
}

export interface AuthorReviewStep {
  readonly number: number;

  readonly title: string;

  readonly description: string;
}

export interface AuthorBenefit {
  readonly id: string;

  readonly icon: 'work' | 'analytics' | 'community';

  readonly title: string;

  readonly description: string;
}

export interface AuthorApplicationConfig {
  readonly genreOptions: readonly AuthorApplicationOption[];

  readonly experienceOptions: readonly AuthorApplicationOption[];

  readonly requirements: readonly AuthorReviewRequirement[];

  readonly reviewSteps: readonly AuthorReviewStep[];

  readonly benefits: readonly AuthorBenefit[];

  readonly acceptedFileExtensions: readonly string[];

  readonly maximumFileSizeMb: number;

  readonly introductionMaximumLength: number;

  readonly synopsisMaximumLength: number;
}

export interface AuthorApplicationDraft {
  readonly penName: string;

  readonly fullName: string;

  readonly email: string;

  readonly phone: string;

  readonly portfolioUrl: string;

  readonly primaryGenre: string;

  readonly experience: string;

  readonly introduction: string;

  readonly firstWorkSynopsis: string;

  readonly acceptedTerms: boolean;

  readonly sampleFileName?: string;
}

export interface AuthorApplicationPayload extends AuthorApplicationDraft {
  readonly sampleFile: File;
}

export type AuthorApplicationReviewStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';

export interface AuthorApplicationRecord extends AuthorApplicationDraft {
  readonly applicationId: string;

  readonly userId: string;

  readonly status: AuthorApplicationReviewStatus;

  readonly sample: {
    readonly id: string;

    readonly fileName: string | null;

    readonly mimeType: string | null;

    readonly sizeBytes: string | null;

    readonly url: string | null;
  } | null;

  readonly submittedAt: string | null;

  readonly reviewedAt: string | null;

  readonly reviewedById: string | null;

  readonly rejectionReason: string | null;

  readonly createdAt: string;

  readonly updatedAt: string;
}

export type AuthorApplicationStatus =
  'idle' | 'loading' | 'saving-draft' | 'submitting' | 'success' | 'error';

export interface MediaUploadIntent {
  readonly mediaAssetId: string;

  readonly uploadUrl: string;

  readonly cloudName: string;

  readonly apiKey: string;

  readonly signature: string;

  readonly timestamp: number;

  readonly resourceType: 'image' | 'video' | 'raw';

  readonly confirmExpiresAt: string;

  readonly parameters: {
    readonly upload_preset: string;

    readonly public_id: string;

    readonly asset_folder: string;

    readonly overwrite: boolean;

    readonly tags: string;
  };
}

export interface CloudinaryUploadResponse {
  readonly public_id: string;

  readonly version: number;

  readonly signature: string;

  readonly resource_type: 'image' | 'video' | 'raw';

  readonly secure_url: string;
}

export interface ConfirmedApplicationMedia {
  readonly id: string;

  readonly status: string;

  readonly deliveryUrl: string | null;
}
