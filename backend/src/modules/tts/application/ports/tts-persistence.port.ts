import type {
  TtsConnectionDto,
  TtsFallbackPolicyName,
  TtsManifestDto,
  TtsProviderName,
  TtsQuotaDto,
} from '../dto';

export const TTS_PERSISTENCE_PORT = Symbol.for(
  'quan-ly-truyen.modules.tts.persistence',
);

export interface CreateTtsConnectionInput {
  readonly userId: string | null;
  readonly isSystem: boolean;
  readonly provider: TtsProviderName;
  readonly name: string;
  readonly voiceId: string;
  readonly voiceName: string;
  readonly language: string;
  readonly encryptedApiKey: string;
  readonly stability: number | null;
  readonly similarity: number | null;
  readonly style: number | null;
}

export interface CreateTtsManifestInput {
  readonly userId: string;
  readonly chapterId: string;
  readonly connectionId: string;
  readonly language: string;
  readonly fallbackPolicy: TtsFallbackPolicyName;
  readonly now: Date;
}

export interface TtsGenerationConnection {
  readonly id: string;
  readonly encryptedApiKey: string;
  readonly provider: TtsProviderName;
  readonly voiceId: string;
  readonly language: string;
  readonly stability: number | null;
  readonly similarity: number | null;
  readonly style: number | null;
}

export interface TtsGenerationSegment {
  readonly id: string;
  readonly blockText: string;
  readonly blockIndex: number;
  readonly characterCount: number;
  readonly status: 'PENDING' | 'GENERATED' | 'FAILED';
}

export interface TtsGenerationWork {
  readonly manifestId: string;
  readonly userId: string;
  readonly chapterId: string;
  readonly characterCount: number;
  readonly estimatedCostMicros: bigint | null;
  readonly fallbackPolicy: TtsFallbackPolicyName;
  readonly connection: TtsGenerationConnection;
  readonly systemFallback: TtsGenerationConnection | null;
  readonly segments: readonly TtsGenerationSegment[];
}

export interface CompleteTtsSegmentInput {
  readonly segmentId: string;
  readonly audioPublicId: string;
  readonly durationMs: number;
  readonly sizeBytes: bigint;
  readonly format: string;
  readonly wordTimings: unknown;
  readonly usedSystemFallback: boolean;
}

export interface TtsPersistencePort {
  createConnection(input: CreateTtsConnectionInput): Promise<TtsConnectionDto>;
  listConnections(userId: string): Promise<readonly TtsConnectionDto[]>;
  deleteConnection(
    userId: string,
    connectionId: string,
    system: boolean,
  ): Promise<void>;
  createOrGetManifest(
    input: CreateTtsManifestInput,
  ): Promise<{ readonly manifest: TtsManifestDto; readonly created: boolean }>;
  setManifestJobId(
    userId: string,
    manifestId: string,
    jobId: string,
  ): Promise<void>;
  getManifest(
    userId: string,
    manifestId: string,
    now: Date,
  ): Promise<TtsManifestDto>;
  getQuota(userId: string, now: Date): Promise<TtsQuotaDto>;
  claimGeneration(
    manifestId: string,
    now: Date,
  ): Promise<TtsGenerationWork | null>;
  completeSegment(input: CompleteTtsSegmentInput): Promise<void>;
  failSegment(segmentId: string, reason: string): Promise<void>;
  completeManifest(manifestId: string, now: Date): Promise<void>;
  failManifest(manifestId: string, reason: string, now: Date): Promise<void>;
}
