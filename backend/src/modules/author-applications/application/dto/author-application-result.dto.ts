import type { AuthorApplicationStatus } from '../../domain';

export interface AuthorApplicationResultDto {
  readonly applicationId: string;

  readonly userId: string;

  readonly status: AuthorApplicationStatus;

  readonly penName: string | null;

  readonly fullName: string | null;

  readonly email: string | null;

  readonly phone: string | null;

  readonly portfolioUrl: string | null;

  readonly primaryGenre: string | null;

  readonly experience: string | null;

  readonly introduction: string | null;

  readonly firstWorkSynopsis: string | null;

  readonly acceptedTerms: boolean;

  readonly sample: {
    readonly id: string;

    readonly fileName: string | null;

    readonly mimeType: string | null;

    readonly sizeBytes: string | null;

    readonly url: string | null;
  } | null;

  readonly submittedAt: Date | null;

  readonly reviewedAt: Date | null;

  readonly reviewedById: string | null;

  readonly rejectionReason: string | null;

  readonly createdAt: Date;

  readonly updatedAt: Date;
}

export interface AuthorApplicationListResultDto {
  readonly total: number;

  readonly applications: readonly AuthorApplicationResultDto[];
}

export interface AuthorApplicationConfigResultDto {
  readonly genreOptions: readonly {
    readonly value: string;

    readonly label: string;
  }[];

  readonly experienceOptions: readonly {
    readonly value: string;

    readonly label: string;
  }[];

  readonly requirements: readonly {
    readonly id: string;

    readonly content: string;
  }[];

  readonly reviewSteps: readonly {
    readonly number: number;

    readonly title: string;

    readonly description: string;
  }[];

  readonly benefits: readonly {
    readonly id: string;

    readonly icon: 'work' | 'analytics' | 'community';

    readonly title: string;

    readonly description: string;
  }[];

  readonly acceptedFileExtensions: readonly string[];

  readonly maximumFileSizeMb: number;

  readonly introductionMaximumLength: number;

  readonly synopsisMaximumLength: number;
}
