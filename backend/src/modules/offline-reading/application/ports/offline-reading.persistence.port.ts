import type {
  OfflinePackageManifestDto,
  OfflinePackageSummaryDto,
  OfflineQuotaDto,
  TouchOfflinePackageResultDto,
} from '../dto';

export const OFFLINE_READING_PERSISTENCE_PORT = Symbol.for(
  'quan-ly-truyen.modules.offline-reading-persistence',
);

export interface CreateOfflinePackageInput {
  readonly userId: string;
  readonly sessionId: string;
  readonly name: string;
  readonly description: string | null;
  readonly chapterIds: readonly string[];
  readonly now: Date;
}

export interface OwnedOfflinePackageInput {
  readonly userId: string;
  readonly packageId: string;
  readonly now: Date;
}

export interface SessionBoundOfflinePackageInput extends OwnedOfflinePackageInput {
  readonly sessionId: string;
}

export interface OfflineReadingPersistencePort {
  createPackage(
    input: CreateOfflinePackageInput,
  ): Promise<OfflinePackageSummaryDto>;
  listPackages(
    userId: string,
    now: Date,
  ): Promise<readonly OfflinePackageSummaryDto[]>;
  getQuota(userId: string, now: Date): Promise<OfflineQuotaDto>;
  getManifest(
    input: SessionBoundOfflinePackageInput,
  ): Promise<OfflinePackageManifestDto>;
  deletePackage(input: OwnedOfflinePackageInput): Promise<void>;
  touchPackage(
    input: SessionBoundOfflinePackageInput,
  ): Promise<TouchOfflinePackageResultDto>;
}
