# SPRINT 8 — AI Author Tools và Moderation
**Timeline:** 6–10 ngày  
**Mục tiêu:** Mở rộng AI translation thành job riêng với tóm tắt, character extraction, consistency warnings và moderation enhancements

---

## 🎯 ACCEPTANCE CRITERIA

✅ Tóm tắt chapter/story  
✅ Character extraction và timeline  
✅ Consistency warnings giữa các chapter  
✅ Draft translation review trước khi nhập editor  
✅ Audit provider/model/token/cost (không log nội dung nhạy cảm)  
✅ Blacklist và rate limit áp dụng cho inline threads  
✅ Report inbox có context anchor/chapter version  

---

## 📊 PHÂN TÍCH HIỆN TẠI

### AI Module hiện có:
- `ChapterTranslation` với job queue
- `AiGateway` với usage tracking
- Provider/model/protocol abstraction
- Security audit system
- Rate limiting

### Comment Moderation:
- `CommentReport` với reasons
- Abuse guard (profanity, spam)
- Rate limiting per user
- Moderation status tracking

### Thiếu:
- ❌ AI author assistance tools
- ❌ Character/timeline extraction
- ❌ Consistency checking
- ❌ Translation review workflow
- ❌ Inline comment moderation
- ❌ Anchor context in reports

---

## 🏗️ TECHNICAL DESIGN

### 1. Database Schema Changes

```prisma
enum AiJobType {
  CHAPTER_TRANSLATION    @map("chapter_translation")     // Existing
  CHAPTER_SUMMARY        @map("chapter_summary")         // NEW
  STORY_SUMMARY          @map("story_summary")           // NEW
  CHARACTER_EXTRACTION   @map("character_extraction")    // NEW
  CONSISTENCY_CHECK      @map("consistency_check")       // NEW
  
  @@map("ai_job_type")
}

enum AiJobStatus {
  PENDING     @map("pending")
  PROCESSING  @map("processing")
  COMPLETED   @map("completed")
  FAILED      @map("failed")
  CANCELLED   @map("cancelled")
  
  @@map("ai_job_status")
}

model AiAuthorJob {
  id              String        @id @default(uuid()) @db.Uuid
  userId          String        @map("user_id") @db.Uuid
  storyId         String?       @map("story_id") @db.Uuid
  chapterId       String?       @map("chapter_id") @db.Uuid
  
  // Job spec
  jobType         AiJobType     @map("job_type")
  status          AiJobStatus   @default(PENDING)
  
  // AI config
  connectionId    String        @map("connection_id") @db.Uuid
  prompt          String        @db.Text
  parameters      Json?         // Model-specific params
  
  // Result
  result          Json?
  resultText      String?       @map("result_text") @db.Text
  
  // Usage
  inputTokens     Int?          @map("input_tokens")
  outputTokens    Int?          @map("output_tokens")
  totalCost       Decimal?      @map("total_cost") @db.Decimal(10, 4)
  
  // Job lifecycle
  startedAt       DateTime?     @map("started_at") @db.Timestamptz(3)
  completedAt     DateTime?     @map("completed_at") @db.Timestamptz(3)
  failureReason   String?       @map("failure_reason") @db.Text
  retryCount      Int           @default(0) @map("retry_count")
  
  createdAt       DateTime      @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt       DateTime      @updatedAt @map("updated_at") @db.Timestamptz(3)
  
  user    User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  story   Story?   @relation(fields: [storyId], references: [id], onDelete: Cascade)
  chapter Chapter? @relation(fields: [chapterId], references: [id], onDelete: Cascade)
  
  @@index([userId, status, createdAt])
  @@index([storyId, jobType])
  @@index([chapterId, jobType])
  @@index([status, createdAt])
  @@map("ai_author_jobs")
}

model StoryCharacter {
  id              String    @id @default(uuid()) @db.Uuid
  storyId         String    @map("story_id") @db.Uuid
  
  // Character info
  name            String    @db.VarChar(255)
  aliases         String[]  @default([])
  description     String?   @db.Text
  
  // Timeline
  firstAppearance String?   @map("first_appearance") @db.Uuid  // ChapterId
  appearances     Json?     // [{chapterId, role, mentions}]
  
  // Relationships
  relationships   Json?     // [{characterId, type, description}]
  
  // Metadata
  extractedBy     String?   @map("extracted_by") @db.Uuid  // AiJobId
  isVerified      Boolean   @default(false) @map("is_verified")
  
  createdAt       DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt       DateTime  @updatedAt @map("updated_at") @db.Timestamptz(3)
  
  story Story @relation(fields: [storyId], references: [id], onDelete: Cascade)
  
  @@unique([storyId, name])
  @@index([storyId])
  @@map("story_characters")
}

model ChapterConsistencyIssue {
  id          String    @id @default(uuid()) @db.Uuid
  chapterId   String    @map("chapter_id") @db.Uuid
  
  // Issue details
  issueType   String    @map("issue_type") @db.VarChar(50)  // CHARACTER_INCONSISTENCY, TIMELINE_ERROR, etc.
  severity    String    @db.VarChar(20)    // LOW, MEDIUM, HIGH
  description String    @db.Text
  suggestion  String?   @db.Text
  
  // Context
  blockId     String?   @map("block_id") @db.Uuid
  relatedChapterIds String[] @default([]) @map("related_chapter_ids")
  
  // Metadata
  detectedBy  String    @map("detected_by") @db.Uuid  // AiJobId
  isDismissed Boolean   @default(false) @map("is_dismissed")
  isResolved  Boolean   @default(false) @map("is_resolved")
  
  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)
  
  chapter Chapter @relation(fields: [chapterId], references: [id], onDelete: Cascade)
  
  @@index([chapterId, isDismissed, isResolved])
  @@map("chapter_consistency_issues")
}

// Extend CommentReport with anchor context
model CommentReport {
  // ... existing fields ...
  
  // NEW: Anchor context for inline comments
  anchorBlockId   String?   @map("anchor_block_id") @db.Uuid
  anchorQuote     String?   @map("anchor_quote") @db.VarChar(500)
  chapterVersion  Int?      @map("chapter_version")
}

// Add relations to existing models
model User {
  // ... existing fields ...
  aiAuthorJobs AiAuthorJob[]
}

model Story {
  // ... existing fields ...
  aiAuthorJobs AiAuthorJob[]
  characters   StoryCharacter[]
}

model Chapter {
  // ... existing fields ...
  aiAuthorJobs      AiAuthorJob[]
  consistencyIssues ChapterConsistencyIssue[]
}
```

---

### 2. AI Author Tools - Backend (3 ngày)

**Task 2.1: Chapter Summary Command**

**File:** `backend/src/modules/ai-author/application/commands/generate-chapter-summary/generate-chapter-summary.command-handler.ts`

```typescript
@Injectable()
export class GenerateChapterSummaryCommandHandler {
  constructor(
    @Inject(AI_AUTHOR_JOB_QUEUE_PORT)
    private readonly jobQueue: AiAuthorJobQueuePort,
    @Inject(CHAPTER_READER_PORT)
    private readonly chapterReader: ChapterReaderPort,
    private readonly prisma: PrismaService,
  ) {}
  
  async execute(command: GenerateChapterSummaryCommand): Promise<AiAuthorJobDto> {
    // 1. Get chapter
    const chapter = await this.chapterReader.findById(command.chapterId);
    
    if (!chapter) {
      throw new ResourceNotFoundException('Chapter', command.chapterId);
    }
    
    // 2. Verify ownership
    if (chapter.authorId !== command.userId) {
      throw new AccessDeniedException('You do not own this chapter');
    }
    
    // 3. Build prompt
    const prompt = this.buildSummaryPrompt(chapter);
    
    // 4. Create job
    const job = await this.prisma.aiAuthorJob.create({
      data: {
        userId: command.userId,
        storyId: chapter.storyId,
        chapterId: command.chapterId,
        jobType: 'CHAPTER_SUMMARY',
        status: 'PENDING',
        connectionId: command.connectionId,
        prompt,
        parameters: command.parameters,
      },
    });
    
    // 5. Enqueue
    await this.jobQueue.enqueue({
      jobId: job.id,
      jobType: 'CHAPTER_SUMMARY',
      priority: 5,
    });
    
    return mapToJobDto(job);
  }
  
  private buildSummaryPrompt(chapter: ChapterDto): string {
    return `Hãy tóm tắt nội dung chương sau một cách ngắn gọn và súc tích:

Tiêu đề: ${chapter.title}
Nội dung:
${chapter.content}

Yêu cầu:
- Tóm tắt trong 3-5 câu
- Nêu các sự kiện chính
- Không spoil quá nhiều chi tiết
- Viết bằng tiếng Việt`;
  }
}
```

**Task 2.2: Character Extraction Command**

**File:** `backend/src/modules/ai-author/application/commands/extract-characters/extract-characters.command-handler.ts`

```typescript
@Injectable()
export class ExtractCharactersCommandHandler {
  constructor(
    @Inject(AI_AUTHOR_JOB_QUEUE_PORT)
    private readonly jobQueue: AiAuthorJobQueuePort,
    private readonly prisma: PrismaService,
  ) {}
  
  async execute(command: ExtractCharactersCommand): Promise<AiAuthorJobDto> {
    // 1. Get story chapters
    const chapters = await this.prisma.chapter.findMany({
      where: {
        storyId: command.storyId,
        status: 'PUBLISHED',
      },
      orderBy: { number: 'asc' },
      select: {
        id: true,
        number: true,
        title: true,
        content: true,
      },
    });
    
    if (chapters.length === 0) {
      throw new InvalidInputException('No published chapters found');
    }
    
    // 2. Build prompt with all chapter content
    const prompt = this.buildExtractionPrompt(chapters);
    
    // 3. Create job
    const job = await this.prisma.aiAuthorJob.create({
      data: {
        userId: command.userId,
        storyId: command.storyId,
        jobType: 'CHARACTER_EXTRACTION',
        status: 'PENDING',
        connectionId: command.connectionId,
        prompt,
      },
    });
    
    // 4. Enqueue
    await this.jobQueue.enqueue({
      jobId: job.id,
      jobType: 'CHARACTER_EXTRACTION',
      priority: 3,
    });
    
    return mapToJobDto(job);
  }
  
  private buildExtractionPrompt(chapters: any[]): string {
    const chaptersText = chapters.map(c => 
      `Chương ${c.number}: ${c.title}\n${c.content}`
    ).join('\n\n---\n\n');
    
    return `Hãy phân tích truyện sau và trích xuất thông tin về các nhân vật:

${chaptersText}

Yêu cầu:
- Liệt kê tất cả nhân vật xuất hiện trong truyện
- Với mỗi nhân vật, cung cấp:
  + Tên đầy đủ và biệt danh (nếu có)
  + Mô tả ngắn gọn
  + Chương xuất hiện lần đầu
  + Vai trò (main character, supporting, minor)
  + Mối quan hệ với nhân vật khác

Trả về JSON với format:
{
  "characters": [
    {
      "name": "Tên nhân vật",
      "aliases": ["Biệt danh 1", "Biệt danh 2"],
      "description": "Mô tả",
      "firstAppearance": "Số chương",
      "role": "main|supporting|minor",
      "relationships": [
        {"with": "Tên nhân vật khác", "type": "friend|enemy|family|lover", "description": "Chi tiết"}
      ]
    }
  ]
}`;
  }
}
```

**Task 2.3: Consistency Check Command**

**File:** `backend/src/modules/ai-author/application/commands/check-consistency/check-consistency.command-handler.ts`

```typescript
@Injectable()
export class CheckConsistencyCommandHandler {
  constructor(
    @Inject(AI_AUTHOR_JOB_QUEUE_PORT)
    private readonly jobQueue: AiAuthorJobQueuePort,
    private readonly prisma: PrismaService,
  ) {}
  
  async execute(command: CheckConsistencyCommand): Promise<AiAuthorJobDto> {
    // 1. Get chapter and previous chapters
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: command.chapterId },
      include: { story: true },
    });
    
    if (!chapter) {
      throw new ResourceNotFoundException('Chapter', command.chapterId);
    }
    
    // Get previous chapters for context
    const previousChapters = await this.prisma.chapter.findMany({
      where: {
        storyId: chapter.storyId,
        number: { lt: chapter.number },
        status: 'PUBLISHED',
      },
      orderBy: { number: 'desc' },
      take: 5,  // Last 5 chapters for context
      select: {
        id: true,
        number: true,
        title: true,
        content: true,
      },
    });
    
    // 2. Get story characters
    const characters = await this.prisma.storyCharacter.findMany({
      where: { storyId: chapter.storyId },
    });
    
    // 3. Build prompt
    const prompt = this.buildConsistencyPrompt(chapter, previousChapters, characters);
    
    // 4. Create job
    const job = await this.prisma.aiAuthorJob.create({
      data: {
        userId: command.userId,
        storyId: chapter.storyId,
        chapterId: command.chapterId,
        jobType: 'CONSISTENCY_CHECK',
        status: 'PENDING',
        connectionId: command.connectionId,
        prompt,
      },
    });
    
    // 5. Enqueue
    await this.jobQueue.enqueue({
      jobId: job.id,
      jobType: 'CONSISTENCY_CHECK',
      priority: 5,
    });
    
    return mapToJobDto(job);
  }
  
  private buildConsistencyPrompt(
    chapter: any,
    previousChapters: any[],
    characters: any[],
  ): string {
    const contextText = previousChapters.map(c =>
      `Chương ${c.number}: ${c.title}\n${c.content.slice(0, 2000)}`
    ).join('\n\n');
    
    const characterInfo = characters.map(c =>
      `- ${c.name}: ${c.description || 'Không có mô tả'}`
    ).join('\n');
    
    return `Hãy kiểm tra tính nhất quán của chương mới với các chương trước:

Context từ các chương trước:
${contextText}

Nhân vật đã biết:
${characterInfo}

Chương mới (Chương ${chapter.number}):
${chapter.content}

Yêu cầu kiểm tra:
1. Character consistency: Nhân vật có hành động/tính cách trái ngược với trước không?
2. Timeline consistency: Có vấn đề về thời gian/tuổi tác/sự kiện không?
3. Plot consistency: Có mâu thuẫn với cốt truyện trước không?
4. Setting consistency: Địa điểm/bối cảnh có mâu thuẫn không?

Trả về JSON:
{
  "issues": [
    {
      "type": "CHARACTER_INCONSISTENCY|TIMELINE_ERROR|PLOT_HOLE|SETTING_ERROR",
      "severity": "LOW|MEDIUM|HIGH",
      "description": "Mô tả vấn đề",
      "suggestion": "Đề xuất sửa",
      "relatedChapters": ["chapterId1", "chapterId2"]
    }
  ]
}

Nếu không có vấn đề, trả về {"issues": []}`;
  }
}
```

**Task 2.4: AI Job Processor**

**File:** `backend/src/modules/ai-author/infrastructure/queue/ai-author-job.processor.ts`

```typescript
@Processor('ai-author')
@Injectable()
export class AiAuthorJobProcessor {
  constructor(
    @Inject(AI_GATEWAY_PORT)
    private readonly aiGateway: AiGatewayPort,
    @Inject(AI_CONNECTION_RESOLVER)
    private readonly connectionResolver: AiConnectionResolver,
    private readonly prisma: PrismaService,
    private readonly logger: Logger,
  ) {}
  
  @Process('ai-author-job')
  async handleJob(job: Job<AiAuthorJobData>) {
    const { jobId } = job.data;
    
    try {
      // 1. Get job
      const aiJob = await this.prisma.aiAuthorJob.findUnique({
        where: { id: jobId },
      });
      
      if (!aiJob) {
        throw new Error('Job not found');
      }
      
      // 2. Update status
      await this.prisma.aiAuthorJob.update({
        where: { id: jobId },
        data: {
          status: 'PROCESSING',
          startedAt: new Date(),
        },
      });
      
      // 3. Resolve AI connection
      const connection = await this.connectionResolver.resolve(aiJob.connectionId);
      
      // 4. Call AI
      const response = await this.aiGateway.generate(
        connection,
        {
          messages: [
            {
              role: 'user',
              content: aiJob.prompt,
            },
          ],
          temperature: 0.7,
          maxTokens: 4000,
        },
        {
          userId: aiJob.userId,
          connectionId: aiJob.connectionId,
        },
        'ai_author_tools',  // Capability for usage tracking
      );
      
      // 5. Parse result based on job type
      const parsedResult = this.parseResult(aiJob.jobType, response.content);
      
      // 6. Store result (SECURITY: No sensitive content logged)
      await this.prisma.aiAuthorJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          result: parsedResult,
          resultText: response.content.slice(0, 10000),  // Truncate
          inputTokens: response.usage?.promptTokens,
          outputTokens: response.usage?.completionTokens,
          totalCost: this.calculateCost(response.usage),
          completedAt: new Date(),
        },
      });
      
      // 7. Post-process based on job type
      await this.postProcess(aiJob, parsedResult);
      
      this.logger.log({
        message: 'AI author job completed',
        jobId,
        jobType: aiJob.jobType,
        inputTokens: response.usage?.promptTokens,
        outputTokens: response.usage?.completionTokens,
        // NOTE: Do NOT log prompt or response content
      });
      
    } catch (error) {
      this.logger.error({
        message: 'AI author job failed',
        jobId,
        error: error.message,
        // NOTE: Do NOT log error details that might contain content
      });
      
      await this.prisma.aiAuthorJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          failureReason: error.message.slice(0, 500),
          retryCount: { increment: 1 },
        },
      });
      
      throw error;
    }
  }
  
  private parseResult(jobType: string, content: string): any {
    try {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
      
      // Try direct JSON parse
      return JSON.parse(content);
    } catch (error) {
      // If not JSON, return as text
      return { text: content };
    }
  }
  
  private async postProcess(job: any, result: any): Promise<void> {
    switch (job.jobType) {
      case 'CHARACTER_EXTRACTION':
        await this.saveCharacters(job.storyId, result);
        break;
        
      case 'CONSISTENCY_CHECK':
        await this.saveConsistencyIssues(job.chapterId, job.id, result);
        break;
        
      // Other job types don't need post-processing
    }
  }
  
  private async saveCharacters(storyId: string, result: any): Promise<void> {
    if (!result.characters || !Array.isArray(result.characters)) return;
    
    for (const char of result.characters) {
      await this.prisma.storyCharacter.upsert({
        where: {
          storyId_name: {
            storyId,
            name: char.name,
          },
        },
        create: {
          storyId,
          name: char.name,
          aliases: char.aliases || [],
          description: char.description,
          appearances: char.appearances ? JSON.stringify(char.appearances) : null,
          relationships: char.relationships ? JSON.stringify(char.relationships) : null,
          extractedBy: job.id,
        },
        update: {
          aliases: char.aliases || [],
          description: char.description,
          appearances: char.appearances ? JSON.stringify(char.appearances) : null,
          relationships: char.relationships ? JSON.stringify(char.relationships) : null,
        },
      });
    }
  }
  
  private async saveConsistencyIssues(
    chapterId: string,
    jobId: string,
    result: any,
  ): Promise<void> {
    if (!result.issues || !Array.isArray(result.issues)) return;
    
    for (const issue of result.issues) {
      await this.prisma.chapterConsistencyIssue.create({
        data: {
          chapterId,
          issueType: issue.type,
          severity: issue.severity,
          description: issue.description,
          suggestion: issue.suggestion,
          relatedChapterIds: issue.relatedChapters || [],
          detectedBy: jobId,
        },
      });
    }
  }
  
  private calculateCost(usage: any): number {
    // Simplified cost calculation
    const inputCost = (usage?.promptTokens || 0) * 0.000001;
    const outputCost = (usage?.completionTokens || 0) * 0.000003;
    return inputCost + outputCost;
  }
}
```

---

### 3. Translation Review Workflow (2 ngày)

**File:** `backend/src/modules/ai/application/commands/review-translation/review-translation.command-handler.ts`

```typescript
@Injectable()
export class ReviewTranslationCommandHandler {
  constructor(
    @Inject(CHAPTER_TRANSLATION_PERSISTENCE_PORT)
    private readonly translationPersistence: ChapterTranslationPersistencePort,
    private readonly prisma: PrismaService,
  ) {}
  
  async execute(command: ReviewTranslationCommand): Promise<void> {
    // 1. Get translation
    const translation = await this.translationPersistence.findById(command.translationId);
    
    if (!translation) {
      throw new ResourceNotFoundException('Translation', command.translationId);
    }
    
    // 2. Verify ownership
    if (translation.requestedById !== command.userId) {
      throw new AccessDeniedException('You do not own this translation');
    }
    
    // 3. Update based on decision
    if (command.decision === 'APPROVE') {
      // Import into chapter
      await this.importTranslationIntoChapter(translation);
      
      await this.translationPersistence.updateStatus(command.translationId, 'APPROVED');
    } else if (command.decision === 'REJECT') {
      await this.translationPersistence.updateStatus(command.translationId, 'REJECTED');
    } else if (command.decision === 'REQUEST_REVISION') {
      // Keep as draft, add revision notes
      await this.translationPersistence.addRevisionNotes(
        command.translationId,
        command.notes || '',
      );
    }
  }
  
  private async importTranslationIntoChapter(translation: any): Promise<void> {
    // Import translated content into chapter
    await this.prisma.chapter.update({
      where: { id: translation.chapterId },
      data: {
        content: translation.translatedContent,
        // Update contentDocument if needed
      },
    });
  }
}
```

---

### 4. Enhanced Comment Moderation (2 ngày)

**Task 4.1: Inline Thread Rate Limiting**

**File:** `backend/src/modules/comments/application/policies/inline-comment-rate-limit.policy.ts`

```typescript
@Injectable()
export class InlineCommentRateLimitPolicy {
  constructor(
    @Inject(COMMENT_ABUSE_RATE_LIMIT_STORE_PORT)
    private readonly rateLimitStore: CommentAbuseRateLimitStorePort,
  ) {}
  
  async checkRateLimit(
    userId: string,
    chapterId: string,
    anchorBlockId?: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    // Check global chapter comment rate (10 per hour)
    const chapterKey = `comment:chapter:${chapterId}:${userId}`;
    const chapterCount = await this.rateLimitStore.increment(chapterKey, 3600);
    
    if (chapterCount > 10) {
      return {
        allowed: false,
        reason: 'Bạn đã bình luận quá nhiều trong chương này. Vui lòng thử lại sau.',
      };
    }
    
    // If inline comment (has anchor), check per-block rate (3 per hour)
    if (anchorBlockId) {
      const blockKey = `comment:block:${chapterId}:${anchorBlockId}:${userId}`;
      const blockCount = await this.rateLimitStore.increment(blockKey, 3600);
      
      if (blockCount > 3) {
        return {
          allowed: false,
          reason: 'Bạn đã bình luận quá nhiều trên đoạn văn này. Vui lòng thử lại sau.',
        };
      }
    }
    
    return { allowed: true };
  }
}
```

**Task 4.2: Report with Anchor Context**

**File:** `backend/src/modules/comments/application/commands/create-comment-report-with-context/create-comment-report-with-context.command-handler.ts`

```typescript
@Injectable()
export class CreateCommentReportWithContextCommandHandler {
  constructor(
    @Inject(COMMENT_PERSISTENCE_PORT)
    private readonly persistence: CommentPersistencePort,
    private readonly prisma: PrismaService,
  ) {}
  
  async execute(command: CreateCommentReportWithContextCommand): Promise<void> {
    // 1. Get comment with anchor
    const comment = await this.prisma.comment.findUnique({
      where: { id: command.commentId },
      include: { anchor: true },
    });
    
    if (!comment) {
      throw new ResourceNotFoundException('Comment', command.commentId);
    }
    
    // 2. Get chapter version for context
    let chapterVersion: number | null = null;
    
    if (comment.chapterId) {
      const chapter = await this.prisma.chapter.findUnique({
        where: { id: comment.chapterId },
        select: { version: true },
      });
      chapterVersion = chapter?.version || null;
    }
    
    // 3. Create report with anchor context
    await this.prisma.report.create({
      data: {
        reportableType: 'Comment',
        reportableId: command.commentId,
        reporterId: command.reporterId,
        reason: command.reason,
        details: command.details,
        
        // Anchor context
        anchorBlockId: comment.anchor?.startBlockId,
        anchorQuote: comment.anchor?.quoteText?.slice(0, 500),
        chapterVersion,
      },
    });
  }
}
```

---

## 📝 IMPLEMENTATION ORDER

### Day 1-3: AI Author Tools Backend
- [ ] Database migration
- [ ] Chapter summary command
- [ ] Character extraction command
- [ ] Consistency check command
- [ ] AI job processor
- [ ] Tests

### Day 4-5: Translation Review Workflow
- [ ] Review translation command
- [ ] Import into chapter
- [ ] Revision notes
- [ ] UI for review
- [ ] Tests

### Day 6-7: Enhanced Moderation
- [ ] Inline thread rate limiting
- [ ] Report with anchor context
- [ ] Blacklist enforcement
- [ ] Tests

### Day 8-9: Frontend Integration
- [ ] AI tools UI
- [ ] Character list display
- [ ] Consistency warnings
- [ ] Translation review UI
- [ ] Tests

### Day 10: Polish & Documentation
- [ ] E2E tests
- [ ] Audit logging
- [ ] Documentation

---

## 🧪 TESTING STRATEGY

### Functional Tests
- [ ] Summary generation
- [ ] Character extraction accuracy
- [ ] Consistency detection
- [ ] Translation review workflow

### Security Tests
- [ ] No sensitive content in logs
- [ ] Rate limits enforced
- [ ] Audit trail complete

### Performance Tests
- [ ] AI job processing time
- [ ] Queue throughput

---

## ✅ DEFINITION OF DONE

- [ ] All AI tools functional
- [ ] No sensitive content logged
- [ ] Audit complete
- [ ] Rate limits working
- [ ] Anchor context in reports
- [ ] Documentation complete
