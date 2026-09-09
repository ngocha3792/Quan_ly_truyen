export type TtsProviderName = 'ELEVEN_LABS';
export type TtsFallbackPolicyName = 'NONE' | 'SYSTEM';
export type TtsManifestStatusName =
  'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface TtsConnectionDto {
  readonly id: string;
  readonly provider: TtsProviderName;
  readonly name: string;
  readonly voiceId: string;
  readonly voiceName: string;
  readonly language: string;
  readonly stability: number | null;
  readonly similarity: number | null;
  readonly style: number | null;
  readonly isSystem: boolean;
  readonly isActive: boolean;
  readonly createdAt: Date;
}

export interface TtsSegmentDto {
  readonly id: string;
  readonly blockId: string;
  readonly blockIndex: number;
  readonly status: 'PENDING' | 'GENERATED' | 'FAILED';
  readonly audioUrl: string | null;
  readonly durationMs: number | null;
  readonly startTimeMs: number | null;
  readonly endTimeMs: number | null;
  readonly wordTimings: readonly TtsWordTimingDto[] | null;
}

export interface TtsWordTimingDto {
  readonly word: string;
  readonly startMs: number;
  readonly endMs: number;
}

export interface TtsManifestDto {
  readonly id: string;
  readonly chapterId: string;
  readonly chapterVersion: number;
  readonly language: string;
  readonly voiceId: string;
  readonly fallbackPolicy: TtsFallbackPolicyName;
  readonly status: TtsManifestStatusName;
  readonly totalSegments: number;
  readonly completedSegments: number;
  readonly characterCount: number;
  readonly totalDurationMs: number | null;
  readonly estimatedCostMicros: string | null;
  readonly failureReason: string | null;
  readonly createdAt: Date;
  readonly segments?: readonly TtsSegmentDto[];
}

export interface TtsQuotaDto {
  readonly monthlyCharacterLimit: number;
  readonly currentMonthUsage: number;
  readonly reservedCharacters: number;
  readonly remainingCharacters: number;
  readonly currentMonthStart: Date;
  readonly totalCharacters: string;
  readonly totalSegments: number;
}
