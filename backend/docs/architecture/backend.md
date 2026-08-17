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
