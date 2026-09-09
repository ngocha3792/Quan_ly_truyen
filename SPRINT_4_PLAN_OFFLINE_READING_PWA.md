# SPRINT 4 — Offline Reading / PWA
**Timeline:** 8–12 ngày  
**Mục tiêu:** Cho phép đọc offline với quota management, entitlement snapshot và session lifecycle

---

## 🎯 ACCEPTANCE CRITERIA

✅ API riêng cho offline packages (không cache response chapter hiện tại)  
✅ Chỉ cho phép tải chapter miễn phí hoặc đã mua  
✅ IndexedDB lưu manifest, document blocks, media slices và progress chưa sync  
✅ Service Worker cache assets theo explicit manifest  
✅ Quota per user/device với LRU cleanup và TTL  
✅ Xóa cache khi logout, revoke session hoặc đổi account  
✅ Paid offline package có license expiry và entitlement snapshot  
✅ Nội dung offline không thể bảo vệ tuyệt đối (accepted limitation)  

---

## 📊 PHÂN TÍCH HIỆN TẠI

### Chapter Access System:

**Enum `ChapterAccessType`:**
- `FREE` - Miễn phí cho mọi người
- `PAID` - Cần mua
- `AUTHOR_ONLY` - Chỉ tác giả

**Model `ChapterEntitlement`:**
- `userId`, `chapterId`
- `status`: `ACTIVE` | `EXPIRED` | `REVOKED`
- `priceCredits`, `purchasedAt`, `expiresAt`

**Chapter Reader DTO:**
```typescript
PublicUnlockedChapterReaderDto {
  access: {
    state: 'FREE' | 'ENTITLED' | 'BYPASS';
    priceCredits: string | null;
  }
  content: string;
  contentDocument?: ChapterContentDocument;
}

PublicLockedChapterReaderDto {
  access: {
    state: 'LOCKED';
    priceCredits: string;
  }
  previewContent: string;
}
```

### Auth Session System:

**Model `Session`:**
- JWT refresh token family
- `userId`, `familyId`, `deviceFingerprint`
- `isTrusted`, `expiresAt`, `revokedAt`

**Session lifecycle events:**
- Login → create session
- Logout → revoke session
- Logout all → revoke family
- Token refresh → increment version

### Thiếu:

❌ Offline package model  
❌ API tạo/list/delete offline packages  
❌ Quota tracking per user/device  
❌ Service Worker infrastructure  
❌ IndexedDB schema & sync  
❌ Session invalidation hooks  

---

## 🏗️ TECHNICAL DESIGN

### 1. Database Schema Changes

**New tables:**

```prisma
enum OfflinePackageStatus {
  PREPARING  @map("preparing")   // Being created
  READY      @map("ready")       // Ready for download
  EXPIRED    @map("expired")     // License expired
  REVOKED    @map("revoked")     // User revoked or session ended
  
  @@map("offline_package_status")
}

model OfflinePackage {
  id            String                @id @default(uuid()) @db.Uuid
  userId        String                @map("user_id") @db.Uuid
  sessionId     String?               @map("session_id") @db.Uuid
  deviceId      String?               @map("device_id") @db.VarChar(255)
  
  // Package metadata
  name          String                @db.VarChar(255)
  description   String?               @db.Text
  status        OfflinePackageStatus  @default(PREPARING)
  
  // Size and quota
  totalSize     BigInt                @default(0) @map("total_size")     // Bytes
  chapterCount  Int                   @default(0) @map("chapter_count")
  
  // License and expiry
  licenseExpiresAt  DateTime?         @map("license_expires_at") @db.Timestamptz(3)
  lastAccessedAt    DateTime          @default(now()) @map("last_accessed_at") @db.Timestamptz(3)
  
  // Cleanup
  autoDeleteAt  DateTime?             @map("auto_delete_at") @db.Timestamptz(3)
  revokedAt     DateTime?             @map("revoked_at") @db.Timestamptz(3)
  revokedReason String?               @map("revoked_reason") @db.VarChar(500)
  
  createdAt     DateTime              @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt     DateTime              @updatedAt @map("updated_at") @db.Timestamptz(3)
  
  user          User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  session       Session?              @relation(fields: [sessionId], references: [id], onDelete: SetNull)
  chapters      OfflinePackageChapter[]
  
  @@index([userId, status, lastAccessedAt])
  @@index([userId, deviceId])
  @@index([sessionId])
  @@index([status, autoDeleteAt])
  @@index([licenseExpiresAt])
  @@map("offline_packages")
}

model OfflinePackageChapter {
  packageId     String   @map("package_id") @db.Uuid
  chapterId     String   @map("chapter_id") @db.Uuid
  
  // Entitlement snapshot
  accessType    ChapterAccessType    @map("access_type")
  accessState   String               @map("access_state") @db.VarChar(20)  // FREE|ENTITLED|BYPASS
  priceCredits  Decimal?             @map("price_credits") @db.Decimal(10, 2)
  
  // Content snapshot metadata
  chapterVersion        Int         @map("chapter_version")
  documentSchemaVersion Int?        @map("document_schema_version")
  contentSize           BigInt      @default(0) @map("content_size")
  mediaCount            Int         @default(0) @map("media_count")
  
  // Entitlement verification
  entitlementId         String?     @map("entitlement_id") @db.Uuid
  entitlementExpiresAt  DateTime?   @map("entitlement_expires_at") @db.Timestamptz(3)
  
  addedAt       DateTime @default(now()) @map("added_at") @db.Timestamptz(3)
  
  package       OfflinePackage @relation(fields: [packageId], references: [id], onDelete: Cascade)
  chapter       Chapter        @relation(fields: [chapterId], references: [id], onDelete: Cascade)
  entitlement   ChapterEntitlement? @relation(fields: [entitlementId], references: [id], onDelete: SetNull)
  
  @@id([packageId, chapterId])
  @@index([chapterId])
  @@map("offline_package_chapters")
}

model OfflineQuota {
  userId             String   @id @map("user_id") @db.Uuid
  
  // Quota limits
  maxPackages        Int      @default(5) @map("max_packages")
  maxTotalSizeBytes  BigInt   @default(524288000) @map("max_total_size_bytes")  // 500MB default
  maxChaptersPerPackage Int   @default(50) @map("max_chapters_per_package")
  
  // Current usage
  currentPackages    Int      @default(0) @map("current_packages")
  currentSizeBytes   BigInt   @default(0) @map("current_size_bytes")
  
  updatedAt  DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("offline_quotas")
}

// Add relations to existing models
model User {
  // ... existing fields ...
  offlinePackages OfflinePackage[]
  offlineQuota    OfflineQuota?
}

model Session {
  // ... existing fields ...
  offlinePackages OfflinePackage[]
}

model Chapter {
  // ... existing fields ...
  offlinePackageChapters OfflinePackageChapter[]
}

model ChapterEntitlement {
  // ... existing fields ...
  offlinePackageChapters OfflinePackageChapter[]
}
```

**Migration checklist:**
- [ ] Create enums
- [ ] Create tables with proper indexes
- [ ] Add foreign keys and cascades
- [ ] Initialize OfflineQuota for existing users (migration script)

---

### 2. Backend Implementation

#### Phase 2.1: Domain Logic - Offline Package Management (2 ngày)

**Task 2.1.1: Domain Policies**

**File:** `backend/src/modules/offline-reading/domain/policies/offline-package.policy.ts`

```typescript
export class OfflinePackagePolicy {
  static readonly DEFAULT_MAX_PACKAGES = 5;
  static readonly DEFAULT_MAX_SIZE_BYTES = 524_288_000; // 500MB
  static readonly DEFAULT_MAX_CHAPTERS_PER_PACKAGE = 50;
  static readonly DEFAULT_LICENSE_DURATION_DAYS = 30;
  static readonly MAX_PACKAGE_NAME_LENGTH = 255;
  
  static canCreatePackage(
    currentPackages: number,
    maxPackages: number,
    currentSize: bigint,
    maxSize: bigint,
    estimatedNewSize: bigint,
  ): { allowed: boolean; reason?: string } {
    if (currentPackages >= maxPackages) {
      return {
        allowed: false,
        reason: `Đã đạt giới hạn ${maxPackages} gói offline`,
      };
    }
    
    if (currentSize + estimatedNewSize > maxSize) {
      return {
        allowed: false,
        reason: `Vượt quá dung lượng cho phép (${formatBytes(maxSize)})`,
      };
    }
    
    return { allowed: true };
  }
  
  static calculateLicenseExpiry(
    chapters: Array<{ accessType: string; entitlementExpiresAt?: Date }>,
  ): Date | null {
    // Find earliest expiry among paid chapters
    let earliestExpiry: Date | null = null;
    
    for (const chapter of chapters) {
      if (chapter.accessType === 'PAID' && chapter.entitlementExpiresAt) {
        if (!earliestExpiry || chapter.entitlementExpiresAt < earliestExpiry) {
          earliestExpiry = chapter.entitlementExpiresAt;
        }
      }
    }
    
    // If no paid chapters, set default 30-day expiry
    if (!earliestExpiry) {
      earliestExpiry = new Date();
      earliestExpiry.setDate(earliestExpiry.getDate() + this.DEFAULT_LICENSE_DURATION_DAYS);
    }
    
    return earliestExpiry;
  }
  
  static shouldAutoDelete(
    package: { lastAccessedAt: Date; status: string },
    inactivityDays: number = 90,
  ): boolean {
    if (package.status === 'REVOKED' || package.status === 'EXPIRED') {
      return true;
    }
    
    const daysSinceAccess = Math.floor(
      (Date.now() - package.lastAccessedAt.getTime()) / (1000 * 60 * 60 * 24),
    );
    
    return daysSinceAccess >= inactivityDays;
  }
}

function formatBytes(bytes: bigint): string {
  const mb = Number(bytes) / (1024 * 1024);
  return `${Math.round(mb)}MB`;
}
```

**Task 2.1.2: Entitlement Verification**

**File:** `backend/src/modules/offline-reading/domain/policies/offline-entitlement.policy.ts`

```typescript
export interface ChapterAccessCheck {
  chapterId: string;
  accessType: string;
  priceCredits?: string;
  entitlementStatus?: string;
  entitlementExpiresAt?: Date;
}

export interface AccessVerificationResult {
  allowed: boolean;
  accessState: 'FREE' | 'ENTITLED' | 'LOCKED';
  reason?: string;
}

export class OfflineEntitlementPolicy {
  /**
   * Verifies if a user can add a chapter to offline package.
   * CRITICAL: Must check entitlement server-side.
   */
  static verifyChapterAccess(
    chapter: ChapterAccessCheck,
  ): AccessVerificationResult {
    // Free chapters always allowed
    if (chapter.accessType === 'FREE') {
      return { allowed: true, accessState: 'FREE' };
    }
    
    // Author-only chapters not allowed offline
    if (chapter.accessType === 'AUTHOR_ONLY') {
      return {
        allowed: false,
        accessState: 'LOCKED',
        reason: 'Chương chỉ dành cho tác giả không thể tải offline',
      };
    }
    
    // Paid chapters require active entitlement
    if (chapter.accessType === 'PAID') {
      if (!chapter.entitlementStatus || chapter.entitlementStatus !== 'ACTIVE') {
        return {
          allowed: false,
          accessState: 'LOCKED',
          reason: 'Bạn chưa mua chương này',
        };
      }
      
      // Check expiry
      if (chapter.entitlementExpiresAt && chapter.entitlementExpiresAt < new Date()) {
        return {
          allowed: false,
          accessState: 'LOCKED',
          reason: 'Quyền truy cập đã hết hạn',
        };
      }
      
      return { allowed: true, accessState: 'ENTITLED' };
    }
    
    return {
      allowed: false,
      accessState: 'LOCKED',
      reason: 'Loại truy cập không hợp lệ',
    };
  }
}
```

**Files to create:**
- `backend/src/modules/offline-reading/domain/policies/offline-package.policy.ts`
- `backend/src/modules/offline-reading/domain/policies/offline-package.policy.spec.ts`
- `backend/src/modules/offline-reading/domain/policies/offline-entitlement.policy.ts`
- `backend/src/modules/offline-reading/domain/policies/offline-entitlement.policy.spec.ts`

---

#### Phase 2.2: Application Commands & Queries (3 ngày)

**Task 2.2.1: Create Offline Package Command**

**File:** `backend/src/modules/offline-reading/application/commands/create-offline-package/create-offline-package.command.ts`

```typescript
export class CreateOfflinePackageCommand {
  constructor(
    public readonly userId: string,
    public readonly sessionId: string,
    public readonly deviceId: string | null,
    public readonly name: string,
    public readonly description: string | null,
    public readonly chapterIds: readonly string[],
  ) {}
}
```

**File:** `backend/src/modules/offline-reading/application/commands/create-offline-package/create-offline-package.command-handler.ts`

```typescript
@Injectable()
export class CreateOfflinePackageCommandHandler {
  constructor(
    @Inject(OFFLINE_PACKAGE_PERSISTENCE_PORT)
    private readonly persistence: OfflinePackagePersistencePort,
    @Inject(CHAPTER_READER_PORT)
    private readonly chapterReader: ChapterReaderPort,
    @Inject(OFFLINE_QUOTA_PORT)
    private readonly quota: OfflineQuotaPort,
    private readonly logger: Logger,
  ) {}
  
  async execute(command: CreateOfflinePackageCommand): Promise<OfflinePackageDto> {
    // 1. Validate chapter limit
    if (command.chapterIds.length === 0) {
      throw new InvalidInputException('Package must contain at least one chapter');
    }
    
    if (command.chapterIds.length > OfflinePackagePolicy.DEFAULT_MAX_CHAPTERS_PER_PACKAGE) {
      throw new InvalidInputException(
        `Cannot exceed ${OfflinePackagePolicy.DEFAULT_MAX_CHAPTERS_PER_PACKAGE} chapters per package`
      );
    }
    
    // 2. Get user quota
    const userQuota = await this.quota.getOrCreateQuota(command.userId);
    
    // 3. Fetch and verify chapter access
    const chapters = await Promise.all(
      command.chapterIds.map(id => this.chapterReader.getChapterWithEntitlement(id, command.userId))
    );
    
    const verifiedChapters: OfflineChapterSnapshot[] = [];
    let estimatedSize = 0n;
    
    for (const chapter of chapters) {
      if (!chapter) {
        throw new ResourceNotFoundException('Chapter', 'one or more chapters not found');
      }
      
      // Verify access
      const accessCheck = OfflineEntitlementPolicy.verifyChapterAccess({
        chapterId: chapter.id,
        accessType: chapter.accessType,
        priceCredits: chapter.priceCredits?.toString(),
        entitlementStatus: chapter.entitlementStatus,
        entitlementExpiresAt: chapter.entitlementExpiresAt,
      });
      
      if (!accessCheck.allowed) {
        throw new InvalidInputException(
          `Cannot add chapter ${chapter.id}: ${accessCheck.reason}`
        );
      }
      
      // Estimate size
      const contentSize = BigInt(chapter.content?.length || 0);
      const mediaSize = BigInt(chapter.mediaAssets?.reduce((sum, m) => sum + (m.sizeBytes || 0), 0) || 0);
      const chapterSize = contentSize + mediaSize;
      
      estimatedSize += chapterSize;
      
      verifiedChapters.push({
        chapterId: chapter.id,
        chapterVersion: chapter.version,
        accessType: chapter.accessType,
        accessState: accessCheck.accessState,
        priceCredits: chapter.priceCredits,
        contentSize: chapterSize,
        mediaCount: chapter.mediaAssets?.length || 0,
        entitlementId: chapter.entitlementId,
        entitlementExpiresAt: chapter.entitlementExpiresAt,
        documentSchemaVersion: chapter.documentSchemaVersion,
      });
    }
    
    // 4. Check quota
    const quotaCheck = OfflinePackagePolicy.canCreatePackage(
      userQuota.currentPackages,
      userQuota.maxPackages,
      userQuota.currentSizeBytes,
      userQuota.maxTotalSizeBytes,
      estimatedSize,
    );
    
    if (!quotaCheck.allowed) {
      throw new QuotaExceededException(quotaCheck.reason!);
    }
    
    // 5. Calculate license expiry
    const licenseExpiresAt = OfflinePackagePolicy.calculateLicenseExpiry(
      verifiedChapters.map(c => ({
        accessType: c.accessType,
        entitlementExpiresAt: c.entitlementExpiresAt,
      }))
    );
    
    // 6. Create package
    const packageDto = await this.persistence.createPackage({
      userId: command.userId,
      sessionId: command.sessionId,
      deviceId: command.deviceId,
      name: command.name,
      description: command.description,
      chapters: verifiedChapters,
      totalSize: estimatedSize,
      licenseExpiresAt,
    });
    
    // 7. Update quota
    await this.quota.incrementUsage(
      command.userId,
      1, // package count
      estimatedSize,
    );
    
    this.logger.log({
      message: 'Offline package created',
      packageId: packageDto.id,
      userId: command.userId,
      chapterCount: verifiedChapters.length,
      totalSize: estimatedSize.toString(),
    });
    
    return packageDto;
  }
}
```

**Task 2.2.2: Get Package Manifest Query**

**File:** `backend/src/modules/offline-reading/application/queries/get-package-manifest/get-package-manifest.query-handler.ts`

```typescript
@Injectable()
export class GetPackageManifestQueryHandler {
  constructor(
    @Inject(OFFLINE_PACKAGE_PERSISTENCE_PORT)
    private readonly persistence: OfflinePackagePersistencePort,
    @Inject(CHAPTER_READER_PORT)
    private readonly chapterReader: ChapterReaderPort,
    @Inject(MEDIA_URL_PORT)
    private readonly mediaUrl: MediaUrlPort,
  ) {}
  
  async execute(query: GetPackageManifestQuery): Promise<OfflinePackageManifestDto> {
    // 1. Get package
    const pkg = await this.persistence.findPackageById(query.packageId);
    
    if (!pkg) {
      throw new ResourceNotFoundException('OfflinePackage', query.packageId);
    }
    
    // 2. Verify ownership
    if (pkg.userId !== query.userId) {
      throw new AccessDeniedException('You do not own this package');
    }
    
    // 3. Check status
    if (pkg.status === 'EXPIRED') {
      throw new InvalidStateException('Package license has expired');
    }
    
    if (pkg.status === 'REVOKED') {
      throw new InvalidStateException('Package has been revoked');
    }
    
    // 4. Update last accessed
    await this.persistence.updateLastAccessed(query.packageId);
    
    // 5. Build manifest with content & media URLs
    const chapters = await Promise.all(
      pkg.chapters.map(async (pkgChapter) => {
        const chapter = await this.chapterReader.getChapterForOffline(
          pkgChapter.chapterId,
          query.userId,
        );
        
        if (!chapter) {
          // Chapter deleted, skip
          return null;
        }
        
        // Build media URLs (signed if needed)
        const media = chapter.mediaAssets?.map(asset => ({
          id: asset.id,
          url: this.mediaUrl.build({
            publicId: asset.publicId,
            preset: 'chapterImage',
            requiresSigning: pkgChapter.accessState === 'ENTITLED',
          }),
          width: asset.width,
          height: asset.height,
          format: asset.format,
          sizeBytes: asset.sizeBytes,
        })) || [];
        
        return {
          chapterId: chapter.id,
          storyId: chapter.storyId,
          number: chapter.number,
          title: chapter.title,
          slug: chapter.slug,
          version: chapter.version,
          
          // Content
          content: chapter.content,
          contentFormat: chapter.contentFormat,
          contentDocument: chapter.contentDocument,
          documentSchemaVersion: chapter.documentSchemaVersion,
          
          // Access info
          accessState: pkgChapter.accessState,
          
          // Media
          media,
          
          // Metadata
          wordCount: chapter.wordCount,
          publishedAt: chapter.publishedAt,
          snapshotAt: pkgChapter.addedAt,
        };
      })
    );
    
    return {
      packageId: pkg.id,
      name: pkg.name,
      description: pkg.description,
      status: pkg.status,
      licenseExpiresAt: pkg.licenseExpiresAt,
      createdAt: pkg.createdAt,
      chapters: chapters.filter(c => c !== null),
      totalSize: pkg.totalSize,
      chapterCount: pkg.chapterCount,
    };
  }
}
```

**Task 2.2.3: Delete Package Command**

**File:** `backend/src/modules/offline-reading/application/commands/delete-offline-package/delete-offline-package.command-handler.ts`

```typescript
@Injectable()
export class DeleteOfflinePackageCommandHandler {
  constructor(
    @Inject(OFFLINE_PACKAGE_PERSISTENCE_PORT)
    private readonly persistence: OfflinePackagePersistencePort,
    @Inject(OFFLINE_QUOTA_PORT)
    private readonly quota: OfflineQuotaPort,
  ) {}
  
  async execute(command: DeleteOfflinePackageCommand): Promise<void> {
    // 1. Get package
    const pkg = await this.persistence.findPackageById(command.packageId);
    
    if (!pkg) {
      throw new ResourceNotFoundException('OfflinePackage', command.packageId);
    }
    
    // 2. Verify ownership
    if (pkg.userId !== command.userId) {
      throw new AccessDeniedException('You do not own this package');
    }
    
    // 3. Delete package
    await this.persistence.deletePackage(command.packageId);
    
    // 4. Update quota
    await this.quota.decrementUsage(
      command.userId,
      1,
      pkg.totalSize,
    );
  }
}
```

**Task 2.2.4: Session Revocation Hook**

**File:** `backend/src/modules/offline-reading/application/listeners/session-revoked.listener.ts`

```typescript
@Injectable()
export class SessionRevokedListener implements OnEvent {
  constructor(
    @Inject(OFFLINE_PACKAGE_PERSISTENCE_PORT)
    private readonly persistence: OfflinePackagePersistencePort,
    private readonly logger: Logger,
  ) {}
  
  @OnEvent('auth.session.revoked')
  async handleSessionRevoked(event: SessionRevokedEvent): Promise<void> {
    try {
      // Revoke all offline packages for this session
      const result = await this.persistence.revokePackagesBySession(
        event.sessionId,
        'Session revoked',
      );
      
      this.logger.log({
        message: 'Offline packages revoked due to session revocation',
        sessionId: event.sessionId,
        packagesRevoked: result.count,
      });
    } catch (error) {
      this.logger.error({
        message: 'Failed to revoke offline packages',
        sessionId: event.sessionId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }
  
  @OnEvent('auth.logout.all')
  async handleLogoutAll(event: LogoutAllEvent): Promise<void> {
    try {
      // Revoke all offline packages for this user
      const result = await this.persistence.revokePackagesByUser(
        event.userId,
        'User logged out from all devices',
      );
      
      this.logger.log({
        message: 'All offline packages revoked due to logout all',
        userId: event.userId,
        packagesRevoked: result.count,
      });
    } catch (error) {
      this.logger.error({
        message: 'Failed to revoke all offline packages',
        userId: event.userId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }
}
```

**Files to create:**
- `backend/src/modules/offline-reading/application/commands/create-offline-package/*`
- `backend/src/modules/offline-reading/application/commands/delete-offline-package/*`
- `backend/src/modules/offline-reading/application/queries/get-package-manifest/*`
- `backend/src/modules/offline-reading/application/queries/list-user-packages/*`
- `backend/src/modules/offline-reading/application/listeners/session-revoked.listener.ts`
- `backend/src/modules/offline-reading/application/ports/*`
- `backend/src/modules/offline-reading/domain/exceptions/*`

**Tests:**
- Unit: Command handlers with mocked dependencies
- Integration: Create package, verify quota updated
- Security: Cannot create package for chapters without entitlement
- Lifecycle: Session revoked → packages revoked

---

#### Phase 2.3: Infrastructure & HTTP API (2 ngày)

**Task 2.3.1: Prisma Persistence**

**File:** `backend/src/modules/offline-reading/infrastructure/persistence/prisma-offline-package.persistence.ts`

```typescript
@Injectable()
export class PrismaOfflinePackagePersistence implements OfflinePackagePersistencePort {
  constructor(private readonly prisma: PrismaService) {}
  
  async createPackage(input: CreatePackageInput): Promise<OfflinePackageDto> {
    const result = await this.prisma.$transaction(async (tx) => {
      // Create package
      const pkg = await tx.offlinePackage.create({
        data: {
          userId: input.userId,
          sessionId: input.sessionId,
          deviceId: input.deviceId,
          name: input.name,
          description: input.description,
          status: 'READY',
          totalSize: input.totalSize,
          chapterCount: input.chapters.length,
          licenseExpiresAt: input.licenseExpiresAt,
        },
      });
      
      // Add chapters
      await tx.offlinePackageChapter.createMany({
        data: input.chapters.map(c => ({
          packageId: pkg.id,
          chapterId: c.chapterId,
          accessType: c.accessType,
          accessState: c.accessState,
          priceCredits: c.priceCredits,
          chapterVersion: c.chapterVersion,
          documentSchemaVersion: c.documentSchemaVersion,
          contentSize: c.contentSize,
          mediaCount: c.mediaCount,
          entitlementId: c.entitlementId,
          entitlementExpiresAt: c.entitlementExpiresAt,
        })),
      });
      
      return pkg;
    });
    
    return mapToOfflinePackageDto(result);
  }
  
  async revokePackagesBySession(
    sessionId: string,
    reason: string,
  ): Promise<{ count: number }> {
    const result = await this.prisma.offlinePackage.updateMany({
      where: {
        sessionId,
        status: { notIn: ['REVOKED', 'EXPIRED'] },
      },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
        revokedReason: reason,
      },
    });
    
    return { count: result.count };
  }
  
  async revokePackagesByUser(
    userId: string,
    reason: string,
  ): Promise<{ count: number }> {
    const result = await this.prisma.offlinePackage.updateMany({
      where: {
        userId,
        status: { notIn: ['REVOKED', 'EXPIRED'] },
      },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
        revokedReason: reason,
      },
    });
    
    return { count: result.count };
  }
}
```

**Task 2.3.2: HTTP Controllers**

**File:** `backend/src/modules/offline-reading/presentation/http/controllers/offline-packages.controller.ts`

```typescript
@Controller('offline-packages')
@ApiTags('Offline Reading')
export class OfflinePackagesController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}
  
  @Post()
  @ApiOperation({ summary: 'Create offline package' })
  @ApiResponse({ status: 201, type: OfflinePackageResponse })
  async createPackage(
    @Body() dto: CreateOfflinePackageRequest,
    @CurrentUserId() userId: string,
    @CurrentSessionId() sessionId: string,
    @Req() request: Request,
  ): Promise<OfflinePackageResponse> {
    const deviceId = request.headers['x-device-id'] as string | undefined;
    
    const command = new CreateOfflinePackageCommand(
      userId,
      sessionId,
      deviceId || null,
      dto.name,
      dto.description || null,
      dto.chapterIds,
    );
    
    const result = await this.commandBus.execute(command);
    return OfflinePackageResponse.from(result);
  }
  
  @Get()
  @ApiOperation({ summary: 'List user offline packages' })
  @ApiResponse({ status: 200, type: [OfflinePackageResponse] })
  async listPackages(
    @CurrentUserId() userId: string,
  ): Promise<OfflinePackageResponse[]> {
    const query = new ListUserPackagesQuery(userId);
    const result = await this.queryBus.execute(query);
    return result.map(OfflinePackageResponse.from);
  }
  
  @Get(':id/manifest')
  @ApiOperation({ summary: 'Get package manifest with full content' })
  @ApiResponse({ status: 200, type: OfflinePackageManifestResponse })
  async getManifest(
    @Param('id') packageId: string,
    @CurrentUserId() userId: string,
  ): Promise<OfflinePackageManifestResponse> {
    const query = new GetPackageManifestQuery(packageId, userId);
    const result = await this.queryBus.execute(query);
    return OfflinePackageManifestResponse.from(result);
  }
  
  @Delete(':id')
  @ApiOperation({ summary: 'Delete offline package' })
  @ApiResponse({ status: 204 })
  @HttpCode(204)
  async deletePackage(
    @Param('id') packageId: string,
    @CurrentUserId() userId: string,
  ): Promise<void> {
    const command = new DeleteOfflinePackageCommand(packageId, userId);
    await this.commandBus.execute(command);
  }
}
```

**Files to create:**
- `backend/src/modules/offline-reading/infrastructure/persistence/prisma-offline-package.persistence.ts`
- `backend/src/modules/offline-reading/infrastructure/quota/prisma-offline-quota.adapter.ts`
- `backend/src/modules/offline-reading/presentation/http/controllers/offline-packages.controller.ts`
- `backend/src/modules/offline-reading/presentation/http/requests/*`
- `backend/src/modules/offline-reading/presentation/http/responses/*`
- `backend/src/modules/offline-reading/offline-reading.module.ts`

**Tests:**
- E2E: POST /offline-packages → created
- E2E: GET /offline-packages/:id/manifest → returns content
- E2E: DELETE /offline-packages/:id → deleted, quota updated
- Security: Cannot access other user's packages

---

### 3. Frontend Implementation - PWA Infrastructure (4-5 ngày)

#### Phase 3.1: Service Worker Setup (1 ngày)

**Task 3.1.1: Create Service Worker**

**File:** `frontend/src/sw.ts`

```typescript
/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const OFFLINE_MANIFEST_CACHE = `offline-manifest-${CACHE_VERSION}`;

// Static assets to always cache
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/styles.css',
  // Add other critical assets
];

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter(name => !name.startsWith(`static-${CACHE_VERSION}`) && !name.startsWith(`offline-manifest-${CACHE_VERSION}`))
          .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - only cache explicit manifest assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Don't cache API calls (except manifest)
  if (url.pathname.startsWith('/api/')) {
    // Allow manifest endpoint
    if (url.pathname.match(/\/offline-packages\/[^/]+\/manifest$/)) {
      event.respondWith(fetchAndCacheManifest(event.request));
      return;
    }
    
    // All other API calls bypass cache
    event.respondWith(fetch(event.request));
    return;
  }
  
  // Static assets from cache
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

async function fetchAndCacheManifest(request: Request): Promise<Response> {
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      const cache = await caches.open(OFFLINE_MANIFEST_CACHE);
      await cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Try cache
    const cached = await caches.match(request);
    if (cached) return cached;
    
    throw error;
  }
}

// Message handler for cache management
self.addEventListener('message', (event) => {
  if (event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map(name => caches.delete(name))
        );
      }).then(() => {
        event.ports[0].postMessage({ success: true });
      })
    );
  }
  
  if (event.data.type === 'CACHE_MANIFEST_ASSETS') {
    event.waitUntil(
      cacheManifestAssets(event.data.assets).then(() => {
        event.ports[0].postMessage({ success: true });
      })
    );
  }
});

async function cacheManifestAssets(assets: string[]): Promise<void> {
  const cache = await caches.open(OFFLINE_MANIFEST_CACHE);
  await cache.addAll(assets);
}
```

**Task 3.1.2: Register Service Worker**

**File:** `frontend/src/app/core/pwa/service-worker-registration.service.ts`

```typescript
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class ServiceWorkerRegistrationService {
  private platformId = inject(PLATFORM_ID);
  private registration: ServiceWorkerRegistration | null = null;
  
  async register(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Worker not supported');
      return;
    }
    
    try {
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });
      
      console.log('Service Worker registered', this.registration.scope);
      
      // Listen for updates
      this.registration.addEventListener('updatefound', () => {
        const newWorker = this.registration!.installing;
        
        newWorker?.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version available
            console.log('New Service Worker available');
          }
        });
      });
    } catch (error) {
      console.error('Service Worker registration failed', error);
    }
  }
  
  async clearCache(): Promise<void> {
    if (!this.registration) return;
    
    const messageChannel = new MessageChannel();
    
    return new Promise((resolve, reject) => {
      messageChannel.port1.onmessage = (event) => {
        if (event.data.success) {
          resolve();
        } else {
          reject(new Error('Failed to clear cache'));
        }
      };
      
      this.registration!.active?.postMessage(
        { type: 'CLEAR_CACHE' },
        [messageChannel.port2]
      );
      
      // Timeout fallback
      setTimeout(() => reject(new Error('Cache clear timeout')), 5000);
    });
  }
  
  async cacheManifestAssets(assets: string[]): Promise<void> {
    if (!this.registration) return;
    
    const messageChannel = new MessageChannel();
    
    return new Promise((resolve, reject) => {
      messageChannel.port1.onmessage = (event) => {
        if (event.data.success) {
          resolve();
        } else {
          reject(new Error('Failed to cache assets'));
        }
      };
      
      this.registration!.active?.postMessage(
        { type: 'CACHE_MANIFEST_ASSETS', assets },
        [messageChannel.port2]
      );
      
      setTimeout(() => reject(new Error('Cache timeout')), 30000);
    });
  }
}
```

**Task 3.1.3: PWA Manifest**

**File:** `frontend/public/manifest.json`

```json
{
  "name": "TruyenHub",
  "short_name": "TruyenHub",
  "description": "Đọc truyện online và offline",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#ff9800",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icons/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-96x96.png",
      "sizes": "96x96",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-128x128.png",
      "sizes": "128x128",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-144x144.png",
      "sizes": "144x144",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-152x152.png",
      "sizes": "152x152",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-384x384.png",
      "sizes": "384x384",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

**Files to create:**
- `frontend/src/sw.ts`
- `frontend/src/app/core/pwa/service-worker-registration.service.ts`
- `frontend/public/manifest.json`
- `frontend/public/icons/` (icon assets)

---

#### Phase 3.2: IndexedDB Storage (2 ngày)

**Task 3.2.1: IndexedDB Schema**

**File:** `frontend/src/app/core/offline/offline-db.service.ts`

```typescript
import { Injectable } from '@angular/core';
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface OfflineDBSchema extends DBSchema {
  packages: {
    key: string;
    value: OfflinePackageRecord;
    indexes: { 'by-status': string };
  };
  chapters: {
    key: string; // chapterId
    value: OfflineChapterRecord;
    indexes: { 'by-package': string };
  };
  media: {
    key: string; // mediaId
    value: OfflineMediaRecord;
    indexes: { 'by-chapter': string };
  };
  progress: {
    key: string; // chapterId
    value: OfflineProgressRecord;
    indexes: { 'synced': number };
  };
}

export interface OfflinePackageRecord {
  id: string;
  name: string;
  description?: string;
  status: string;
  licenseExpiresAt?: string;
  chapterIds: string[];
  totalSize: number;
  downloadedAt: string;
  lastAccessedAt: string;
}

export interface OfflineChapterRecord {
  id: string;
  packageId: string;
  storyId: string;
  number: number;
  title: string;
  slug: string;
  version: number;
  content: string;
  contentFormat: string;
  contentDocument?: any;
  documentSchemaVersion?: number;
  accessState: string;
  mediaIds: string[];
  wordCount: number;
  publishedAt: string;
  snapshotAt: string;
}

export interface OfflineMediaRecord {
  id: string;
  chapterId: string;
  url: string;
  blob?: Blob;
  width: number;
  height: number;
  format: string;
  sizeBytes: number;
}

export interface OfflineProgressRecord {
  chapterId: string;
  position: number;
  progressPercent: number;
  lastReadAt: string;
  synced: boolean;
}

@Injectable({ providedIn: 'root' })
export class OfflineDBService {
  private db: IDBPDatabase<OfflineDBSchema> | null = null;
  
  async init(): Promise<void> {
    this.db = await openDB<OfflineDBSchema>('truyenhub-offline', 1, {
      upgrade(db) {
        // Packages store
        const packagesStore = db.createObjectStore('packages', { keyPath: 'id' });
        packagesStore.createIndex('by-status', 'status');
        
        // Chapters store
        const chaptersStore = db.createObjectStore('chapters', { keyPath: 'id' });
        chaptersStore.createIndex('by-package', 'packageId');
        
        // Media store
        const mediaStore = db.createObjectStore('media', { keyPath: 'id' });
        mediaStore.createIndex('by-chapter', 'chapterId');
        
        // Progress store
        const progressStore = db.createObjectStore('progress', { keyPath: 'chapterId' });
        progressStore.createIndex('synced', 'synced');
      },
    });
  }
  
  // Package operations
  async savePackage(pkg: OfflinePackageRecord): Promise<void> {
    await this.db!.put('packages', pkg);
  }
  
  async getPackage(id: string): Promise<OfflinePackageRecord | undefined> {
    return this.db!.get('packages', id);
  }
  
  async listPackages(): Promise<OfflinePackageRecord[]> {
    return this.db!.getAll('packages');
  }
  
  async deletePackage(id: string): Promise<void> {
    const tx = this.db!.transaction(['packages', 'chapters', 'media'], 'readwrite');
    
    // Get chapters for this package
    const chapters = await tx.objectStore('chapters').index('by-package').getAll(id);
    
    // Delete package
    await tx.objectStore('packages').delete(id);
    
    // Delete chapters and their media
    for (const chapter of chapters) {
      await tx.objectStore('chapters').delete(chapter.id);
      
      const media = await tx.objectStore('media').index('by-chapter').getAll(chapter.id);
      for (const m of media) {
        await tx.objectStore('media').delete(m.id);
      }
    }
    
    await tx.done;
  }
  
  // Chapter operations
  async saveChapter(chapter: OfflineChapterRecord): Promise<void> {
    await this.db!.put('chapters', chapter);
  }
  
  async getChapter(id: string): Promise<OfflineChapterRecord | undefined> {
    return this.db!.get('chapters', id);
  }
  
  async listChaptersByPackage(packageId: string): Promise<OfflineChapterRecord[]> {
    return this.db!.getAllFromIndex('chapters', 'by-package', packageId);
  }
  
  // Media operations
  async saveMedia(media: OfflineMediaRecord): Promise<void> {
    await this.db!.put('media', media);
  }
  
  async getMedia(id: string): Promise<OfflineMediaRecord | undefined> {
    return this.db!.get('media', id);
  }
  
  // Progress operations
  async saveProgress(progress: OfflineProgressRecord): Promise<void> {
    await this.db!.put('progress', progress);
  }
  
  async getProgress(chapterId: string): Promise<OfflineProgressRecord | undefined> {
    return this.db!.get('progress', chapterId);
  }
  
  async getUnsyncedProgress(): Promise<OfflineProgressRecord[]> {
    return this.db!.getAllFromIndex('progress', 'synced', IDBKeyRange.only(0));
  }
  
  // Clear all data (on logout)
  async clearAll(): Promise<void> {
    const tx = this.db!.transaction(['packages', 'chapters', 'media', 'progress'], 'readwrite');
    await Promise.all([
      tx.objectStore('packages').clear(),
      tx.objectStore('chapters').clear(),
      tx.objectStore('media').clear(),
      tx.objectStore('progress').clear(),
    ]);
    await tx.done;
  }
  
  // Estimate storage usage
  async estimateUsage(): Promise<{ usage: number; quota: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage || 0,
        quota: estimate.quota || 0,
      };
    }
    return { usage: 0, quota: 0 };
  }
}
```

**Task 3.2.2: Offline Package Download Service**

**File:** `frontend/src/app/core/offline/offline-download.service.ts`

```typescript
@Injectable({ providedIn: 'root' })
export class OfflineDownloadService {
  private db = inject(OfflineDBService);
  private http = inject(HttpClient);
  private sw = inject(ServiceWorkerRegistrationService);
  
  async downloadPackage(packageId: string, onProgress?: (progress: number) => void): Promise<void> {
    // 1. Fetch manifest
    const manifest = await firstValueFrom(
      this.http.get<ApiSuccessEnvelope<OfflinePackageManifest>>(
        `/api/v1/offline-packages/${packageId}/manifest`
      )
    );
    
    const pkg = manifest.data;
    
    // 2. Save package metadata
    await this.db.savePackage({
      id: pkg.packageId,
      name: pkg.name,
      description: pkg.description,
      status: pkg.status,
      licenseExpiresAt: pkg.licenseExpiresAt,
      chapterIds: pkg.chapters.map(c => c.chapterId),
      totalSize: pkg.totalSize,
      downloadedAt: new Date().toISOString(),
      lastAccessedAt: new Date().toISOString(),
    });
    
    // 3. Download chapters and media
    const totalItems = pkg.chapters.length + pkg.chapters.reduce((sum, c) => sum + c.media.length, 0);
    let completedItems = 0;
    
    for (const chapter of pkg.chapters) {
      // Save chapter content
      await this.db.saveChapter({
        id: chapter.chapterId,
        packageId: pkg.packageId,
        storyId: chapter.storyId,
        number: chapter.number,
        title: chapter.title,
        slug: chapter.slug,
        version: chapter.version,
        content: chapter.content,
        contentFormat: chapter.contentFormat,
        contentDocument: chapter.contentDocument,
        documentSchemaVersion: chapter.documentSchemaVersion,
        accessState: chapter.accessState,
        mediaIds: chapter.media.map(m => m.id),
        wordCount: chapter.wordCount,
        publishedAt: chapter.publishedAt,
        snapshotAt: chapter.snapshotAt,
      });
      
      completedItems++;
      onProgress?.(completedItems / totalItems);
      
      // Download media blobs
      for (const media of chapter.media) {
        try {
          const blob = await firstValueFrom(
            this.http.get(media.url, { responseType: 'blob' })
          );
          
          await this.db.saveMedia({
            id: media.id,
            chapterId: chapter.chapterId,
            url: media.url,
            blob,
            width: media.width,
            height: media.height,
            format: media.format,
            sizeBytes: media.sizeBytes,
          });
        } catch (error) {
          console.error(`Failed to download media ${media.id}`, error);
          // Continue with other media
        }
        
        completedItems++;
        onProgress?.(completedItems / totalItems);
      }
    }
    
    // 4. Cache media URLs in Service Worker
    const mediaUrls = pkg.chapters.flatMap(c => c.media.map(m => m.url));
    await this.sw.cacheManifestAssets(mediaUrls);
  }
  
  async deletePackage(packageId: string): Promise<void> {
    await this.db.deletePackage(packageId);
    // Note: Service Worker cache will be cleaned on next activation
  }
}
```

**Files to create:**
- `frontend/src/app/core/offline/offline-db.service.ts`
- `frontend/src/app/core/offline/offline-download.service.ts`
- `frontend/src/app/core/offline/offline-sync.service.ts`

**Tests:**
- Unit: IndexedDB operations
- Integration: Download package, verify stored in IndexedDB
- E2E: Full offline flow

---

#### Phase 3.3: Offline UI & Lifecycle (2 ngày)

**Task 3.3.1: Offline Package Management UI**

**File:** `frontend/src/app/features/account/offline-packages/offline-packages-page.component.ts`

```typescript
@Component({
  selector: 'app-offline-packages-page',
  standalone: true,
  template: `
    <div class="offline-packages-page">
      <div class="page-header">
        <h1>Gói đọc offline</h1>
        <button (click)="createPackage()" class="btn-primary">
          Tạo gói mới
        </button>
      </div>
      
      <!-- Quota info -->
      <div class="quota-card">
        <div class="quota-stat">
          <span class="label">Gói đã tạo:</span>
          <span class="value">{{ quota()?.currentPackages }} / {{ quota()?.maxPackages }}</span>
        </div>
        <div class="quota-stat">
          <span class="label">Dung lượng:</span>
          <span class="value">{{ formatBytes(quota()?.currentSizeBytes) }} / {{ formatBytes(quota()?.maxTotalSizeBytes) }}</span>
        </div>
      </div>
      
      <!-- Package list -->
      <div class="packages-list">
        @for (pkg of packages(); track pkg.id) {
          <div class="package-card" [class.expired]="isExpired(pkg)">
            <div class="package-header">
              <h3>{{ pkg.name }}</h3>
              <span class="status-badge" [class]="pkg.status">
                {{ getStatusLabel(pkg.status) }}
              </span>
            </div>
            
            <div class="package-info">
              <div class="info-row">
                <span class="icon">📚</span>
                <span>{{ pkg.chapterCount }} chương</span>
              </div>
              <div class="info-row">
                <span class="icon">💾</span>
                <span>{{ formatBytes(pkg.totalSize) }}</span>
              </div>
              @if (pkg.licenseExpiresAt) {
                <div class="info-row">
                  <span class="icon">⏰</span>
                  <span>Hết hạn: {{ formatDate(pkg.licenseExpiresAt) }}</span>
                </div>
              }
            </div>
            
            <div class="package-actions">
              @if (isDownloaded(pkg.id)) {
                <button (click)="viewPackage(pkg.id)" class="btn-secondary">
                  Xem offline
                </button>
              } @else {
                <button (click)="downloadPackage(pkg)" class="btn-primary">
                  <span class="icon">⬇</span>
                  Tải xuống
                </button>
              }
              
              <button (click)="deletePackage(pkg)" class="btn-danger">
                Xóa
              </button>
            </div>
            
            @if (downloadProgress().get(pkg.id); as progress) {
              <div class="download-progress">
                <div class="progress-bar">
                  <div class="progress-fill" [style.width.%]="progress * 100"></div>
                </div>
                <span class="progress-text">{{ (progress * 100).toFixed(0) }}%</span>
              </div>
            }
          </div>
        }
      </div>
      
      @if (packages().length === 0) {
        <div class="empty-state">
          <p>Bạn chưa có gói offline nào</p>
          <button (click)="createPackage()" class="btn-primary">
            Tạo gói đầu tiên
          </button>
        </div>
      }
    </div>
  `,
  styles: [/* ... */]
})
export class OfflinePackagesPageComponent implements OnInit {
  private repository = inject(OfflinePackagesRepository);
  private downloadService = inject(OfflineDownloadService);
  private dbService = inject(OfflineDBService);
  
  packages = signal<OfflinePackage[]>([]);
  quota = signal<OfflineQuota | null>(null);
  downloadProgress = signal(new Map<string, number>());
  
  async ngOnInit() {
    await this.loadPackages();
    await this.loadQuota();
  }
  
  async loadPackages() {
    const data = await this.repository.listPackages();
    this.packages.set(data);
  }
  
  async loadQuota() {
    const data = await this.repository.getQuota();
    this.quota.set(data);
  }
  
  async downloadPackage(pkg: OfflinePackage) {
    try {
      await this.downloadService.downloadPackage(pkg.id, (progress) => {
        this.downloadProgress.update(map => {
          const newMap = new Map(map);
          newMap.set(pkg.id, progress);
          return newMap;
        });
      });
      
      // Clear progress
      this.downloadProgress.update(map => {
        const newMap = new Map(map);
        newMap.delete(pkg.id);
        return newMap;
      });
      
      alert('Đã tải xong!');
    } catch (error) {
      console.error('Download failed', error);
      alert('Tải xuống thất bại');
    }
  }
  
  async isDownloaded(packageId: string): Promise<boolean> {
    const pkg = await this.dbService.getPackage(packageId);
    return !!pkg;
  }
  
  isExpired(pkg: OfflinePackage): boolean {
    if (!pkg.licenseExpiresAt) return false;
    return new Date(pkg.licenseExpiresAt) < new Date();
  }
}
```

**Task 3.3.2: Logout Hook - Clear Offline Data**

**File:** `frontend/src/app/core/auth/auth.store.ts`

```typescript
// Add to existing AuthStore

private offlineDb = inject(OfflineDBService);
private swService = inject(ServiceWorkerRegistrationService);

async logout(): Promise<void> {
  try {
    await this.repository.logout();
    
    // Clear offline data
    await this.clearOfflineData();
    
    this.state.set({
      status: 'anonymous',
      user: null,
      sessionHint: false,
    });
    
    this.router.navigate(['/']);
  } catch (error) {
    console.error('Logout failed', error);
  }
}

private async clearOfflineData(): Promise<void> {
  try {
    // Clear IndexedDB
    await this.offlineDb.clearAll();
    
    // Clear Service Worker cache
    await this.swService.clearCache();
    
    console.log('Offline data cleared');
  } catch (error) {
    console.error('Failed to clear offline data', error);
  }
}
```

**Files to create:**
- `frontend/src/app/features/account/offline-packages/*`
- `frontend/src/app/core/offline/offline-packages.repository.ts`

**Tests:**
- E2E: Create package, download, view offline
- E2E: Logout → verify offline data cleared
- E2E: Switch account → verify old data cleared

---

## 📝 IMPLEMENTATION ORDER

### Day 1-2: Backend Domain & Policies
- [ ] Database migration (OfflinePackage tables)
- [ ] Domain policies (quota, entitlement)
- [ ] Unit tests

### Day 3-5: Backend Application & API
- [ ] Create/Delete package commands
- [ ] Get manifest query
- [ ] Session revocation listener
- [ ] Prisma persistence
- [ ] HTTP controllers
- [ ] Integration tests

### Day 6: Service Worker Setup
- [ ] Create sw.ts
- [ ] Service Worker registration service
- [ ] PWA manifest
- [ ] Cache management

### Day 7-8: IndexedDB Storage
- [ ] OfflineDBService
- [ ] Download service
- [ ] Sync service
- [ ] Tests

### Day 9-10: Offline UI
- [ ] Package management page
- [ ] Download progress UI
- [ ] Offline reader mode
- [ ] Quota display

### Day 11-12: Lifecycle & Polish
- [ ] Logout hook - clear offline data
- [ ] Session change detection
- [ ] License expiry handling
- [ ] E2E testing
- [ ] Documentation

---

## 🧪 TESTING STRATEGY

### Security Tests (Critical)
- [ ] Cannot create package for chapters without entitlement
- [ ] Cannot access other user's packages
- [ ] Manifest filtered by user entitlement
- [ ] Session revoked → packages revoked
- [ ] Logout → offline data cleared

### Functional Tests
- [ ] Create package → stored in DB
- [ ] Download package → saved in IndexedDB
- [ ] Read offline chapter → load from IndexedDB
- [ ] Sync progress → sent to server when online
- [ ] License expiry → package marked expired

### Performance Tests
- [ ] Download 50-chapter package < 2 minutes
- [ ] IndexedDB queries < 100ms
- [ ] Service Worker cache hit rate > 90%

---

## 🚨 RISKS & MITIGATION

### Risk 1: Cannot protect offline content from device owner
**Accepted Limitation:** Document in ToS and user agreement

### Risk 2: Large packages fill device storage
**Mitigation:**
- Quota limits per user
- LRU cleanup for old packages
- Storage usage warnings

### Risk 3: Service Worker cache conflicts
**Mitigation:**
- Explicit manifest-based caching only
- Version-based cache names
- Clear cache on activation

### Risk 4: Offline progress conflicts with online
**Mitigation:**
- Last-write-wins with timestamp
- Sync queue with retry
- Conflict resolution UI (future)

---

## 📊 SUCCESS METRICS

- ✅ Users can download packages offline
- ✅ 100% entitlement verification
- ✅ 0 data leaks across accounts
- ✅ Session revoked → packages revoked within 5 minutes
- ✅ Logout → offline data cleared immediately

---

## 📚 DOCUMENTATION

- [ ] API docs: Offline package endpoints
- [ ] User guide: How to download for offline
- [ ] Security docs: Offline content limitations
- [ ] PWA setup guide for deployment

---

## ✅ DEFINITION OF DONE

- [ ] All tests passing
- [ ] Security audit passed (entitlement checks)
- [ ] PWA installable
- [ ] Service Worker functional
- [ ] IndexedDB working across browsers
- [ ] Logout clears offline data
- [ ] Session revocation triggers cleanup
- [ ] License expiry enforced
- [ ] Documentation complete

---

**Critical Security Notes:**
1. **ALWAYS verify entitlement** server-side before creating package
2. **Snapshot entitlement** at download time - don't re-check dynamically
3. **Revoke packages** on session end/logout
4. **Clear IndexedDB** on logout/account switch
5. **Accept limitation** that offline content cannot be perfectly protected

**Performance Notes:**
- Cache media aggressively (largest bandwidth cost)
- Use IndexedDB for large JSON (contentDocument)
- Lazy-load packages (don't load all at startup)
- LRU cleanup old packages automatically
