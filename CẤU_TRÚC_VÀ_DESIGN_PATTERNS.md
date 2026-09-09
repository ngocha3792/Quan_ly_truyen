# Cấu trúc Folder và Design Patterns - TruyenHub

> Tài liệu này giúp bạn hiểu cách tổ chức code và các design patterns được sử dụng để tránh nhầm lẫn khi phát triển.

---

## 📁 I. TỔNG QUAN CẤU TRÚC MONOREPO

```
Quan-ly-truyen/
├── backend/              # NestJS API + Worker
│   ├── src/             # Source code chính
│   ├── prisma/          # Database schema & migrations
│   ├── test/            # Integration & E2E tests
│   ├── scripts/         # Maintenance & ops scripts
│   ├── ops/             # Production configs (Caddy, runbook)
│   └── docker/          # Docker compose cho dev
│
├── frontend/            # Angular 22 + SSR
│   ├── src/
│   │   ├── app/        # Application code
│   │   └── server.ts   # SSR entry point
│   └── e2e/            # Playwright E2E tests
│
├── .github/            # CI/CD workflows
└── node_modules/       # Dependencies (gitignored)
```

---

## 🏗️ II. BACKEND ARCHITECTURE - Ports & Adapters (Hexagonal)

### 1. Cấu trúc thư mục Backend

```
backend/src/
├── main.ts                    # API process entry point
├── worker.ts                  # Worker process entry point
├── app.module.ts             # Root module của API
├── worker.module.ts          # Root module của Worker
│
├── bootstrap/                # Bootstrap logic
│   ├── application.bootstrap.ts
│   ├── worker.bootstrap.ts
│   ├── security.bootstrap.ts
│   └── swagger.bootstrap.ts
│
├── config/                   # Configuration schemas
│   ├── app.config.ts
│   ├── auth.config.ts
│   ├── database.config.ts
│   └── environment.validation.ts
│
├── common/                   # Shared utilities
│   ├── constants/           # App-wide constants
│   ├── decorators/          # Custom decorators
│   ├── exceptions/          # Domain exception classes
│   ├── filters/             # Exception filters
│   ├── guards/              # Auth guards (JWT, Roles, Permissions)
│   ├── interceptors/        # HTTP interceptors
│   ├── middlewares/         # Middleware
│   ├── pipes/               # Validation pipes
│   └── utils/               # Utility functions
│
├── infrastructure/          # Technical capabilities
│   ├── database/           # Prisma module
│   ├── cache/              # Redis cache
│   ├── queue/              # BullMQ + Outbox
│   ├── mail/               # Email sending
│   ├── health/             # Health checks
│   └── observability/      # Metrics, logging, tracing
│
├── modules/                # Domain modules (features)
│   ├── auth/
│   ├── users/
│   ├── stories/
│   ├── chapters/
│   ├── comments/
│   └── ...
│
└── generated/              # Generated code
    └── prisma/            # Prisma client (gitignored)
```

### 2. Cấu trúc CHUẨN của một Domain Module

**⚠️ ĐÂY LÀ PATTERN QUAN TRỌNG NHẤT - HÃY TÔN TRỌNG ĐÚNG CẤU TRÚC NÀY!**

```
modules/<feature>/
│
├── <feature>.module.ts              # NestJS module definition
├── index.ts                         # Public exports (cross-module interface)
│
├── application/                     # Use cases (business logic orchestration)
│   ├── commands/                   # Write operations (CQRS Command)
│   │   ├── create-story/
│   │   │   ├── create-story.command.ts           # Command DTO
│   │   │   ├── create-story.command-handler.ts   # Handler logic
│   │   │   ├── create-story.command-handler.spec.ts
│   │   │   └── index.ts
│   │   ├── update-story/
│   │   └── ...
│   │
│   ├── queries/                    # Read operations (CQRS Query)
│   │   ├── get-story/
│   │   │   ├── get-story.query.ts
│   │   │   ├── get-story.query-handler.ts
│   │   │   ├── get-story.query-handler.spec.ts
│   │   │   └── index.ts
│   │   ├── list-stories/
│   │   └── ...
│   │
│   ├── dto/                        # Data Transfer Objects (results)
│   │   ├── story-result.dto.ts
│   │   └── public-story-result.dto.ts
│   │
│   ├── mappers/                    # Domain <-> DTO mapping
│   │   └── story-result.mapper.ts
│   │
│   ├── ports/                      # Interfaces (dependency inversion)
│   │   ├── story.persistence.port.ts      # Port interface
│   │   └── story.reader.port.ts
│   │
│   └── index.ts                    # Application layer exports
│
├── domain/                         # Pure business logic (NO framework dependencies)
│   ├── entities/                  # Domain entities
│   │   └── story.entity.ts
│   │
│   ├── value-objects/             # Immutable value objects
│   │   └── story-fields.value-object.ts
│   │
│   ├── enums/                     # Domain enums
│   │   └── story-status.enum.ts
│   │
│   ├── events/                    # Domain events
│   │   └── story-published.event.ts
│   │
│   ├── exceptions/                # Domain-specific exceptions
│   │   └── story.exceptions.ts
│   │
│   ├── policies/                  # Business rules
│   │   └── story-draft.policy.ts
│   │
│   ├── repositories/              # Repository interfaces (not implementation!)
│   │   └── story.repository.ts
│   │
│   └── index.ts
│
├── infrastructure/                # Technical implementations
│   ├── persistence/              # Database adapters
│   │   ├── prisma-story.persistence.ts        # Implements ports
│   │   └── prisma-story.reader.ts
│   │
│   ├── cache/                    # Redis cache adapters
│   │   └── story-cache.adapter.ts
│   │
│   ├── queue/                    # Queue processors
│   │   └── story-notification.processor.ts
│   │
│   ├── external-adapters/        # Third-party integrations
│   │   └── cloudinary-story.adapter.ts
│   │
│   └── index.ts
│
└── presentation/                  # Interface layer
    └── http/                     # HTTP controllers
        ├── controllers/
        │   ├── public-stories.controller.ts     # Public API
        │   ├── author-stories.controller.ts     # Author API
        │   └── admin-stories.controller.ts      # Admin API
        │
        ├── requests/             # Request DTOs (validation)
        │   ├── create-story.request.ts
        │   └── update-story.request.ts
        │
        ├── responses/            # Response DTOs
        │   ├── story.response.ts
        │   └── public-story.response.ts
        │
        └── index.ts
```

---

## 🎯 III. DESIGN PATTERNS CHÍNH

### Pattern 1: CQRS (Command Query Responsibility Segregation)

**Commands** = Mutations (Write operations)
```typescript
// Command DTO
export class CreateStoryCommand {
  constructor(
    public readonly authorId: string,
    public readonly title: string,
    public readonly synopsis: string,
  ) {}
}

// Command Handler
@CommandHandler(CreateStoryCommand)
export class CreateStoryCommandHandler {
  constructor(
    @Inject(STORY_PERSISTENCE_PORT)
    private readonly storyPersistence: StoryPersistencePort,
  ) {}

  async execute(command: CreateStoryCommand): Promise<CreateStoryResult> {
    // Business logic here
    const result = await this.storyPersistence.create({...});
    return result;
  }
}
```

**Queries** = Reads (Read operations)
```typescript
// Query DTO
export class GetStoryQuery {
  constructor(public readonly slug: string) {}
}

// Query Handler
@QueryHandler(GetStoryQuery)
export class GetStoryQueryHandler {
  constructor(
    @Inject(STORY_READER_PORT)
    private readonly storyReader: StoryReaderPort,
  ) {}

  async execute(query: GetStoryQuery): Promise<StoryDto> {
    return this.storyReader.findBySlug(query.slug);
  }
}
```

### Pattern 2: Ports & Adapters (Dependency Inversion)

**Port** = Interface (trong application/ports/)
```typescript
// application/ports/story.persistence.port.ts
export const STORY_PERSISTENCE_PORT = Symbol('STORY_PERSISTENCE_PORT');

export interface StoryPersistencePort {
  create(input: CreateStoryInput): Promise<CreateStoryResult>;
  update(input: UpdateStoryInput): Promise<UpdateStoryResult>;
  delete(id: string): Promise<void>;
}
```

**Adapter** = Implementation (trong infrastructure/persistence/)
```typescript
// infrastructure/persistence/prisma-story.persistence.ts
@Injectable()
export class PrismaStoryPersistence implements StoryPersistencePort {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateStoryInput): Promise<CreateStoryResult> {
    try {
      const story = await this.prisma.story.create({...});
      return { id: story.id, slug: story.slug };
    } catch (error) {
      throw mapPrismaError(error);
    }
  }
  // ...
}
```

**Wiring trong Module**
```typescript
// stories.module.ts
@Module({
  providers: [
    PrismaStoryPersistence,  // Concrete implementation
    {
      provide: STORY_PERSISTENCE_PORT,  // Token
      useExisting: PrismaStoryPersistence,  // Bind to token
    },
  ],
})
export class StoriesModule {}
```

### Pattern 3: Controller → Handler → Port → Adapter Flow

```typescript
// 1. HTTP Controller (presentation layer)
@Controller('stories')
export class PublicStoriesController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':slug')
  @Public()
  async getStory(@Param('slug') slug: string) {
    const query = new GetStoryQuery(slug);
    return this.queryBus.execute(query);  // Delegates to handler
  }
}

// 2. Query Handler (application layer)
@QueryHandler(GetStoryQuery)
export class GetStoryQueryHandler {
  constructor(
    @Inject(STORY_READER_PORT) // Depends on PORT, not concrete class
    private readonly reader: StoryReaderPort,
  ) {}

  async execute(query: GetStoryQuery): Promise<StoryDto> {
    return this.reader.findBySlug(query.slug);  // Uses port interface
  }
}

// 3. Adapter (infrastructure layer)
@Injectable()
export class PrismaStoryReader implements StoryReaderPort {
  constructor(private readonly prisma: PrismaService) {}

  async findBySlug(slug: string): Promise<StoryDto> {
    const story = await this.prisma.story.findUnique({
      where: { slug },
    });
    if (!story) throw new ResourceNotFoundException('Story', slug);
    return mapToDto(story);
  }
}
```

### Pattern 4: Domain Policies (Business Rules)

```typescript
// domain/policies/story-draft.policy.ts
export class StoryDraftPolicy {
  static canPublish(story: StoryRecord): boolean {
    if (!story.title || story.title.length < 3) {
      return false;
    }
    if (!story.synopsis || story.synopsis.length < 50) {
      return false;
    }
    if (story.chapters.length === 0) {
      return false;
    }
    return true;
  }

  static validateTransition(from: StoryStatus, to: StoryStatus): void {
    const validTransitions = {
      [StoryStatus.DRAFT]: [StoryStatus.PUBLISHED, StoryStatus.ARCHIVED],
      [StoryStatus.PUBLISHED]: [StoryStatus.ARCHIVED],
      [StoryStatus.ARCHIVED]: [],
    };

    if (!validTransitions[from]?.includes(to)) {
      throw new InvalidStateTransitionException(
        `Cannot transition story from ${from} to ${to}`
      );
    }
  }
}
```

### Pattern 5: Value Objects (Domain-Driven Design)

```typescript
// domain/value-objects/story-fields.value-object.ts
export class StoryFields {
  private constructor(
    public readonly title: string,
    public readonly synopsis: string,
    public readonly slug: string,
  ) {}

  static create(title: string, synopsis: string): StoryFields {
    // Validation
    if (!title || title.trim().length < 3) {
      throw new ValidationException('Title must be at least 3 characters');
    }
    if (!synopsis || synopsis.trim().length < 50) {
      throw new ValidationException('Synopsis must be at least 50 characters');
    }

    const normalizedTitle = title.trim();
    const slug = slugify(normalizedTitle);

    return new StoryFields(normalizedTitle, synopsis.trim(), slug);
  }
}
```

### Pattern 6: Outbox Pattern (Eventual Consistency)

```typescript
// Trong transaction, chỉ ghi DB và outbox event
await this.prisma.$transaction(async (tx) => {
  // 1. Persist domain state
  const story = await tx.story.create({...});

  // 2. Create outbox event (side effect sẽ xử lý async)
  await tx.outboxEvent.create({
    data: {
      aggregateType: 'Story',
      aggregateId: story.id,
      eventType: 'story.published.v1',
      payload: JSON.stringify({
        storyId: story.id,
        authorId: story.authorId,
        title: story.title,
      }),
      status: 'PENDING',
    },
  });
});

// Worker sẽ claim outbox event và xử lý async
// → Gửi notification
// → Trigger AI translation
// → Update analytics
```

---

## 🎨 IV. FRONTEND ARCHITECTURE - Angular Standalone + Feature Slices

### 1. Cấu trúc Frontend

```
frontend/src/app/
├── app.ts                    # Root component
├── app.config.ts            # App configuration
├── app.routes.ts            # Root routes
│
├── core/                    # Core singletons (app-wide)
│   ├── auth/               # Auth state management
│   │   ├── auth.store.ts
│   │   ├── token.store.ts
│   │   └── auth-refresh.service.ts
│   │
│   ├── http/               # HTTP interceptors
│   │   └── api.interceptor.ts
│   │
│   ├── config/             # Runtime config
│   │   └── app-runtime-config.loader.ts
│   │
│   └── guards/             # Route guards
│       └── auth.guard.ts
│
├── shared/                 # Shared utilities
│   ├── components/        # Reusable UI components
│   ├── directives/
│   ├── pipes/
│   └── utils/
│
├── features/              # Feature modules (domain-focused)
│   ├── account/          # User account features
│   ├── admin/            # Admin features
│   ├── author-portal/    # Author studio features
│   └── public/           # Public features (home, catalog, story)
│
└── routes/               # Route configurations
    ├── auth.routes.ts
    ├── account.routes.ts
    ├── admin.routes.ts
    └── public.routes.ts
```

### 2. Feature Structure (Frontend)

**Frontend áp dụng Architecture Layers:**
- **domain**: Models, interfaces (pure TypeScript)
- **data-access**: Services, repositories, state stores
- **ui**: Components (pages + reusable components)

```
features/<feature>/
│
├── domain/                          # Pure models & interfaces
│   ├── models/
│   │   ├── story.model.ts
│   │   └── story-filters.model.ts
│   │
│   ├── enums/
│   │   └── story-status.enum.ts
│   │
│   └── interfaces/
│       └── story-repository.interface.ts
│
├── data-access/                     # Data layer
│   ├── services/
│   │   └── story-api.service.ts    # HTTP calls
│   │
│   ├── stores/                      # State management (Signals)
│   │   └── stories.store.ts
│   │
│   └── repositories/                # Repository pattern
│       └── story.repository.ts
│
├── ui/                              # Presentation layer
│   ├── pages/                      # Routed page components
│   │   ├── story-list-page/
│   │   │   ├── story-list-page.component.ts
│   │   │   ├── story-list-page.component.html
│   │   │   ├── story-list-page.component.scss
│   │   │   └── story-list-page.component.spec.ts
│   │   │
│   │   └── story-detail-page/
│   │
│   └── components/                 # Reusable feature components
│       ├── story-card/
│       └── story-filters/
│
├── <feature>.routes.ts             # Feature routes
└── index.ts                        # Public API
```

### 3. Frontend Design Patterns

#### Pattern A: Signal-based State Store

```typescript
// data-access/stores/stories.store.ts
import { inject, Injectable } from '@angular/core';
import { signal, computed } from '@angular/core';
import { StoryRepository } from '../repositories/story.repository';

export type StoriesState = {
  stories: Story[];
  selectedStory: Story | null;
  loading: boolean;
  error: string | null;
};

@Injectable()
export class StoriesStore {
  private repository = inject(StoryRepository);

  // Private state
  private state = signal<StoriesState>({
    stories: [],
    selectedStory: null,
    loading: false,
    error: null,
  });

  // Public selectors (computed)
  stories = computed(() => this.state().stories);
  selectedStory = computed(() => this.state().selectedStory);
  loading = computed(() => this.state().loading);
  error = computed(() => this.state().error);

  // Actions
  async loadStories(filters: StoryFilters) {
    this.state.update(s => ({ ...s, loading: true, error: null }));
    
    try {
      const stories = await this.repository.list(filters);
      this.state.update(s => ({ ...s, stories, loading: false }));
    } catch (error) {
      this.state.update(s => ({ 
        ...s, 
        loading: false, 
        error: 'Failed to load stories' 
      }));
    }
  }

  async selectStory(slug: string) {
    this.state.update(s => ({ ...s, loading: true }));
    
    const story = await this.repository.getBySlug(slug);
    this.state.update(s => ({ 
      ...s, 
      selectedStory: story, 
      loading: false 
    }));
  }
}
```

#### Pattern B: Repository Pattern (Frontend)

```typescript
// data-access/repositories/story.repository.ts
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { StoryApiService } from '../services/story-api.service';
import { Story, StoryFilters } from '../../domain';

@Injectable()
export class StoryRepository {
  private api = inject(StoryApiService);

  async list(filters: StoryFilters): Promise<Story[]> {
    return firstValueFrom(this.api.listStories(filters));
  }

  async getBySlug(slug: string): Promise<Story> {
    return firstValueFrom(this.api.getStory(slug));
  }

  async create(data: CreateStoryDto): Promise<Story> {
    return firstValueFrom(this.api.createStory(data));
  }
}
```

#### Pattern C: Route-scoped Providers

```typescript
// ui/pages/story-detail-page/story-detail-page.component.ts
import { Component, inject, input } from '@angular/core';
import { StoriesStore } from '../../data-access/stores/stories.store';
import { StoryRepository } from '../../data-access/repositories/story.repository';

@Component({
  selector: 'app-story-detail-page',
  standalone: true,
  templateUrl: './story-detail-page.component.html',
  providers: [
    StoriesStore,      // ✅ Route-scoped - new instance per route
    StoryRepository,
  ],
})
export class StoryDetailPageComponent {
  private store = inject(StoriesStore);
  
  // Route params as signals (Angular 16+)
  slug = input.required<string>();

  story = this.store.selectedStory;
  loading = this.store.loading;

  async ngOnInit() {
    await this.store.selectStory(this.slug());
  }
}
```

---

## ⚠️ V. QUY TẮC QUAN TRỌNG (KHÔNG ĐƯỢC VI PHẠM!)

### Backend Rules

1. **❌ KHÔNG import Prisma trực tiếp trong Application hoặc Domain**
   ```typescript
   // ❌ SAI
   import { PrismaService } from '@/infrastructure/database';
   
   export class CreateStoryHandler {
     constructor(private prisma: PrismaService) {} // ❌ WRONG!
   }
   
   // ✅ ĐÚNG
   @Inject(STORY_PERSISTENCE_PORT)
   private readonly persistence: StoryPersistencePort  // ✅ CORRECT!
   ```

2. **❌ KHÔNG import internals của module khác**
   ```typescript
   // ❌ SAI
   import { PrismaUserRepository } from '@/modules/users/infrastructure/...';
   
   // ✅ ĐÚNG
   import { UsersModule, USER_READER_PORT } from '@/modules/users';
   ```

3. **❌ KHÔNG có logic nghiệp vụ trong Controller**
   ```typescript
   // ❌ SAI
   @Controller('stories')
   export class StoriesController {
     @Post()
     async create(@Body() dto: CreateStoryDto) {
       // ❌ Business logic ở đây là SAI!
       if (dto.title.length < 3) throw new Error('...');
       const slug = slugify(dto.title);
       return this.prisma.story.create({...});
     }
   }
   
   // ✅ ĐÚNG
   @Controller('stories')
   export class StoriesController {
     @Post()
     async create(@Body() dto: CreateStoryDto) {
       const command = new CreateStoryCommand(dto);
       return this.commandBus.execute(command);  // ✅ Delegate!
     }
   }
   ```

4. **❌ Domain Layer KHÔNG phụ thuộc vào Framework**
   ```typescript
   // ❌ SAI - domain có @Injectable
   import { Injectable } from '@nestjs/common';
   
   @Injectable()  // ❌ NO NestJS in domain!
   export class StoryPolicy {}
   
   // ✅ ĐÚNG - pure TypeScript
   export class StoryPolicy {
     static canPublish(story: Story): boolean {
       return story.chapters.length > 0;
     }
   }
   ```

5. **✅ Side effects qua Outbox, KHÔNG đồng bộ trong transaction**
   ```typescript
   // ❌ SAI
   await this.prisma.$transaction(async tx => {
     await tx.story.create({...});
     await this.emailService.send({...});  // ❌ External call in transaction!
   });
   
   // ✅ ĐÚNG
   await this.prisma.$transaction(async tx => {
     await tx.story.create({...});
     await tx.outboxEvent.create({...});  // ✅ Outbox pattern!
   });
   ```

### Frontend Rules

1. **❌ KHÔNG truy cập HttpClient trực tiếp trong components**
   ```typescript
   // ❌ SAI
   export class StoryListComponent {
     constructor(private http: HttpClient) {}
     
     loadStories() {
       this.http.get('/api/v1/stories').subscribe(...);  // ❌ WRONG!
     }
   }
   
   // ✅ ĐÚNG
   export class StoryListComponent {
     private store = inject(StoriesStore);
     
     async loadStories() {
       await this.store.loadStories();  // ✅ Through store!
     }
   }
   ```

2. **❌ KHÔNG vi phạm layer boundaries**
   ```typescript
   // ❌ SAI
   // ui/components/ import data-access/stores/
   import { StoriesStore } from '../../data-access/stores/stories.store';  // ❌ OK
   
   // data-access/ import ui/components/
   import { StoryCard } from '../../ui/components/story-card';  // ❌ WRONG!
   ```

3. **✅ Access token CHỈ lưu trong memory (Signal), KHÔNG localStorage**
   ```typescript
   // ❌ SAI
   localStorage.setItem('accessToken', token);  // ❌ Security risk!
   
   // ✅ ĐÚNG
   this.tokenStore.setAccessToken(token);  // ✅ Signal-based, memory only
   ```

---

## 📚 VI. NAMING CONVENTIONS

### Backend

| Type | Pattern | Example |
|------|---------|---------|
| Command | `<Verb><Noun>Command` | `CreateStoryCommand` |
| Command Handler | `<CommandName>Handler` | `CreateStoryCommandHandler` |
| Query | `<Verb><Noun>Query` | `GetStoryQuery`, `ListStoriesQuery` |
| Query Handler | `<QueryName>Handler` | `GetStoryQueryHandler` |
| Port Token | `<NOUN>_<TYPE>_PORT` | `STORY_PERSISTENCE_PORT` |
| Port Interface | `<Noun><Type>Port` | `StoryPersistencePort` |
| Adapter | `<Tech><Noun><Type>` | `PrismaStoryPersistence` |
| Exception | `<Reason>Exception` | `ResourceNotFoundException` |
| Policy | `<Noun><Policy>` | `StoryDraftPolicy` |
| Value Object | `<Noun>` | `StoryFields`, `EmailAddress` |
| DTO | `<Noun>Dto`, `<Noun>ResultDto` | `StoryDto`, `CreateStoryResultDto` |
| Request DTO | `<Verb><Noun>Request` | `CreateStoryRequest` |
| Response DTO | `<Noun>Response` | `StoryResponse`, `PublicStoryResponse` |

### Frontend

| Type | Pattern | Example |
|------|---------|---------|
| Component | `<noun>-<type>.component.ts` | `story-list-page.component.ts` |
| Service | `<noun>-<api\|service>.service.ts` | `story-api.service.ts` |
| Store | `<noun>.store.ts` | `stories.store.ts` |
| Repository | `<noun>.repository.ts` | `story.repository.ts` |
| Model | `<noun>.model.ts` | `story.model.ts` |
| Interface | `<noun>.interface.ts` | `story-repository.interface.ts` |

---

## 🔍 VII. CÁCH ĐỌC CODE HIỆU QUẢ

### Khi debug một API endpoint:

1. **Tìm controller** → `backend/src/modules/<feature>/presentation/http/controllers/`
2. **Xem handler** → Follow `CommandHandler` hoặc `QueryHandler`
3. **Kiểm tra port** → Xem interface trong `application/ports/`
4. **Đọc adapter** → Implementation trong `infrastructure/persistence/`
5. **Xem schema** → `backend/prisma/schema.prisma`
6. **Kiểm tra migration** → `backend/prisma/migrations/`

### Khi debug một trang frontend:

1. **Tìm route** → `frontend/src/app/routes/<feature>.routes.ts`
2. **Xem page component** → `features/<feature>/ui/pages/`
3. **Kiểm tra store** → `features/<feature>/data-access/stores/`
4. **Xem repository** → `features/<feature>/data-access/repositories/`
5. **Kiểm tra API service** → `features/<feature>/data-access/services/`

---

## 🎓 VIII. TÓM TẮT QUAN TRỌNG

### Backend - Luồng xử lý chuẩn:
```
HTTP Request 
  → Controller (presentation) 
  → Command/Query Handler (application)
  → Port Interface (application)
  → Adapter Implementation (infrastructure)
  → Database/External Service
```

### Frontend - Luồng xử lý chuẩn:
```
User Action 
  → Component (ui)
  → Store Action (data-access)
  → Repository (data-access)
  → API Service (data-access)
  → HTTP Interceptor (core)
  → Backend API
```

### Dependency Direction:
```
Presentation → Application → Domain ← Infrastructure
                                ↑
                          (implements ports)
```

**Ghi nhớ:** 
- Domain KHÔNG biết gì về Infrastructure
- Application chỉ biết Port interfaces
- Infrastructure implements Ports
- Controllers chỉ delegate, không có logic

---

Nếu có thắc mắc về cấu trúc nào, hãy hỏi tôi!
