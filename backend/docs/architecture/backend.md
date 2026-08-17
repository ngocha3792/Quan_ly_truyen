# Backend architecture

The backend is migrated incrementally toward modular Clean Architecture. Each business module owns its use cases and is split by dependency direction rather than by technical type alone.

## Target module shape

```text
src/modules/<module>/
├── application/
│   ├── commands/
│   ├── queries/
│   ├── dto/
│   ├── mappers/
│   └── ports/
├── domain/
│   ├── entities/
│   ├── value-objects/
│   ├── policies/
│   ├── events/
│   └── exceptions/
├── infrastructure/
│   ├── persistence/
│   ├── cache/
│   └── integrations/
├── presentation/
│   └── http/
│       ├── controllers/
│       ├── requests/
│       └── responses/
├── <module>.module.ts
└── index.ts
```

Only create folders that the module actually needs. Empty folders are not an architectural requirement.

## Dependency direction

```text
presentation ---> application ---> domain
                     ^              ^
                     |              |
                 infrastructure ----+
```

Rules:

- `domain` must not import NestJS, Prisma, Redis, queues, HTTP code, or infrastructure adapters.
- `application` may use NestJS dependency-injection decorators, but it must not import Prisma or concrete infrastructure adapters. External work is described through application ports.
- `infrastructure` implements application/domain ports and may use Prisma, Redis, BullMQ, Cloudinary, and other external libraries.
- `presentation` translates HTTP input/output and calls application use cases. It must not query Prisma directly.
- `<module>.module.ts` is the composition root for wiring ports to adapters.
- One module must not import another module's infrastructure or private handlers. Cross-module interaction must go through an explicitly exported contract/port or an event.

## Commands and queries

- Command: changes state.
- Query: reads state.
- A handler should represent one use case. Avoid growing new god services that mix unrelated operations.

## Ports and adapters

Ports describe what a use case needs, not a mirror of a vendor SDK or Prisma client.

Good:

```ts
export interface RatingPersistencePort {
  findMine(userId: string, storyId: string): Promise<StoryRatingResultDto | null>;
  upsert(input: UpsertRatingInput): Promise<UpsertRatingResult>;
  deleteMine(userId: string, storyId: string): Promise<void>;
}
```

Bad:

```ts
export interface PrismaPort {
  story: unknown;
  rating: unknown;
  user: unknown;
}
```

## Incremental migration guard

Run:

```bash
npm run architecture:check
```

The guard rejects new `domain -> framework/infrastructure` and `application -> infrastructure/Prisma` dependencies. Existing application violations are explicitly baselined in `scripts/architecture/check-boundaries.mjs` so the repository can be improved slice by slice without accepting new debt. When a legacy violation is fixed, remove its baseline entry in the same change.

## Refactor rule

Architectural refactors preserve externally observable behavior unless a separate feature change explicitly says otherwise. Keep HTTP routes, request/response contracts, authorization behavior, and database schema stable during module extraction.

## Folder policy: structure is semantic, not a checklist

The four top-level layers (`application`, `domain`, `infrastructure`, `presentation`) are the architectural boundary. Their child folders are created only when the module has code with that responsibility.

Examples:

- Create `domain/entities` only when the module has domain entities. Do not add placeholder entities just to fill the tree.
- Create `domain/events` only when the module publishes domain events.
- Create `domain/repositories` only when a domain-level repository abstraction is genuinely required. Most persistence needs in this codebase are application ports under `application/ports`.
- Create `infrastructure/cache` or `infrastructure/search` only when the module owns a cache/search adapter.
- Create `application/mappers` only when there is an actual mapping boundary.
- Never commit empty folders or `.gitkeep` files purely to make every module visually identical.

A healthy module can therefore be smaller than the full reference tree while still following the same architecture. The reference tree describes allowed responsibilities, not mandatory empty directories.

## Migration status

The incremental extraction currently separates these responsibilities from `stories`:

- ratings -> `modules/ratings`
- libraries -> `modules/libraries`
- reading history -> `modules/reading-history`
- comments -> `modules/comments`
- chapter lifecycle and public chapter reader -> `modules/chapters`

`StoriesModule` now owns story lifecycle/publication/metadata only. Legacy internals inside other modules are cleaned in later passes without changing HTTP contracts or the Prisma schema.

### Module ownership after phases 8-11

The next extraction pass also establishes these ownership boundaries:

- categories -> `modules/categories` (admin category lifecycle and hierarchy)
- tags -> `modules/tags` (admin tag lifecycle and merge)
- author follow relationships -> `modules/follows`
- report review/closure -> `modules/reports`
- comment/user enforcement actions remain -> `modules/moderation`
- media upload/query/cleanup/webhook capability -> `modules/media`

`modules/taxonomy` is removed: category and tag only shared a CRUD-shaped implementation, not one business lifecycle. `AuthorFollowService` is removed from `authors`; the author module still owns author profile/lifecycle and follower counters are treated as denormalized data maintained by the follows persistence adapter.

`src/infrastructure/media` is removed. Cloudinary and disabled-storage implementations now live under `modules/media/infrastructure`, while HTTP controllers/DTOs live under `modules/media/presentation` and storage contracts live under `modules/media/application/ports`.

The media module still contains explicitly baselined legacy application-to-Prisma/observability dependencies. Those are intentionally left for the following dependency-cleanup phase instead of hiding a behavior change inside the ownership move. New violations remain rejected by `npm run architecture:check`.

### Dependency cleanup after phase 11 (phase 12A + phase 13 slice)

The first dependency-cleanup slice removes concrete infrastructure access from these application paths without changing HTTP contracts or the Prisma schema:

- `audit-logs/application` now depends on repository and metrics ports; Prisma and `MetricsService` live behind infrastructure adapters.
- comment abuse protection now depends on a rate-limit store, metrics port, and recent-comment reader; Redis/Prisma/observability stay in `comments/infrastructure`.
- `moderation/application` now orchestrates moderation policy through persistence/metrics ports instead of importing Prisma or observability directly.
- moderation no longer imports private handlers/enums from `users`. `UsersModule` exports the explicit `USER_MODERATION_PORT` public contract and owns the adapter that reuses the managed-user status use case.
- admin user security now depends on `ADMIN_USER_SECURITY_PERSISTENCE_PORT`; Prisma transaction/audit details live in the auth infrastructure adapter.

The architecture baseline is reduced from 38 to 25 tracked legacy violations. The remaining baseline is intentionally limited to the later cleanup slices for media, authors, analytics, and the legacy comment interaction service. New violations are still rejected immediately.
