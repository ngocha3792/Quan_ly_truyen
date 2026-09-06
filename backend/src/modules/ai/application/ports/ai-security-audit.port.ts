import type { AiAuthType, AiProtocol } from '../../domain/enums';
import type {
  AiCapabilities,
  AiCapabilityName,
} from './ai-protocol-adapter.port';

export const AI_SECURITY_AUDIT_PORT = Symbol.for('modules.ai.security-audit');

export type AiSecurityAuditAction =
  | 'ai.connection.created'
  | 'ai.connection.updated'
  | 'ai.connection.deleted'
  | 'ai.connection.tested'
  | 'ai.capabilities.probed';

export interface AiSecurityAuditMetadata {
  readonly protocol?: AiProtocol;
  readonly authType?: AiAuthType;
  readonly vendorHint?: string | null;
  readonly model?: string;
  readonly changedFields?: readonly string[];
  readonly capabilities?: AiCapabilities;
  readonly failedChecks?: readonly AiCapabilityName[];
}

export interface WriteAiSecurityAuditInput {
  readonly actorUserId: string | null;
  readonly ownerUserId: string | null;
  readonly action: AiSecurityAuditAction;
  readonly connectionId?: string;
  readonly outcome: 'SUCCESS' | 'FAILURE';
  readonly metadata?: AiSecurityAuditMetadata;
}

export interface AiSecurityAuditPort {
  record(input: WriteAiSecurityAuditInput): Promise<void>;
}
