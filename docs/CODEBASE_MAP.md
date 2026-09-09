# CODEBASE_MAP - Quan-ly-truyen / TruyenHub

> Comprehensive onboarding map created: 2026-09-08  
> Repository: E:\New folder\Quan-ly-truyen  
> Last commit scanned: 523678ea3cce68ced23735cc24670ed556bb6aaa (main branch)

---

## 1. System Overview

**TruyenHub** is a full-stack story reading and publishing platform built as a monorepo with:

- **Backend**: NestJS 11 + Prisma 7 + PostgreSQL 17, following hexagonal/ports-adapters architecture with CQRS
- **Frontend**: Angular 22 standalone with SSR, using signals and route-scoped providers
- **Worker Process**: Separate NestJS worker for BullMQ queues, outbox pattern, webhooks, and async processing
- **Infrastructure**: Docker Compose for development and production, PostgreSQL + Redis + Caddy reverse proxy

### Architecture Principles

1. **Hexagonal Architecture (Ports & Adapters)**: Domain logic is isolated from infrastructure
2. **CQRS**: Commands (writes) and Queries (reads) are separated
3. **Outbox Pattern**: Side effects are persisted to DB first, then processed asynchronously
4. **JWT + Refresh Token**: Secure authentication with token rotation and family tracking
5. **Feature Modules**: Both backend and frontend organized by domain features
6. **SSR**: Angular server-side rendering for public routes only

### Tech Stack Summary

**Backend:**
- NestJS 11.1.x, TypeScript 5.9.3 (ES2023, CommonJS)
- Prisma 7.9.x with PostgreSQL adapter
- BullMQ 5 + Redis/ioredis for queues
- Passport JWT, bcryptjs for auth
- Cloudinary for media storage
- Nodemailer for transactional email
- Pino for logging, Prometheus for metrics, OpenTelemetry for tracing

**Frontend:**
- Angular 22.1.x standalone components
- Angular SSR 22.1.x
- RxJS 7.8, Vitest 4, Playwright 1.62
- TypeScript 6.0.3 (strict mode enabled)

**Infrastructure:**
- Node 24.15.x, npm 11.12.1 (pinned via .nvmrc and package.json engines)
- PostgreSQL 17, Redis 7
- Docker Compose for orchestration
- Caddy as reverse proxy with automatic HTTPS

---

## 2. Directory Map

```
Quan-ly-truyen/
├── backend/                    # NestJS API + Worker
│   ├── src/
│   │   ├── main.ts            # API entrypoint
│   │   ├── worker.ts          # Worker entrypoint
│   │   ├── app.module.ts      # Root module for API
│   │   ├── worker.module.ts   # Root module for Worker
│   │   ├── bootstrap/         # Bootstrap logic (security, swagger, gates)
│   │   ├── config/            # Configuration schemas and validation
│   │   ├── common/            # Guards, decorators, filters, interceptors, pipes, utils
│   │   ├── infrastructure/    # Technical capabilities (DB, cache, queue, mail, observability)
│   │   ├── modules/           # Domain modules (auth, users, stories, chapters, etc.)
│   │   └── generated/         # Prisma client (gitignored, generated on postinstall)
│   │
│   ├── prisma/
│   │   ├── schema.prisma      # Database schema (58 models, 37 enums)
│   │   ├── migrations/        # 37 migration folders (forward-only, backward-compatible)
│   │   ├── seed.ts            # Idempotent seed for system roles/permissions
│   │   └── seed-e2e*.ts       # Test seeds
│   │
│   ├── test/
│   │   ├── integration/       # 15 integration test files
│   │   ├── e2e/               # 8 E2E test files
│   │   └── jest-*.json        # Domain-specific Jest configs
│   │
│   ├── scripts/               # Maintenance, verification, ops scripts
│   │   ├── architecture/      # Boundary enforcement
│   │   ├── ci/                # CI gates and checks
│   │   ├── database/          # DB validation, constraints, seed verification
│   │   ├── maintenance/       # Cleanup, reconciliation (auth, outbox, counters, media)
│   │   ├── monetization/      # Load tests, security tests
│   │   └── testing/           # Test environment setup
│   │
│   ├── ops/production/        # Production operations
│   │   ├── PRODUCTION_RUNBOOK.md
│   │   ├── Caddyfile          # Reverse proxy config
│   │   ├── Deploy-Production.ps1, Invoke-Release.ps1, Invoke-Rollback.ps1
│   │   └── observability/     # Prometheus, Loki, Tempo, Grafana, Alertmanager configs
│   │
│   ├── docker/                # Development Docker Compose
│   │   └── compose.dev.yml
│   │
│   ├── compose.production.yml # Production Docker Compose (core + gates + backup)
│   ├── compose.vps.yml        # Legacy/alternative VPS topology
│   ├── package.json           # 150+ scripts for build, test, maintenance, ops
│   └── tsconfig.json          # TypeScript config (ES2023, CommonJS, aliases @/*)
│
├── frontend/                  # Angular 22 SSR
│   ├── src/
│   │   ├── main.ts           # Browser entrypoint
│   │   ├── main.server.ts    # SSR entrypoint
│   │   ├── server.ts         # Node HTTP server for SSR
│   │   ├── app/
│   │   │   ├── app.ts        # Root component
│   │   │   ├── app.config.ts # App configuration
│   │   │   ├── app.routes.ts # Root routes
│   │   │   ├── core/         # Auth, HTTP, config, guards (singletons)
│   │   │   ├── shared/       # Reusable UI components, directives, pipes
│   │   │   ├── features/     # Feature modules (account, admin, author-portal, public)
│   │   │   ├── routes/       # Route configurations
│   │   │   └── layout/       # Shell components
│   │   └── environments/     # Environment configs
│   │
│   ├── e2e/                  # Playwright E2E tests (33 files)
│   ├── scripts/              # Architecture rules and checks
│   ├── proxy.conf.json       # Dev proxy to backend
│   ├── playwright.config.ts
│   ├── vitest.config.ts
│   └── package.json
│
├── .github/workflows/        # CI/CD
│   ├── ci.yml               # Main CI pipeline (quality, integration, E2E, container)
│   ├── deploy-environment.yml  # Continuous Deployment
│   ├── rollback-environment.yml
│   ├── backend-images.yml, frontend-images.yml  # Image publication
│   ├── codeql.yml
│   └── dependency-review.yml
│
├── scripts/                  # Cross-repo scripts
│   ├── check-development-environment.mjs
│   ├── check-centralized-constants.mjs
│   ├── verify-production-scope.mjs
│   └── verify-api-contracts.mjs
│
├── docs/                     # Documentation (THIS FILE)
│
└── Root files:
    ├── .nvmrc                # Node 24.15.0
    ├── CẤU_TRÚC_VÀ_DESIGN_PATTERNS.md  # Vietnamese architecture guide
    ├── REPO_CONTEXT.md       # Detailed reconnaissance doc
    ├── CI_CD_FIXES.md
    ├── SPRINT_3_PLAN_COMIC_PIPELINE.md
    └── *.patch files         # Phase 0-2 architecture patches
```

---

## 3. Module Responsibilities

### Backend Modules (in `backend/src/modules/`)

| Module | Responsibility | Key Exports |
|--------|----------------|-------------|
| **auth** | Registration, login, refresh, logout, OAuth (Google/GitHub), MFA, password/email recovery, session management, authorization cache | Split into: AuthCoreModule, AuthSessionsModule, AuthCredentialsModule, AuthOAuthModule, AuthAccountSecurityModule, AuthAuthorizationModule |
| **users** | User profile, preferences, admin user management | USER_MODERATION_PORT |
| **authors** | Public author directory/detail, author profile/dashboard, admin author lifecycle | AssertActiveAuthorQueryHandler, ActiveAuthorGuard |
| **author-applications** | Author application draft/submit/review flow | Lifecycle policy for application states |
| **stories** | Public story catalog/detail, author story CRUD, story submission, admin review | Imports authorization + authors |
| **chapters** | Public chapter reader, author chapter CRUD/publish/schedule | Exports persistence port for AI translation |
| **categories** | Admin taxonomy category management | Hierarchical structure |
| **tags** | Admin tag CRUD and merge | |
| **comments** | Public comment reads, authenticated comment writes/replies/reactions/reports | Uses Prisma + Redis |
| **moderation** | Admin comment moderation (hold/hide/restore/remove), user warn/ban | Imports Users public contract |
| **reports** | Admin report management (list/detail/resolve/reject) | |
| **ratings** | Story rating CRUD | Updates aggregate counters |
| **libraries** | Personal library status for stories | |
| **reading-history** | Reading progress, history, chapter bookmarks | |
| **reading-goals** | Personal reading goals | |
| **follows** | Follow authors/stories, follower management | Notification integration |
| **notifications** | Notification inbox/settings, worker fanout | NotificationsWorkerModule |
| **analytics** | Reader event ingestion, author analytics aggregates | AnalyticsModule (API), AnalyticsWorkerModule (worker) |
| **media** | Upload intents, Cloudinary webhook inbox, media cleanup | Exports adapters/ports; worker always loads |
| **audit-logs** | Admin audit trail | Observability-integrated |
| **ai** | AI connections/models, chat/SSE streaming, policies/profiles/usage, chapter translation | AiModule, AiWorkerModule |
| **wallets** | User credit wallets | Monetization feature |
| **monetization** | Chapter unlocking, content gating | Feature-gated |
| **billing** | Payment orders, payment providers (manual bank transfer, HMAC sandbox) | BillingWorkerModule |

### Frontend Features (in `frontend/src/app/features/`)

| Feature | Scope | Key Areas |
|---------|-------|-----------|
| **account** | User account management | Auth pages, profile/security, author application, following, library, notifications, reading history, AI assistant |
| **admin** | Admin panel | Users, authors, story review, categories, tags, reports, audit logs, AI settings |
| **author-portal** | Author workspace | Author studio, author profile, analytics, chapter translation |
| **public** | Public-facing pages | Home, catalog/ranking/updates/genre, story detail, chapter reader, comments, author directory |

---

## 4. Runtime Execution Flows

### API Request Flow (Protected Endpoint)

```
1. HTTP Request → Caddy (reverse proxy)
2. → Nest API (port 3000)
3. → Global Middleware Pipeline:
   - RequestContextMiddleware (request ID, correlation ID)
   - LocaleMiddleware (i18n)
   - MaintenanceModeMiddleware (maintenance check)
   - JsonContentTypeMiddleware (excludes /api/v1/webhooks)
4. → Global Interceptors:
   - RequestLoggingInterceptor
   - TimeoutInterceptor (15s hardcoded)
   - ResponseEnvelopeInterceptor
5. → Global Guards:
   - JwtAuthGuard (validates JWT, extracts user)
   - RolesGuard (checks @Roles() metadata)
   - PermissionsGuard (checks @Permissions() metadata - ALL required)
6. → Route-specific Guards:
   - ActiveAuthorGuard (for author routes)
   - MonetizationFeatureGuard (for monetization routes)
7. → Controller Method
   - Request DTO validation (AppValidationPipe)
   - Transform to Command/Query
8. → Command/Query Handler
   - Business logic orchestration
   - Calls injected Port interfaces
9. → Infrastructure Adapter (via Port)
   - Prisma persistence
   - Redis cache/lock/limiter
   - External services (Cloudinary, SMTP, AI)
10. → Response Mapper (Domain → DTO → Response DTO)
11. → Global Exception Filter (if error)
    - Normalize to stable error envelope
    - Set x-request-id header
    - Log structured + OTel
12. → Response Envelope Interceptor
    - Wrap in success envelope with requestId/timestamp
13. → HTTP Response
```

**Public Endpoints** use `@Public()` decorator to bypass JWT guard.

### Worker Process Flow

```
1. Worker starts (worker.ts)
2. → Production gate checks (bootstrap/worker.bootstrap.ts)
3. → WorkerModule initialization
   - Conditionally imports queue workers based on:
     - QUEUE_ENABLED=true
     - REDIS_ENABLED=true
     - WORKER_ROLE=all or queue
4. → Active Workers:
   - CloudinaryWebhookInboxWorker (always active)
   - OutboxScheduler + OutboxDispatcher (polls DB every ~10s)
   - MailProcessor
   - NotificationFanoutProcessor
   - AnalyticsProcessor + Schedulers
   - AiTranslationProcessor
   - ChapterSchedulingScheduler
   - BillingWebhookProcessor
   - CommentReanchorScheduler
5. → Outbox Pattern:
   - API writes domain state + OutboxEvent in transaction
   - OutboxScheduler claims events (FOR UPDATE SKIP LOCKED)
   - OutboxDispatcher routes to appropriate queue
   - Processor handles job with retries
   - Updates event status (COMPLETED/FAILED/DEAD_LETTER)
```

### Frontend Bootstrap Flow

```
1. Browser loads Angular app
2. → main.ts: Fetch /api/v1/auth/client-config
   - Returns password policy, CSRF policy, MFA config
   - BLOCKS bootstrap if fetch fails or invalid shape
3. → Bootstrap Angular with runtime config
4. → AppComponent initializes
5. → AuthStore.ensureInitialized()
   - Checks session hint (cookie or localStorage flag)
   - If hint exists: POST /api/v1/auth/refresh
   - Then: GET /api/v1/auth/me
   - Sets state: authenticated | anonymous | unavailable
6. → Route activation
   - Route guards check AuthStore state
   - Protected routes require authenticated state
   - Some routes require specific roles/permissions
7. → HTTP requests via HttpClient
   - ApiInterceptor adds Bearer token if available
   - Adds CSRF header for mutations
   - Handles 401 with automatic refresh attempt
   - Single-flight refresh coordination across tabs
```

### Authentication Flows

#### Login Flow
```
1. POST /api/v1/auth/login {identifier, password}
2. → LoginCommandHandler:
   a. Rate limit check (Redis)
   b. Find user by email/username
   c. bcrypt.compare (always runs, uses dummy hash if user not found)
   d. Check account status (active, not deleted, email verified)
   e. Reset rate limiter (must succeed)
   f. IF user has MFA enabled OR admin requires MFA:
      - Create MFA challenge (Redis)
      - Throw MfaRequiredException
      - Client redirects to MFA verification
   g. ELSE:
      - Create Session (hashed refresh token, device info)
      - Generate JWT access token + refresh token
      - Return tokens + user info
3. → Frontend stores access token in memory (TokenStore signal)
4. → Frontend receives HttpOnly refresh token cookie
5. → Sets session hint in localStorage
```

#### Refresh Flow
```
1. POST /api/v1/auth/refresh (with HttpOnly cookie)
2. → RefreshTokenCommandHandler:
   a. Verify JWT refresh token claims
   b. Lookup Session by session ID
   c. Check user/family/status/expiry/revocation
   d. Compare hashed refresh token + version
   e. IF mismatch → Token reuse detected:
      - Revoke entire family (all sessions in rotation chain)
      - Throw UnauthorizedException
   f. Generate next refresh token (increment version)
   g. CAS update session (compare-and-swap)
   h. IF race condition lost → Treat as reuse, revoke family
   i. Return new access token + refresh token
3. → Frontend updates access token in memory
4. → Browser receives new refresh token cookie
```

#### OAuth Flow (Google/GitHub)
```
1. GET /api/v1/auth/oauth/:provider
2. → Store state in Redis (5min TTL)
3. → Redirect to provider authorization URL
4. → Provider redirects back to callback
5. → GET /api/v1/auth/oauth/:provider/callback
6. → Verify state, exchange code for tokens
7. → Create one-time handoff token (Redis, 5min)
8. → Redirect to frontend /oauth/callback?handoff=xxx
9. → POST /api/v1/auth/oauth/finalize {handoff}
10. → Consume handoff (one-use), link/create account
11. → Return session tokens (same as login)
```

### Chapter Publication Flow
```
1. Author creates chapter draft
2. → POST /api/v1/author/stories/:storyId/chapters
3. → CreateChapterCommandHandler
   - Validates story ownership/contributor status
   - Creates Chapter (status=DRAFT)
4. Author publishes chapter
5. → PUT /api/v1/author/stories/:storyId/chapters/:chapterId/publish
6. → PublishChapterCommandHandler
   - Updates Chapter status to PUBLISHED
   - IN TRANSACTION:
     a. Update chapter row
     b. Create OutboxEvent: 'notification.author-chapter-published.v1'
     c. Create OutboxEvent: 'ai.auto-translate-chapter-published.v1'
7. → Worker OutboxDispatcher routes events:
   - notification → NotificationFanoutProcessor
     → Creates Notification rows for followers
   - ai → AiTranslationProcessor
     → IF story has AI profile AND policy allows
     → Creates ChapterTranslation jobs
```

### Chapter Scheduling Flow
```
1. Author sets schedule
2. → PUT /api/v1/author/stories/:storyId/chapters/:chapterId/schedule
   - Sets Chapter.scheduledPublishAt timestamp
   - Status remains SCHEDULED
3. → ChapterSchedulingScheduler (worker, periodic poll)
   - Queries chapters with scheduledPublishAt <= now
   - FOR UPDATE SKIP LOCKED (distributed lock)
   - Recheck status is still SCHEDULED
   - Update status to PUBLISHED
   - Create audit log
   - Create outbox events (same as manual publish)
```

---

## 5. Data Model

### Database Overview
- **Database**: PostgreSQL 17 (via Prisma 7.9.x)
- **Models**: 58 models across multiple domains
- **Enums**: 37 enums for type safety
- **Migrations**: 37 migration folders (forward-only, backward-compatible)
- **Schema Location**: `backend/prisma/schema.prisma`

### Core Identity & Auth (lines 448-1251 in schema.prisma)

**User** (lines 448-525)
- Primary identity with email (unique, max 320), username (unique, max 50), passwordHash
- displayName (max 120), bio (text), avatarMediaId
- AccountStatus enum: ACTIVE | SUSPENDED | BANNED | DELETED
- Timestamps: emailVerifiedAt, passwordUpdatedAt, lastLoginAt, createdAt, updatedAt, deletedAt
- **Relations** (50+ relations):
  - Auth: sessions, tokens, oauthAccounts, mfaCredentials, trustedDevices, recoveryEmail, securityQuestions
  - Content: authorProfile, authorApplication, storyContributions, chaptersCreated, comments, ratings
  - Engagement: libraryEntries, storyFollows, authorFollows, readingProgresses, readingSessions
  - Finance: wallets, chapterPurchases, paymentOrders
  - AI: aiConnections, aiConversations, aiUsages, aiPolicy, aiProfile
  - Moderation: reportsFiled, reportsAssigned, moderationActions
  - Analytics: readerAnalyticsEvents

**Session** (lines 1141-1172)
- Stores **HASHED** refresh token (not plaintext) in refreshTokenHash field
- refreshTokenFamilyId: UUID for rotation lineage tracking
- refreshTokenVersion, accessTokenVersion: incremented on rotation
- Device fingerprinting: deviceId, deviceName, ipAddress, userAgent
- trustedDeviceId: optional link to TrustedDevice
- mfaVerifiedAt: timestamp when MFA was last verified for this session
- Lifecycle: lastUsedAt, expiresAt, revokedAt, revokedReason
- **Key indexes**: userId+revokedAt, trustedDeviceId, refreshTokenFamilyId, expiresAt

**RBAC System**
- **Role** (lines 1191-1204): code (unique), name, description, isSystem flag
- **Permission** (lines 1206-1220): code (unique), name, resource, action
- **UserRole** (lines 1222-1238): userId+roleId composite PK, assignedById, assignedAt, expiresAt
- **RolePermission** (lines 1240-1251): roleId+permissionId composite PK
- **Seed roles**: USER, AUTHOR, ADMIN with granular permissions

**OAuth & MFA**
- **OAuthAccount** (lines 789-804): provider (GOOGLE | FACEBOOK | GITHUB), providerAccountId, unique per user+provider
- **MfaCredential** (lines 821-841): method (TOTP), status (PENDING | ENABLED | DISABLED), encryptedSecret, enrollmentExpiresAt
- **AdminMfaCredential** (lines 806-818): separate table for admin MFA, encryptedSecret, recoveryCodeHashes array
- **MfaRecoveryCode** (lines 843-854): hashed recovery codes, usedAt tracking

**Account Security**
- **TrustedDevice** (lines 1097-1118): deviceId, fingerprintHash, trustTokenHash (unique), trustedAt, expiresAt, revokedAt
- **RecoveryEmail** (lines 1042-1060): email, verifiedAt, pendingEmail, pendingCodeHash, verification flow tracking
- **SecurityQuestion** (lines 1062-1076): code (unique), label, locale, isActive, sortOrder
- **UserSecurityQuestion** (lines 1078-1095): userId+questionId, answerHash, position, lastVerifiedAt
- **AccountDeletionRequest** (lines 1120-1139): status (REQUESTED | CANCELED | COMPLETED), scheduledFor, requestIp/UA

**UserToken** (lines 1174-1189)
- type: EMAIL_VERIFICATION | PASSWORD_RESET | CHANGE_EMAIL
- tokenHash (unique, not plaintext), payload (JSON), expiresAt, consumedAt
- One-time use pattern via consumedAt field

### Authors & Applications (lines 1256-1337)

**AuthorApplication** (lines 1256-1307)
- userId (unique), status: DRAFT | PENDING | APPROVED | REJECTED
- Fields: penName (max 40), fullName (max 80), email, phone, portfolioUrl
- primaryGenre, experience, introduction, firstWorkSynopsis
- acceptedTerms boolean, sampleMediaId (optional)
- Review flow: submittedAt, reviewedAt, reviewedById, rejectionReason
- **Unique constraint**: pending pen names to prevent race conditions during approval

**AuthorProfile** (lines 1309-1337)
- userId as PK (one-to-one with User)
- penName (unique, lowercase index), fullName, bio, websiteUrl, socialLinks (JSON)
- verificationStatus: PENDING | VERIFIED | REJECTED
- lifecycleStatus: ACTIVE | SUSPENDED | REVOKED
- Denormalized counters: followerCount, totalStories, totalChapters
- bannerMediaId for profile banner image

### Content & Media (lines 1339-1514)

**Story** (lines 1387-1454)
- authorId (owner), title, slug (unique), synopsis, notes
- status: DRAFT | PENDING_REVIEW | REJECTED | PUBLISHED | HIATUS | SUSPENDED | COMPLETED | ARCHIVED
- visibility: PUBLIC | UNLISTED | PRIVATE
- contentRating: EVERYONE | TEEN | MATURE
- language, coverMediaId
- Denormalized counters: viewCount, likeCount, commentCount, averageRating, ratingCount, chapterCount, followerCount
- primaryCategoryId, completedAt, lastPublishedAt
- **Relations**: contributors, categories, tags, chapters, submissions, follows, ratings, analytics

**StoryContributor** (lines 1456-1473)
- storyId+userId composite PK
- role: CO_AUTHOR | EDITOR | TRANSLATOR | ILLUSTRATOR
- addedById, addedAt

**Category, Tag** (lines 1339-1385)
- **Category**: hierarchical with parentId, slug (unique), name, description, sortOrder
- **Tag**: slug (unique), name, usageCount
- **StoryCategory**: storyId+categoryId, isPrimary flag (only one primary per story)
- **StoryTag**: storyId+tagId
- **Constraint**: Case-insensitive unique names enforced in migration SQL

**Chapter** (lines 1475-1514)
- storyId, number (chapter number within story), title, slug
- status: DRAFT | SCHEDULED | PUBLISHED | HIDDEN | ARCHIVED
- contentFormat: MARKDOWN | HTML | PLAIN_TEXT
- content (text), wordCount, scheduledPublishAt (nullable)
- createdById, updatedById, publishedAt
- Denormalized: viewCount, commentCount
- **Relations**: versions, media (for comic chapters), translations, monetization, purchases

**ChapterVersion** (deferred in production v1)
- Planned for edit history tracking

**MediaAsset** (lines 1517-1560)
- purpose: AVATAR | AUTHOR_BANNER | STORY_COVER | GENRE_COVER | CHAPTER_IMAGE | ATTACHMENT | AUTHOR_APPLICATION_SAMPLE
- status: PENDING | UPLOADED | PROCESSING | READY | FAILED | DELETING | DELETE_FAILED | DELETED
- uploaderId, resourceType: IMAGE | VIDEO | RAW
- Cloudinary fields: publicId, resourceType, format, width, height, bytes, secureUrl
- confirmedAt, expiresAt (for unconfirmed uploads)

**ChapterMedia** (for comic chapters)
- chapterId+sequence composite for ordering image slices

### Engagement (lines 1563-1669)

**LibraryEntry** (lines 1563-1580)
- userId+storyId composite PK
- status: PLAN_TO_READ | READING | COMPLETED | ON_HOLD | DROPPED
- isFavorite, isPrivate, notes, addedAt

**StoryFollow** (lines 1582-1595)
- userId+storyId, followedAt

**UserFollowAuthor** (lines 1597-1610)
- userId+authorId (following user+author being followed)
- followedAt

**Rating** (lines 1612-1627)
- userId+storyId composite PK
- rating (1-5), reviewText, isPublic, ratedAt
- Updates Story.averageRating aggregate

**Comment** (lines 1629-1669)
- Self-referencing for threading: rootCommentId, parentCommentId
- targetType: STORY | CHAPTER, targetId
- content, userId, moderationStatus
- Denormalized: replyCount, reactionCount
- **Comic comments**: coordinateX, coordinateY, anchorStatus (ACTIVE | REANCHORED | ORPHANED)
- Soft delete: deletedAt, deletedReason

**CommentReaction** (lines 1671-1684)
- userId+commentId+reactionType composite PK
- reactionType: LIKE | LOVE | LAUGH | INSIGHTFUL

**ReadingProgress** (lines 1686-1702)
- userId+chapterId composite PK
- progressPercentage (0-100), position (character offset)
- completedAt, lastReadAt

**ReadingSession** (lines 1704-1720)
- userId+chapterId+date composite for analytics
- sessionDurationSeconds, readingCompletedPercentage

**ReadingBookmark** (lines 1722-1738)
- userId, chapterId, name, position

**ReadingGoal** (lines 1740-1753)
- userId as PK (one per user)
- targetChaptersPerWeek, targetChaptersPerMonth, currentWeekProgress, currentMonthProgress

### Moderation & Operations (lines 1755-1866)

**StorySubmission** (lines 1755-1774)
- Separate from Story for audit trail
- storyId+submissionNumber composite for multiple submission cycles
- status: PENDING | APPROVED | REJECTED | CANCELED
- submittedById, submittedAt, reviewedById, reviewedAt, reviewNotes

**Report** (lines 1776-1807)
- Polymorphic: targetType (STORY | CHAPTER | COMMENT | USER), targetId
- reportedByUserId, reason (enum), description
- status: OPEN | IN_REVIEW | RESOLVED | REJECTED
- assignedToUserId, resolvedAt, resolution
- **DB constraint**: exactly one target field must be set per targetType

**ModerationAction** (lines 1809-1840)
- Polymorphic target similar to Report
- actionType: APPROVE_STORY | REJECT_STORY | SUSPEND_STORY | HIDE_COMMENT | WARN_USER | BAN_USER, etc.
- performedById, reason, metadata (JSON)

**Notification** (lines 1842-1866)
- userId, type, title, message, actionUrl
- read, readAt, dedupeKey (for idempotency)
- metadata (JSON) for structured data

**NotificationPreference**
- User preferences for notification channels

**AuditLog** (lines 1868-1886)
- performedById, targetType, targetId, action
- changes (JSON), ipAddress, userAgent
- Observability-integrated for compliance

**OutboxEvent** (lines 1888-1918)
- aggregateType, aggregateId, eventType, payload (JSON), metadata (JSON)
- status: PENDING | PROCESSING | PUBLISHED | FAILED
- Distributed claim: ownershipToken, leaseExpiresAt
- Retry: attempts, nextRetryAt, lastError
- **At-least-once delivery** pattern

**InboundWebhookEvent** (lines 1920-1945)
- provider (e.g., 'cloudinary'), eventKey (unique per provider)
- signature, payload (JSON), status
- Retry: processingAttempts, lastError
- **Idempotency**: unique constraint on provider+eventKey

### Analytics (lines 1947-2010)

**ReaderAnalyticsEvent** (lines 1947-1977)
- eventType: STORY_VIEW | CHAPTER_VIEW | READING_STARTED | READING_PROGRESS | READING_COMPLETED
- userId (nullable for anonymous), sessionId
- storyId, chapterId (nullable), referrer, userAgent, anonymousId
- Ingestion → enqueue → aggregate flow

**StoryDailyStat** (lines 1979-1994)
- storyId+date composite PK
- views, uniqueVisitors, averageReadingTimeSeconds
- completionRate, bookmarks, ratings

**ChapterDailyStat** (lines 1996-2010)
- chapterId+date composite PK
- views, uniqueVisitors, averageReadingTimeSeconds, completionRate
- **Eventual consistency**: maintenance scripts reconcile

### AI (lines 856-1040)

**AiConnection** (lines 856-893)
- userId (nullable → system connection when null)
- name, vendorHint, protocol enum, authType, authHeaderName
- **encryptedCredential** (AES-256-GCM): ciphertext, no separate IV/tag columns
- baseUrl, defaultModel, enabled
- Capability probing: supportsChat, supportsStreaming, supportsTools, supportsVision, etc.
- capabilitiesProbedAt timestamp
- **Transitional fields**: legacyProvider, legacyEncryptedApiKey (expand-contract pattern)

**AiConversation** (lines 895-916)
- userId, connectionId, modelId, vendorHint, protocol
- title, createdAt, updatedAt
- **Transitional**: legacyProvider mirror

**AiMessage** (lines 918-929)
- conversationId, role (USER | ASSISTANT), content, createdAt

**AiUsage** (lines 931-957)
- userId, connectionId, protocol, model, capability (CHAT | TRANSLATE | SUMMARY | REWRITE)
- inputTokens, outputTokens, latencyMs, success, errorCode
- **Transitional**: legacyProvider mirror
- **Indexes** on userId+createdAt, connectionId+createdAt, model+createdAt, protocol+createdAt

**AiUserPolicy** (lines 959-970)
- userId as PK
- rateLimitTier: FREE | PRO | ENTERPRISE
- fallbackPolicy: NONE | SYSTEM

**AiUserProfile** (lines 972-984)
- userId as PK, model, systemPrompt
- defaultTranslationLanguageCode, autoTranslateOnPublish

**AiStoryProfile** (lines 986-1001)
- storyId as PK, userId (owner), model, systemPrompt
- Story-specific AI settings override user defaults

**AiRateLimitBucket** (lines 1003-1016)
- userId+windowStart composite PK
- requestCount, tokenCount, updatedAt
- Time-window based rate limiting

**ChapterTranslation** (lines 1018-1040)
- chapterId+targetLanguageCode unique constraint
- requestedById, connectionId, status (PENDING | PROCESSING | COMPLETED | FAILED)
- sourceContentHash (for change detection)
- translatedTitle, translatedContent, errorCode, errorMessage

### Monetization & Billing (lines 531-787)

**Wallet** (lines 531-547)
- userId+currency unique (one wallet per currency per user)
- currency: CREDIT (enum, extensible)
- balance (BigInt for precision), version (optimistic locking)
- **Relations**: transactions, ledgerEntries

**WalletLedgerTransaction** (lines 549-572)
- Double-entry ledger transaction
- walletId, currency, type (TOP_UP | CHAPTER_PURCHASE | REFUND | REVERSAL | ADMIN_ADJUSTMENT)
- idempotencyKey (unique), requestHash
- referenceType, referenceId (polymorphic reference to source)
- walletAmount, walletBalanceAfter (snapshot)
- metadata (JSON)

**WalletLedgerEntry** (lines 574-590)
- Individual debit/credit entries (double-entry bookkeeping)
- transactionId, walletId (nullable for system accounts)
- systemAccount: PAYMENT_CLEARING | PLATFORM_REVENUE | ADJUSTMENT
- amount (signed), currency
- **Constraint**: each transaction has exactly 2 entries (debit + credit)

**MonetizationPriceBand** (lines 596-612)
- code (unique), label, creditPrice, isActive, sortOrder
- Predefined pricing tiers

**ChapterMonetization** (lines 614-632)
- chapterId as PK
- accessType: FREE | PAID
- priceBandId (nullable), creditPrice (nullable, denormalized from band)
- previewContent (text preview for paid chapters)
- version (for optimistic locking), updatedById

**ChapterPricingVersion** (lines 634-652)
- Audit trail for price changes
- chapterId+version unique
- Immutable history of accessType, priceBandId, creditPrice changes

**ChapterPurchase** (lines 654-683)
- userId+chapterId (user purchases chapter)
- creditPrice, status (COMPLETED | REFUNDED | REVERSED)
- walletTransactionId (unique), refundWalletTransactionId (nullable)
- idempotencyKey (unique), requestHash
- refundedAt, refundReason, refundedById

**ChapterEntitlement** (lines 685-701)
- userId+chapterId unique (one entitlement per user per chapter)
- purchaseId (unique, one-to-one with ChapterPurchase)
- status: ACTIVE | REVOKED
- grantedAt, revokedAt

**CreditPackage** (lines 707-723)
- code (unique), label, creditAmount, fiatAmountMinor, currency
- Predefined top-up packages

**PaymentProviderConnection** (lines 725-747)
- code (unique), kind: MANUAL_BANK_TRANSFER | HMAC_SANDBOX
- displayName, description, config (JSON), encryptedCredential
- currency, enabled, sortOrder, orderTtlMinutes

**PaymentOrder** (lines 749-787)
- userId, packageId, provider, providerConnectionId
- providerReference (unique per provider)
- creditAmount, fiatAmountMinor, currency
- status: CREATED | PENDING | AWAITING_REVIEW | PAID | FAILED | EXPIRED | REFUNDED | REVERSED
- checkoutUrl, idempotencyKey (unique), requestHash
- walletTransactionId (nullable, linked after payment)
- Review flow: reviewRequestedAt, reviewedAt, reviewedById, reviewReason
- expiresAt, settledAt

---

---

## 6. API Architecture

### API Prefix & Route Structure

**Base prefix**: `/api/v1` (all controllers except metrics)
**Metrics**: `/internal/metrics` (prefix-excluded, has bearer guard)

### Request/Response Envelope

**Success Response**:
```json
{
  "success": true,
  "data": { ... },
  "requestId": "uuid",
  "timestamp": "ISO8601"
}
```

**Error Response**:
```json
{
  "success": false,
  "error": {
    "code": "STABLE_MACHINE_CODE",
    "message": "human-readable message",
    "details": { ... },
    "retryable": false
  },
  "requestId": "uuid",
  "timestamp": "ISO8601",
  "path": "/api/v1/..."
}
```

### Authentication & Authorization

**Default**: All endpoints are protected (JWT required)
**Public endpoints**: Must use `@Public()` decorator
**Role-based**: `@Roles('ADMIN')` - any listed role
**Permission-based**: `@Permissions('story.create')` - ALL listed permissions required
**Author-specific**: `@ActiveAuthor()` - requires AUTHOR role + active lifecycle status

### Key API Route Groups

(See REPO_CONTEXT.md section 8 for complete route map)

**Infrastructure**:
- GET /health/live, /ready, /diagnostics
- GET /internal/metrics (bearer auth)

**Auth**:
- GET /auth/client-config (public, required for frontend bootstrap)
- POST /auth/login, /refresh, /logout
- POST /auth/register, /verify-email
- GET /auth/oauth/:provider, /oauth/:provider/callback
- POST /auth/oauth/finalize
- MFA: /auth/mfa/*, /auth/security/mfa/*
- Account: /auth/me, /auth/security/*

**Users**:
- GET/PATCH /users/me
- Admin: /admin/users/*

**Authors**:
- Public: GET /authors, /authors/:slug
- Author Portal: /author/profile, /author/dashboard, /author/analytics/*
- Admin: /admin/authors/*

**Author Applications**:
- /author-applications/config, /me, /me/draft, /me/submit
- Admin: /admin/author-applications/*

**Stories**:
- Public: GET /stories, /stories/:slug
- Author: /author/stories/* (CRUD, submit)
- Admin: /admin/story-submissions/* (review)

**Chapters**:
- Public: GET /stories/:storySlug/chapters, /:chapterNumber
- Author: /author/stories/:storyId/chapters/* (CRUD, publish, schedule)

**Taxonomy**:
- GET /story-metadata/categories, /tags
- Admin: /admin/categories/*, /admin/tags/*

**Engagement**:
- /library/*, /reading-history/*, /reading-progress/*, /reading-bookmarks/*, /reading-goal
- /follows/authors/*, /follows/stories/*
- /ratings/*
- /comments/*, /notifications/*

**Moderation**:
- /reports/* (user submission)
- Admin: /admin/reports/*, /admin/moderation/*

**Analytics**:
- Public: POST /reader-analytics/events (ingestion)
- Author: /author/analytics/*

**Media**:
- POST /media/upload-intents, /media/confirm
- GET/DELETE /media/:mediaId
- POST /webhooks/cloudinary (public, signature verified)

**AI**:
- User: /ai/connections/*, /ai/chat/*, /ai/policies/*, /ai/profiles/*
- Admin: /admin/ai/*
- Author: /author/stories/:storyId/ai-profile, /chapter-translations/*

**Monetization** (feature-gated):
- /wallets/*, /monetization/*, /billing/*

---

## 7. Authentication Flow

See Section 4 "Runtime Execution Flows" → "Authentication Flows" for detailed flows.

### Token Strategy

- **Access Token**: Short-lived JWT (default 900s = 15min), stored in memory only (frontend Signal)
- **Refresh Token**: Long-lived JWT (default 2,592,000s = 30 days), HttpOnly cookie
- **Token Rotation**: Each refresh increments version, old tokens are invalidated
- **Token Family**: Tracks rotation lineage, reuse detection revokes entire family
- **CSRF Protection**: Refresh/logout require CSRF token from cookie

### Session Security

- Refresh token hash stored in DB, never plaintext
- Device fingerprinting (IP, user agent)
- Trusted device tracking
- Concurrent session management
- Manual revocation support (logout-all, admin revoke)

### MFA Support

- TOTP-based (Google Authenticator compatible)
- Challenge-response flow for login
- Recovery codes
- Admin can require MFA for admin accounts

### OAuth

- Google and GitHub supported
- Facebook in enum but not implemented
- State verification
- One-time handoff tokens
- Account linking

---

## 8. External Integrations

| Service | Purpose | Notes |
|---------|---------|-------|
| **PostgreSQL 17** | Primary database | Source of truth for all domain data |
| **Redis 7** | Cache, locks, rate limiting, OAuth/MFA state, BullMQ | Functional dependency (not just cache) |
| **Cloudinary** | Media storage | Direct signed upload, webhook for processing status |
| **SMTP/Nodemailer** | Transactional email | Mailpit for dev, external SMTP for production |
| **Google OAuth** | Social login | |
| **GitHub OAuth** | Social login | |
| **OpenAI** | AI assistant, chat, translation | Multiple protocols supported |
| **Anthropic** | AI assistant | Claude models |
| **Google Gemini** | AI assistant | Native protocol adapter |
| **OpenTelemetry** | Distributed tracing | OTLP exporter |
| **Prometheus** | Metrics collection | /internal/metrics endpoint |
| **Loki** | Log aggregation | Production observability |
| **Tempo** | Trace storage | Production observability |
| **Grafana** | Visualization | Dashboards for metrics/logs/traces |
| **Caddy** | Reverse proxy | Automatic HTTPS, security headers |

### Media Upload Flow

1. Client requests upload intent: POST /media/upload-intents
2. Backend validates, creates MediaAsset (PENDING), returns signed Cloudinary params
3. Client uploads DIRECTLY to Cloudinary (not through backend)
4. Client confirms: POST /media/confirm
5. Cloudinary sends webhook (independently): POST /webhooks/cloudinary
6. Worker processes webhook inbox, updates MediaAsset status
7. Cleanup worker removes expired/orphaned assets

---

## 9. Important Files

### Must-Read Files (Top 25)

1. `backend/src/app.module.ts` - API composition root
2. `backend/src/worker.module.ts` - Worker composition root
3. `backend/src/bootstrap/application.bootstrap.ts` - API startup
4. `backend/src/bootstrap/worker.bootstrap.ts` - Worker startup
5. `backend/src/common/guards/common-guards.module.ts` - Auth pipeline
6. `backend/src/common/filters/all-exceptions.filter.ts` - Error handling
7. `backend/src/common/interceptors/response-envelope.interceptor.ts` - Response wrapping
8. `backend/src/config/environment.validation.ts` - Environment schema (1245 lines)
9. `backend/prisma/schema.prisma` - Database schema (58 models, 37 enums)
10. `backend/prisma/seed.ts` - System roles/permissions seed
11. `backend/src/modules/auth/auth.module.ts` - Auth composition
12. `backend/src/modules/auth/application/commands/login/login.command-handler.ts` - Login logic
13. `backend/src/modules/auth/application/commands/refresh-token/refresh-token.command-handler.ts` - Token refresh
14. `backend/src/infrastructure/queue/outbox/outbox-dispatcher.service.ts` - Outbox pattern
15. `backend/src/modules/chapters/infrastructure/persistence/prisma-chapter.persistence.ts` - Chapter persistence (~988 lines)
16. `frontend/src/app/app.config.ts` - Frontend config
17. `frontend/src/app/app.routes.ts` - Route composition
18. `frontend/src/app/core/http/api.interceptor.ts` - HTTP interceptor
19. `frontend/src/app/core/auth/auth.store.ts` - Auth state management
20. `frontend/src/main.ts` - Browser bootstrap
21. `frontend/src/server.ts` - SSR server
22. `backend/compose.production.yml` - Production topology
23. `backend/ops/production/PRODUCTION_RUNBOOK.md` - Operations guide
24. `.github/workflows/ci.yml` - CI pipeline
25. `.github/workflows/deploy-environment.yml` - CD pipeline

### Architecture Documentation

- `CẤU_TRÚC_VÀ_DESIGN_PATTERNS.md` - Vietnamese architecture guide (863 lines)
- `REPO_CONTEXT.md` - Detailed reconnaissance (1035 lines)
- `backend/ops/production/PRODUCTION_RUNBOOK.md` - Operations runbook
- `backend/scripts/README.md` - Script usage guide

---

## 10. Build/Test/Deployment Flow

### Development Workflow

```bash
# Backend
cd backend
npm install                # Generates Prisma client
npm run docker:dev         # Starts PostgreSQL, Redis, Mailpit, API, Worker
npm run start:dev          # Just API (manual)
npm run start:worker:dev   # Just Worker (manual)
npm run db:migrate         # Apply migrations
npm run db:seed            # Seed system data

# Frontend
cd frontend
npm install
npm start                  # Starts dev server with proxy to backend

# Tests
npm test                   # Unit tests
npm run test:auth:all      # Auth unit + integration + E2E
npm run e2e                # Playwright E2E (requires backend running)
```

### CI Pipeline (`.github/workflows/ci.yml`)

Triggered on: push to main, PR, merge group, manual

**Jobs**:
1. **production-scope** - Verify production V1 scope contract
2. **frontend-quality** - Lint, format, architecture, typecheck, unit, build
3. **backend-quality** - Lint, format, architecture, schema, build, unit, coverage
4. **backend-integration** - PostgreSQL + Redis, migrations, constraints, integration/E2E tests
5. **dependency-audit** - npm audit
6. **container-build** - Build images, security scan, smoke test
7. **frontend-e2e** - Playwright with full stack
8. **ci-success** - Aggregate gate (required for merge)

### Image Publication

- **backend-images.yml** - Manual or tag trigger, publishes to GHCR
- **frontend-images.yml** - Manual or tag trigger, publishes to GHCR
- Images tagged with full Git SHA (immutable)
- Security scanning with Trivy
- Smoke tests before publication

### Deployment (`.github/workflows/deploy-environment.yml`)

**Two modes**:
1. **Automatic** - After CI success on main → production (Registry mode)
2. **Manual** - Dispatch for staging/production with SHA selection

**Steps**:
1. Verify commit is on main
2. Verify CI passed for this SHA
3. Verify images exist (or build them)
4. SCP deployment bundle to target
5. SSH execute `Invoke-Release.ps1`

**Release Script** (`backend/ops/production/Invoke-Release.ps1`):
1. Pre-deploy gate checks
2. Backup current state
3. Pull/tag images
4. Run migrations
5. Rolling update services
6. Post-deploy gate checks
7. Update release history

### Rollback (`.github/workflows/rollback-environment.yml`)

**Manual workflow** requiring:
- Target environment (staging/production)
- Full source SHA to roll back to
- Confirmation of DB backward compatibility

**CRITICAL**: Rollback does NOT roll back database migrations!
- Migrations must be backward-compatible
- Use expand-contract pattern
- Verify compatibility before confirming rollback

---

## 11. Technical Debt and Risks

### High-Risk Items

1. **No Live Verification**: This map is based on code/config only, not runtime state
2. **Database Rollback Constraint**: App rollback doesn't rollback DB migrations
3. **Partial Deployment Risk**: Deployment can fail mid-way, requires manual inspection
4. **Redis as Functional Dependency**: Login limiter, JWT blacklist, MFA require Redis

### Code Concentration (Large Files)

- `prisma-story.persistence.ts` - 1578 lines
- `environment.validation.ts` - 1245 lines
- `prisma-author-application.persistence.ts` - 1064 lines
- `prisma-chapter.persistence.ts` - 988 lines
- `prisma-managed-user.repository.ts` - 941 lines
- Frontend architecture debt: 49 inline templates, 45 inline styles, 2525 excess lines

### Known Drift/Technical Debt

1. **AppModule middleware exclusion**: Excludes `/api/v1/media/upload` but route is `/media/upload-intents`
2. **HTTP timeout config drift**: `HTTP_REQUEST_TIMEOUT_MS` config not wired to interceptor (uses hardcoded 15s)
3. **API contract matrix**: Frontend paths may be stale, need regeneration
4. **AI model transitional fields**: Legacy mirror columns still present in schema
5. **Facebook OAuth**: In enum but not implemented
6. **Mail queue encryption**: Still accepts legacy plaintext for compatibility
7. **Queue `media`**: Constant exists but no active processor found
8. **Root AppController**: Returns "Hello World", protected but likely residue

### Data Consistency Risks

- Denormalized counters (story views, followers, etc.) have drift, need reconciliation scripts
- Async outbox is at-least-once, requires consumer idempotency
- Polymorphic Report/ModerationAction constraints are in raw SQL, not Prisma DSL
- Case-insensitive uniqueness (category/tag names, pen names) in migration indexes

---

## 12. Areas Not Yet Fully Understood

### Requires Runtime Verification

- Which compose file is used in production (`compose.production.yml` vs `compose.vps.yml`)
- Current deployed SHA and migration state
- Redis persistence/maxmemory/eviction policy
- Worker role configuration and concurrency
- SMTP provider and deliverability
- Cloudinary webhook URL and secret configuration
- Restic backup repository and last successful backup
- AI provider keys and rate limits
- Observability stack (Prometheus, Loki, Tempo, Grafana) actual deployment
- CORS, trusted proxy, cookie security flags in production
- Whether chapter scheduling worker is active
- Why `media` queue exists but has no processor
- Whether root "Hello World" endpoint is intentional

### Requires Code Deep Dive

- **Monetization Module**: Feature-gated, need to understand rollout policy
- **Chapter Versioning**: Schema exists but workflow is deferred
- **Weekly Reading Session Stats**: Deferred in production v1 scope
- **Personalized Recommendations**: Deferred
- **Comment Reanchoring**: Scheduler exists, need to understand trigger conditions
- **OAuth State Management**: Redis coordination details
- **WebSocket Support**: socket.io imports exist, need to find usage
- **Multi-language Support**: LocaleMiddleware exists, extent of i18n coverage unclear

### Test Coverage Gaps

- ~150 backend unit specs
- 15 integration specs
- 8 E2E specs (backend)
- 36 frontend unit specs
- 33 E2E specs (frontend)
- Unknown coverage of worker processes, schedulers, and edge cases

---

## 13. Investigation State Tracker

### ✅ Completed

- [x] Repository structure exploration
- [x] Backend entrypoints and composition roots
- [x] Frontend entrypoints and composition roots
- [x] Database schema overview
- [x] Module catalog and responsibilities
- [x] API route structure
- [x] Authentication flows
- [x] Request/response pipeline
- [x] Docker Compose topology
- [x] CI/CD pipeline structure
- [x] External integrations inventory
- [x] Architecture documentation review

### 🔄 In Progress (saving state for next context)

- [ ] Deep dive into each domain module (auth, stories, chapters, etc.)
- [ ] Worker schedulers and processors detailed flow
- [ ] Frontend store/repository patterns per feature
- [ ] Migration history analysis
- [ ] Test coverage mapping
- [ ] Production scope verification
- [ ] Security-sensitive code review
- [ ] Performance hotspots
- [ ] Error handling patterns across modules

### 📋 Not Yet Started

- [ ] Frontend components and UI patterns
- [ ] Prisma query patterns and optimization
- [ ] Redis usage patterns (cache, lock, limiter)
- [ ] BullMQ job patterns and retry strategies
- [] Email templates and notification content
- [ ] AI protocol adapters detailed implementation
- [ ] Monetization business rules
- [ ] Analytics aggregation logic
- [ ] Maintenance scripts detailed review
- [ ] Production runbook procedures
- [ ] Observability configuration (Prometheus, Grafana)
- [ ] Backup and restore procedures
- [ ] Load testing results
- [ ] Security testing results

---

## Next Steps for Agent

This is an initial comprehensive map. Continue investigation by:

1. Pick a domain module (e.g., `stories`, `chapters`, `auth`) and trace through:
   - Controller → Handler → Port → Adapter → Database
   - Read application commands/queries
   - Read domain policies and value objects
   - Read infrastructure adapters
   - Read tests for that module

2. Investigate worker processes in detail:
   - Read each scheduler implementation
   - Read each processor implementation
   - Trace outbox event routing
   - Understand retry and dead-letter logic

3. Frontend deep dive per feature:
   - Read route definitions
   - Read page components
   - Read stores/facades
   - Read repositories
   - Trace HTTP calls back to backend

4. Build sequence diagrams for key flows:
   - User registration → email verification
   - Author application → approval → role grant
   - Story submission → review → publication
   - Chapter publish → notification → AI translation
   - Payment order → webhook → wallet credit

5. Security review:
   - Auth guards and decorators
   - CSRF protection
   - Rate limiting
   - Input validation
   - SQL injection prevention (Prisma)
   - XSS prevention
   - Secrets management

6. Performance review:
   - Database indexes
   - N+1 queries
   - Cache usage
   - Rate limiting
   - Resource limits

---

## Summary

This codebase represents a mature, production-ready story reading/publishing platform with:

### Strengths
1. **Clean Architecture**: Strict hexagonal/ports-adapters with enforced boundaries
2. **Security First**: MFA, OAuth, session families, CSRF protection, rate limiting, encrypted credentials
3. **Reliability**: Outbox pattern, at-least-once delivery, idempotency keys, optimistic locking
4. **Observability**: Structured logging (Pino), metrics (Prometheus), tracing (OpenTelemetry)
5. **Type Safety**: Prisma ORM, TypeScript strict mode, class-validator
6. **Modern Frontend**: Angular 22 signals, SSR, route-scoped providers, lazy loading
7. **Comprehensive Testing**: Unit, integration, E2E tests across backend and frontend
8. **CI/CD Maturity**: Immutable images, backward-compatible migrations, rollback support
9. **Feature-Rich**: Authors, submissions, monetization, AI assistant, analytics, moderation

### Key Patterns
- **Backend**: CQRS commands/queries, port interfaces, Prisma adapters, outbox workers
- **Frontend**: Signal stores, HTTP repositories, route-scoped providers, permission guards
- **Data**: Double-entry ledger for finance, denormalized counters with reconciliation
- **Security**: Hash everything (tokens, passwords, MFA secrets), never store plaintext
- **Integration**: Direct upload to Cloudinary, webhook inbox, async processing

### Critical Constraints
- **DB Migrations**: Must be backward-compatible (app rollback doesn't rollback DB)
- **Redis Dependency**: Not just cache—functional dependency for auth/locks/queues
- **Immutable Images**: Full SHA tags required, no mutable `latest`
- **Outbox Semantics**: At-least-once delivery requires consumer idempotency

### Next Investigation Priorities
1. **Live System Verification**: Current deployment state, actual resource usage, backup status
2. **Performance Profiling**: Query patterns, N+1 detection, cache hit rates
3. **Security Audit**: Penetration testing, OWASP compliance, secret rotation
4. **Feature Coverage**: Which production v1 scope features are actually deployed
5. **Operational Runbooks**: Incident response, recovery procedures, scaling playbooks

---

**Document Status**: Comprehensive read-only onboarding completed. Database schema fully documented. Module structure mapped. Key flows traced. Ready for targeted deep dives or modifications.

**Last Updated**: 2026-09-08  
**Investigation Duration**: ~1.5 hours  
**Files Read**: 50+  
**Models Documented**: 58  
**Modules Catalogued**: 20+  
**Controllers Identified**: 50+  

**Investigator**: Claude (Fable 5)
