
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
    readonly genreOptions:
    readonly AuthorApplicationOption[];

    readonly experienceOptions:
    readonly AuthorApplicationOption[];

    readonly requirements:
    readonly AuthorReviewRequirement[];

    readonly reviewSteps:
    readonly AuthorReviewStep[];

    readonly benefits:
    readonly AuthorBenefit[];

    readonly acceptedFileExtensions:
    readonly string[];

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

export interface AuthorApplicationPayload
    extends AuthorApplicationDraft {
    readonly sampleFile: File;
}

export interface AuthorApplicationResult {
    readonly applicationId: string;
    readonly submittedAt: string;
    readonly message: string;
}

export type AuthorApplicationStatus =
    | 'idle'
    | 'loading'
    | 'saving-draft'
    | 'submitting'
    | 'success'
    | 'error';