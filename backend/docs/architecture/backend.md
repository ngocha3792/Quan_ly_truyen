# Backend architecture

The backend currently uses modular Clean Architecture across 19 business modules. The architecture guard is a hard CI contract: there is no legacy exception baseline.

## Canonical module shape

Every module must keep the canonical directories below because `npm run architecture:check` verifies their presence.

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
│   ├── enums/
│   ├── events/
│   ├── exceptions/
│   ├── policies/
│   ├── repositories/
│   └── value-objects/
├── infrastructure/
│   ├── persistence/
│   ├── cache/
│   └── search/
├── presentation/
│   └── http/
│       ├── controllers/
│       ├── requests/
│       └── responses/
├── <module>.module.ts
└── index.ts
```

A canonical directory may contain only its barrel/index file until that responsibility is needed. Do not invent placeholder business classes merely to fill the tree.

## Dependency direction

```text
presentation ---> application ---> domain
                     ^              ^
                     |              |
                 infrastructure ----+
```

Rules enforced by the guard:

- `domain` must not import NestJS, Prisma/generated Prisma, infrastructure adapters, Redis, queues, or HTTP code.
- `application` may use NestJS DI decorators, but must not import generated Prisma or concrete infrastructure. External work is described through ports.
- `presentation` translates HTTP contracts and calls application use cases. It must not import infrastructure adapters **or generated Prisma types/enums**.
- `infrastructure` implements ports and is the only business-module layer allowed to depend directly on Prisma, Redis, BullMQ, Cloudinary, and vendor SDKs.
- `<module>.module.ts` is the composition root that binds ports to adapters.
- Cross-module imports must go through the target module's public root contract. Importing another module's internal handler/adapter is forbidden.
- Application use cases live under commands/queries; new `application/services` and service-centric application classes are forbidden.

## Enum and persistence mapping rule

Database enums belong to the persistence adapter, not HTTP or application contracts.

Preferred flow:

```text
HTTP request
  -> domain/application-owned string union or value list
  -> command/query input
  -> infrastructure mapper/adapter
  -> Prisma enum
```

This keeps Prisma schema changes from leaking into controller DTOs or use-case contracts.

## Commands and queries

- Command: changes state.
- Query: reads state.
- A handler represents one use case.
- Do not grow god services that combine unrelated orchestration.

## Ports and adapters

Ports describe the capability a use case needs, not a vendor API mirror.

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

## Architecture guard

Run from `backend/`:

```bash
npm run architecture:check
```

Expected result:

```text
Architecture boundaries OK (19 modules, canonical folders enforced, 0 legacy exceptions).
```

The guard rejects:

- missing canonical module directories;
- controllers/requests/responses outside their canonical HTTP folders;
- `application/services` and application `*Service` use cases;
- domain dependencies on framework/infrastructure/Prisma;
- application dependencies on infrastructure/Prisma;
- presentation dependencies on infrastructure/generated Prisma;
- cross-module imports that bypass a module's public root contract.

Do not add exceptions or raise a baseline to make CI green. Fix the dependency direction instead.

## Refactor discipline

Architecture refactors preserve externally observable behavior unless the same change explicitly introduces a product contract change. Keep routes, authorization semantics, response envelopes, and database migrations intentional and reviewable.

The Production V1 API wiring contract is tracked separately in `ops/production/API_CONTRACT_MATRIX.md` and checked by `node ../scripts/verify-api-contracts.mjs`.
