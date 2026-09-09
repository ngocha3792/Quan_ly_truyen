import { Inject, Injectable } from '@nestjs/common';

import { AuthenticationRequiredException } from '@/common/exceptions';
import { isUuidV4 } from '@/common/utils';

import type {
  TtsConnectionDto,
  TtsFallbackPolicyName,
  TtsManifestDto,
  TtsProviderName,
  TtsQuotaDto,
} from './dto';
import {
  TTS_CREDENTIAL_VAULT_PORT,
  TTS_GENERATION_QUEUE_PORT,
  TTS_PERSISTENCE_PORT,
  TTS_PROVIDER_PORT,
  type TtsCredentialVaultPort,
  type TtsGenerationQueuePort,
  type TtsPersistencePort,
  type TtsProviderPort,
} from './ports';
import { normalizeTtsLanguage, TtsInvalidInputException } from '../domain';

export interface CreateTtsConnectionCommand {
  readonly actorUserId: string;
  readonly system: boolean;
  readonly provider: TtsProviderName;
  readonly name: string;
  readonly voiceId: string;
  readonly voiceName: string;
  readonly language: string;
  readonly apiKey: string;
  readonly stability?: number;
  readonly similarity?: number;
  readonly style?: number;
}

@Injectable()
export class CreateTtsConnectionCommandHandler {
  constructor(
    @Inject(TTS_PERSISTENCE_PORT)
    private readonly persistence: TtsPersistencePort,
    @Inject(TTS_CREDENTIAL_VAULT_PORT)
    private readonly vault: TtsCredentialVaultPort,
    @Inject(TTS_PROVIDER_PORT) private readonly provider: TtsProviderPort,
  ) {}

  async execute(
    command: CreateTtsConnectionCommand,
  ): Promise<TtsConnectionDto> {
    const actorUserId = requireUserId(command.actorUserId);
    const apiKey = command.apiKey.trim();
    const voiceId = normalizeText(command.voiceId, 'voiceId', 255);
    if (command.provider !== this.provider.provider) {
      throw new TtsInvalidInputException(
        'Provider TTS chưa được hỗ trợ',
        'provider',
      );
    }
    if (!apiKey || apiKey.length > 2_048) {
      throw new TtsInvalidInputException('API key TTS không hợp lệ', 'apiKey');
    }
    if (!(await this.provider.validateVoice(apiKey, voiceId))) {
      throw new TtsInvalidInputException(
        'Voice ID không tồn tại ở provider',
        'voiceId',
      );
    }

    return this.persistence.createConnection({
      userId: command.system ? null : actorUserId,
      isSystem: command.system,
      provider: command.provider,
      name: normalizeText(command.name, 'name', 120),
      voiceId,
      voiceName: normalizeText(command.voiceName, 'voiceName', 120),
      language: normalizeTtsLanguage(command.language),
      encryptedApiKey: await this.vault.encrypt(apiKey),
      stability: normalizeStyle(command.stability, 'stability'),
      similarity: normalizeStyle(command.similarity, 'similarity'),
      style: normalizeStyle(command.style, 'style'),
    });
  }
}

@Injectable()
export class ListTtsConnectionsQueryHandler {
  constructor(
    @Inject(TTS_PERSISTENCE_PORT)
    private readonly persistence: TtsPersistencePort,
  ) {}
  execute(userId: string | undefined): Promise<readonly TtsConnectionDto[]> {
    return this.persistence.listConnections(requireUserId(userId));
  }
}

@Injectable()
export class DeleteTtsConnectionCommandHandler {
  constructor(
    @Inject(TTS_PERSISTENCE_PORT)
    private readonly persistence: TtsPersistencePort,
  ) {}
  execute(
    userId: string | undefined,
    connectionId: string,
    system = false,
  ): Promise<void> {
    return this.persistence.deleteConnection(
      requireUserId(userId),
      connectionId,
      system,
    );
  }
}

@Injectable()
export class GenerateTtsManifestCommandHandler {
  constructor(
    @Inject(TTS_PERSISTENCE_PORT)
    private readonly persistence: TtsPersistencePort,
    @Inject(TTS_GENERATION_QUEUE_PORT)
    private readonly queue: TtsGenerationQueuePort,
  ) {}

  async execute(input: {
    readonly userId: string | undefined;
    readonly chapterId: string;
    readonly connectionId: string;
    readonly language: string;
    readonly fallbackPolicy?: TtsFallbackPolicyName;
  }): Promise<TtsManifestDto> {
    const userId = requireUserId(input.userId);
    const result = await this.persistence.createOrGetManifest({
      userId,
      chapterId: input.chapterId,
      connectionId: input.connectionId,
      language: normalizeTtsLanguage(input.language),
      fallbackPolicy: input.fallbackPolicy ?? 'NONE',
      now: new Date(),
    });
    if (!result.created) return result.manifest;
    try {
      const jobId = await this.queue.enqueue(result.manifest.id);
      await this.persistence.setManifestJobId(
        userId,
        result.manifest.id,
        jobId,
      );
      return result.manifest;
    } catch (error) {
      await this.persistence.failManifest(
        result.manifest.id,
        'Không thể đưa yêu cầu TTS vào hàng đợi',
        new Date(),
      );
      throw error;
    }
  }
}

@Injectable()
export class GetTtsManifestQueryHandler {
  constructor(
    @Inject(TTS_PERSISTENCE_PORT)
    private readonly persistence: TtsPersistencePort,
  ) {}
  execute(
    userId: string | undefined,
    manifestId: string,
  ): Promise<TtsManifestDto> {
    return this.persistence.getManifest(
      requireUserId(userId),
      manifestId,
      new Date(),
    );
  }
}

@Injectable()
export class GetTtsQuotaQueryHandler {
  constructor(
    @Inject(TTS_PERSISTENCE_PORT)
    private readonly persistence: TtsPersistencePort,
  ) {}
  execute(userId: string | undefined): Promise<TtsQuotaDto> {
    return this.persistence.getQuota(requireUserId(userId), new Date());
  }
}

function requireUserId(value: string | undefined): string {
  if (!value || !isUuidV4(value)) {
    throw new AuthenticationRequiredException({
      code: 'TTS_AUTHENTICATION_REQUIRED',
      message: 'Bạn cần đăng nhập để dùng TTS provider',
    });
  }
  return value;
}

function normalizeText(value: string, field: string, maximum: number): string {
  const normalized = value.trim().replace(/\s+/gu, ' ');
  if (!normalized || normalized.length > maximum) {
    throw new TtsInvalidInputException(`${field} không hợp lệ`, field);
  }
  return normalized;
}

function normalizeStyle(
  value: number | undefined,
  field: string,
): number | null {
  if (value === undefined) return null;
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new TtsInvalidInputException(
      `${field} phải nằm trong khoảng 0 đến 1`,
      field,
    );
  }
  return value;
}
