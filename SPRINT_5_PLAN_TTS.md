# SPRINT 5 — Text-to-Speech (TTS)
**Timeline:** 8–12 ngày  
**Mục tiêu:** Hai tầng TTS (Web Speech API fallback + AI provider) với segment timing và quota tracking

---

## 🎯 ACCEPTANCE CRITERIA

✅ Web Speech API làm fallback không tốn chi phí  
✅ TTS provider port riêng (không nhét vào AI chat gateway)  
✅ Cache theo `chapterVersion + language + voice + style`  
✅ Audio sinh bằng BullMQ, lưu Cloudinary/object storage  
✅ Segment gắn với `blockId` và timing để frontend tự cuộn  
✅ Speed thay đổi phía client (không cần tạo lại audio)  
✅ Quota/cost tracking và permission riêng  
✅ AI fallback mặc định `NONE` - không tự chuyển sang system key  

---

## 📊 PHÂN TÍCH HIỆN TẠI

### AI Module Structure:

**Ports:**
- `AI_GATEWAY_PORT` - Chat/translation gateway
- `AI_PROTOCOL_REGISTRY_PORT` - Protocol adapters
- `AI_USAGE_PERSISTENCE_PORT` - Usage tracking
- `AI_CREDENTIAL_VAULT_PORT` - API key encryption

**Features:**
- AI chat conversations
- Chapter translation
- Usage tracking per connection
- Rate limiting
- Fallback policy (`NONE`, `SYSTEM`, `AUTO`)

**Not applicable for TTS:**
- AI Gateway is chat-focused (generate/generateStream)
- Protocol adapters are for LLM APIs
- TTS needs separate provider interface

### Chapter Content Structure:

- `ChapterContentDocument` with blocks
- Each block has `id` (UUID) - stable identifier
- Blocks contain Markdown text

---

## 🏗️ TECHNICAL DESIGN

### 1. Database Schema Changes

```prisma
enum TtsProvider {
  WEB_SPEECH_API  @map("web_speech_api")  // Browser native
  ELEVEN_LABS     @map("eleven_labs")     // ElevenLabs
  GOOGLE_CLOUD    @map("google_cloud")    // Google Cloud TTS
  AZURE           @map("azure")           // Azure Cognitive Services
  AWS_POLLY       @map("aws_polly")       // AWS Polly
  
  @@map("tts_provider")
}

enum TtsGenerationStatus {
  PENDING     @map("pending")
  PROCESSING  @map("processing")
  COMPLETED   @map("completed")
  FAILED      @map("failed")
  CACHED      @map("cached")
  
  @@map("tts_generation_status")
}

enum TtsSegmentStatus {
  PENDING    @map("pending")
  GENERATED  @map("generated")
  FAILED     @map("failed")
  
  @@map("tts_segment_status")
}

model TtsVoiceConnection {
  id          String      @id @default(uuid()) @db.Uuid
  userId      String?     @map("user_id") @db.Uuid  // Null = system
  
  // Provider config
  provider    TtsProvider
  voiceId     String      @map("voice_id") @db.VarChar(255)
  voiceName   String      @map("voice_name") @db.VarChar(255)
  language    String      @db.VarChar(10)  // e.g. "vi-VN", "en-US"
  
  // Provider credentials
  apiKey      String?     @map("api_key") @db.Text  // Encrypted
  apiEndpoint String?     @map("api_endpoint") @db.VarChar(512)
  
  // Settings
  stability   Decimal?    @db.Decimal(3, 2)  // 0.00-1.00
  similarity  Decimal?    @db.Decimal(3, 2)  // 0.00-1.00
  style       Decimal?    @db.Decimal(3, 2)  // 0.00-1.00
  
  // Metadata
  isActive    Boolean     @default(true) @map("is_active")
  isSystem    Boolean     @default(false) @map("is_system")
  
  createdAt   DateTime    @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt   DateTime    @updatedAt @map("updated_at") @db.Timestamptz(3)
  
  user        User?       @relation(fields: [userId], references: [id], onDelete: Cascade)
  manifests   TtsManifest[]
  usage       TtsUsage[]
  
  @@index([userId, isActive])
  @@index([provider, isSystem])
  @@map("tts_voice_connections")
}

model TtsManifest {
  id              String                @id @default(uuid()) @db.Uuid
  chapterId       String                @map("chapter_id") @db.Uuid
  connectionId    String                @map("connection_id") @db.Uuid
  
  // Cache key components
  chapterVersion  Int                   @map("chapter_version")
  language        String                @db.VarChar(10)
  voiceId         String                @map("voice_id") @db.VarChar(255)
  styleHash       String                @map("style_hash") @db.VarChar(64)  // Hash of style params
  
  // Generation metadata
  status          TtsGenerationStatus   @default(PENDING)
  provider        TtsProvider
  totalSegments   Int                   @default(0) @map("total_segments")
  completedSegments Int                 @default(0) @map("completed_segments")
  totalDuration   Decimal?              @map("total_duration") @db.Decimal(10, 2)  // seconds
  
  // Cost tracking
  characterCount  Int                   @default(0) @map("character_count")
  estimatedCost   Decimal?              @map("estimated_cost") @db.Decimal(10, 4)
  
  // Generation job
  jobId           String?               @map("job_id") @db.VarChar(255)
  startedAt       DateTime?             @map("started_at") @db.Timestamptz(3)
  completedAt     DateTime?             @map("completed_at") @db.Timestamptz(3)
  failureReason   String?               @map("failure_reason") @db.Text
  
  // Timestamps
  createdAt       DateTime              @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt       DateTime              @updatedAt @map("updated_at") @db.Timestamptz(3)
  lastAccessedAt  DateTime              @default(now()) @map("last_accessed_at") @db.Timestamptz(3)
  
  chapter         Chapter               @relation(fields: [chapterId], references: [id], onDelete: Cascade)
  connection      TtsVoiceConnection    @relation(fields: [connectionId], references: [id], onDelete: Cascade)
  segments        TtsSegment[]
  
  @@unique([chapterId, chapterVersion, language, voiceId, styleHash])
  @@index([chapterId, status])
  @@index([status, createdAt])
  @@index([lastAccessedAt])
  @@map("tts_manifests")
}

model TtsSegment {
  id              String            @id @default(uuid()) @db.Uuid
  manifestId      String            @map("manifest_id") @db.Uuid
  
  // Block reference
  blockId         String            @map("block_id") @db.Uuid
  blockIndex      Int               @map("block_index")  // Order in chapter
  blockText       String            @map("block_text") @db.Text
  
  // Audio metadata
  status          TtsSegmentStatus  @default(PENDING)
  audioUrl        String?           @map("audio_url") @db.VarChar(2048)
  publicId        String?           @map("public_id") @db.VarChar(512)  // Cloudinary
  duration        Decimal?          @db.Decimal(8, 2)  // seconds
  sizeBytes       BigInt?           @map("size_bytes")
  format          String?           @db.VarChar(20)  // mp3, opus, etc.
  
  // Timing for auto-scroll
  startTime       Decimal?          @map("start_time") @db.Decimal(8, 2)  // seconds from chapter start
  endTime         Decimal?          @map("end_time") @db.Decimal(8, 2)
  
  // Word-level timing (optional, for precise highlighting)
  wordTimings     Json?             @map("word_timings")  // [{word, start, end}]
  
  // Generation metadata
  characterCount  Int               @default(0) @map("character_count")
  retryCount      Int               @default(0) @map("retry_count")
  generatedAt     DateTime?         @map("generated_at") @db.Timestamptz(3)
  failureReason   String?           @map("failure_reason") @db.Text
  
  createdAt       DateTime          @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt       DateTime          @updatedAt @map("updated_at") @db.Timestamptz(3)
  
  manifest        TtsManifest       @relation(fields: [manifestId], references: [id], onDelete: Cascade)
  
  @@unique([manifestId, blockId])
  @@index([manifestId, blockIndex])
  @@index([status])
  @@map("tts_segments")
}

model TtsUsage {
  id              String            @id @default(uuid()) @db.Uuid
  userId          String            @map("user_id") @db.Uuid
  connectionId    String?           @map("connection_id") @db.Uuid
  
  // Usage details
  provider        TtsProvider
  characterCount  Int               @map("character_count")
  segmentCount    Int               @map("segment_count")
  totalDuration   Decimal           @map("total_duration") @db.Decimal(10, 2)
  
  // Cost
  estimatedCost   Decimal?          @map("estimated_cost") @db.Decimal(10, 4)
  
  // Context
  chapterId       String?           @map("chapter_id") @db.Uuid
  manifestId      String?           @map("manifest_id") @db.Uuid
  
  createdAt       DateTime          @default(now()) @map("created_at") @db.Timestamptz(3)
  
  user            User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  connection      TtsVoiceConnection? @relation(fields: [connectionId], references: [id], onDelete: SetNull)
  
  @@index([userId, createdAt])
  @@index([connectionId, createdAt])
  @@index([provider, createdAt])
  @@map("tts_usage")
}

model TtsQuota {
  userId                String    @id @map("user_id") @db.Uuid
  
  // Monthly quota
  monthlyCharacterLimit Int       @default(50000) @map("monthly_character_limit")
  currentMonthUsage     Int       @default(0) @map("current_month_usage")
  currentMonthStart     DateTime  @default(now()) @map("current_month_start") @db.Timestamptz(3)
  
  // Total usage
  totalCharacters       BigInt    @default(0) @map("total_characters")
  totalSegments         Int       @default(0) @map("total_segments")
  
  updatedAt             DateTime  @updatedAt @map("updated_at") @db.Timestamptz(3)
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("tts_quotas")
}

// Add relations to existing models
model User {
  // ... existing fields ...
  ttsConnections  TtsVoiceConnection[]
  ttsUsage        TtsUsage[]
  ttsQuota        TtsQuota?
}

model Chapter {
  // ... existing fields ...
  ttsManifests TtsManifest[]
}
```

**Migration checklist:**
- [ ] Create enums
- [ ] Create TTS tables
- [ ] Add indexes
- [ ] Initialize default quotas for existing users

---

### 2. Backend Implementation

#### Phase 2.1: TTS Provider Port (2 ngày)

**Task 2.1.1: Create TTS Provider Port (separate from AI Gateway)**

**File:** `backend/src/modules/tts/application/ports/tts-provider.port.ts`

```typescript
export const TTS_PROVIDER_PORT = Symbol.for('modules.tts.provider');

export interface TtsGenerateRequest {
  readonly text: string;
  readonly voiceId: string;
  readonly language: string;
  
  // Optional parameters (provider-specific)
  readonly stability?: number;   // 0.0-1.0
  readonly similarity?: number;  // 0.0-1.0
  readonly style?: number;       // 0.0-1.0
  readonly speed?: number;       // 0.5-2.0 (applied client-side, for reference)
}

export interface TtsGenerateResult {
  readonly audioBuffer: Buffer;
  readonly duration: number;  // seconds
  readonly format: string;    // 'mp3', 'opus', 'pcm'
  readonly sampleRate?: number;
  readonly wordTimings?: TtsWordTiming[];
}

export interface TtsWordTiming {
  readonly word: string;
  readonly start: number;  // seconds
  readonly end: number;    // seconds
}

export interface TtsProviderCapabilities {
  readonly supportsWordTimings: boolean;
  readonly supportsSSML: boolean;
  readonly supportedFormats: readonly string[];
  readonly maxCharactersPerRequest: number;
}

export interface TtsProviderPort {
  readonly name: string;
  readonly capabilities: TtsProviderCapabilities;
  
  generate(request: TtsGenerateRequest): Promise<TtsGenerateResult>;
  
  estimateCost(characterCount: number): number;  // USD
  
  validateVoiceId(voiceId: string): Promise<boolean>;
}
```

**Task 2.1.2: Create Provider Implementations**

**File:** `backend/src/modules/tts/infrastructure/providers/elevenlabs-tts.provider.ts`

```typescript
@Injectable()
export class ElevenLabsTtsProvider implements TtsProviderPort {
  readonly name = 'ElevenLabs';
  readonly capabilities: TtsProviderCapabilities = {
    supportsWordTimings: true,
    supportsSSML: false,
    supportedFormats: ['mp3', 'opus', 'pcm'],
    maxCharactersPerRequest: 5000,
  };
  
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}
  
  async generate(request: TtsGenerateRequest): Promise<TtsGenerateResult> {
    const apiKey = this.config.get('elevenlabs.apiKey');
    
    if (!apiKey) {
      throw new TtsProviderException('ElevenLabs API key not configured');
    }
    
    try {
      const response = await firstValueFrom(
        this.http.post(
          `https://api.elevenlabs.io/v1/text-to-speech/${request.voiceId}`,
          {
            text: request.text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: request.stability ?? 0.5,
              similarity_boost: request.similarity ?? 0.75,
              style: request.style ?? 0.0,
            },
          },
          {
            headers: {
              'xi-api-key': apiKey,
              'Content-Type': 'application/json',
            },
            responseType: 'arraybuffer',
          }
        )
      );
      
      const audioBuffer = Buffer.from(response.data);
      
      // Get duration from audio (use ffprobe or estimate)
      const duration = await this.getAudioDuration(audioBuffer);
      
      return {
        audioBuffer,
        duration,
        format: 'mp3',
        sampleRate: 44100,
      };
    } catch (error) {
      throw new TtsGenerationException(
        `ElevenLabs generation failed: ${error.message}`
      );
    }
  }
  
  estimateCost(characterCount: number): number {
    // ElevenLabs: ~$0.30 per 1000 characters (rough estimate)
    return (characterCount / 1000) * 0.30;
  }
  
  async validateVoiceId(voiceId: string): Promise<boolean> {
    // Validate against ElevenLabs voices API
    return true; // Simplified
  }
  
  private async getAudioDuration(buffer: Buffer): Promise<number> {
    // Use music-metadata or similar
    // For now, estimate: ~150 words/minute, ~5 chars/word
    const estimatedWords = buffer.length / 5000;
    return (estimatedWords / 150) * 60;
  }
}
```

**File:** `backend/src/modules/tts/infrastructure/providers/web-speech-tts.provider.ts`

```typescript
@Injectable()
export class WebSpeechTtsProvider implements TtsProviderPort {
  readonly name = 'WebSpeechAPI';
  readonly capabilities: TtsProviderCapabilities = {
    supportsWordTimings: false,
    supportsSSML: false,
    supportedFormats: [],  // Client-side only
    maxCharactersPerRequest: 32000,  // Browser limit
  };
  
  generate(request: TtsGenerateRequest): Promise<TtsGenerateResult> {
    throw new TtsProviderException(
      'WebSpeechAPI is client-side only - should not be called on server'
    );
  }
  
  estimateCost(characterCount: number): number {
    return 0;  // Free
  }
  
  async validateVoiceId(voiceId: string): Promise<boolean> {
    return true;  // Any voice name is valid for Web Speech API
  }
}
```

**Files to create:**
- `backend/src/modules/tts/application/ports/tts-provider.port.ts`
- `backend/src/modules/tts/infrastructure/providers/elevenlabs-tts.provider.ts`
- `backend/src/modules/tts/infrastructure/providers/web-speech-tts.provider.ts`
- `backend/src/modules/tts/infrastructure/providers/google-cloud-tts.provider.ts`
- `backend/src/modules/tts/infrastructure/providers/azure-tts.provider.ts`
- `backend/src/modules/tts/domain/exceptions/tts.exceptions.ts`

---

#### Phase 2.2: TTS Generation Commands & Queries (3 ngày)

**Task 2.2.1: Generate TTS Manifest Command**

**File:** `backend/src/modules/tts/application/commands/generate-tts-manifest/generate-tts-manifest.command.ts`

```typescript
export class GenerateTtsManifestCommand {
  constructor(
    public readonly userId: string,
    public readonly chapterId: string,
    public readonly connectionId: string,
    public readonly language: string,
  ) {}
}
```

**File:** `backend/src/modules/tts/application/commands/generate-tts-manifest/generate-tts-manifest.command-handler.ts`

```typescript
@Injectable()
export class GenerateTtsManifestCommandHandler {
  constructor(
    @Inject(TTS_MANIFEST_PERSISTENCE_PORT)
    private readonly manifestPersistence: TtsManifestPersistencePort,
    @Inject(TTS_CONNECTION_PORT)
    private readonly connectionPort: TtsConnectionPort,
    @Inject(CHAPTER_READER_PORT)
    private readonly chapterReader: ChapterReaderPort,
    @Inject(TTS_QUOTA_PORT)
    private readonly quotaPort: TtsQuotaPort,
    @Inject(TTS_GENERATION_QUEUE_PORT)
    private readonly queue: TtsGenerationQueuePort,
    private readonly logger: Logger,
  ) {}
  
  async execute(command: GenerateTtsManifestCommand): Promise<TtsManifestDto> {
    // 1. Get chapter content
    const chapter = await this.chapterReader.getChapterForTts(command.chapterId);
    
    if (!chapter || !chapter.contentDocument) {
      throw new ResourceNotFoundException('Chapter', command.chapterId);
    }
    
    // 2. Get TTS connection
    const connection = await this.connectionPort.findById(command.connectionId);
    
    if (!connection) {
      throw new ResourceNotFoundException('TtsConnection', command.connectionId);
    }
    
    // 3. Verify ownership or system connection
    if (connection.userId && connection.userId !== command.userId) {
      throw new AccessDeniedException('You do not own this TTS connection');
    }
    
    // 4. Calculate style hash for cache key
    const styleHash = this.calculateStyleHash(connection);
    
    // 5. Check cache
    const cached = await this.manifestPersistence.findCached({
      chapterId: command.chapterId,
      chapterVersion: chapter.version,
      language: command.language,
      voiceId: connection.voiceId,
      styleHash,
    });
    
    if (cached) {
      // Update last accessed
      await this.manifestPersistence.updateLastAccessed(cached.id);
      return cached;
    }
    
    // 6. Check quota
    const quota = await this.quotaPort.getOrCreateQuota(command.userId);
    const totalCharacters = chapter.contentDocument.blocks.reduce(
      (sum, block) => sum + block.text.length,
      0
    );
    
    if (quota.currentMonthUsage + totalCharacters > quota.monthlyCharacterLimit) {
      throw new TtsQuotaExceededException(
        `Monthly quota exceeded. Used: ${quota.currentMonthUsage}/${quota.monthlyCharacterLimit}`
      );
    }
    
    // 7. Estimate cost
    const provider = this.getProvider(connection.provider);
    const estimatedCost = provider.estimateCost(totalCharacters);
    
    // 8. Create manifest
    const manifest = await this.manifestPersistence.createManifest({
      chapterId: command.chapterId,
      connectionId: command.connectionId,
      chapterVersion: chapter.version,
      language: command.language,
      voiceId: connection.voiceId,
      styleHash,
      provider: connection.provider,
      totalSegments: chapter.contentDocument.blocks.length,
      characterCount: totalCharacters,
      estimatedCost,
    });
    
    // 9. Create segments (one per block)
    const segments = chapter.contentDocument.blocks.map((block, index) => ({
      manifestId: manifest.id,
      blockId: block.id,
      blockIndex: index,
      blockText: block.text,
      characterCount: block.text.length,
    }));
    
    await this.manifestPersistence.createSegments(segments);
    
    // 10. Enqueue generation job
    await this.queue.enqueueGeneration({
      manifestId: manifest.id,
      connectionId: command.connectionId,
      priority: connection.isSystem ? 10 : 5,
    });
    
    this.logger.log({
      message: 'TTS manifest created',
      manifestId: manifest.id,
      chapterId: command.chapterId,
      totalSegments: segments.length,
      totalCharacters,
    });
    
    return manifest;
  }
  
  private calculateStyleHash(connection: TtsConnectionDto): string {
    const styleData = JSON.stringify({
      stability: connection.stability?.toString(),
      similarity: connection.similarity?.toString(),
      style: connection.style?.toString(),
    });
    
    return createHash('sha256')
      .update(styleData)
      .digest('hex')
      .slice(0, 16);
  }
  
  private getProvider(providerType: string): TtsProviderPort {
    // Simplified - use provider registry in real impl
    return this.elevenLabsProvider;
  }
}
```

**Task 2.2.2: Get TTS Manifest Query**

**File:** `backend/src/modules/tts/application/queries/get-tts-manifest/get-tts-manifest.query-handler.ts`

```typescript
@Injectable()
export class GetTtsManifestQueryHandler {
  constructor(
    @Inject(TTS_MANIFEST_PERSISTENCE_PORT)
    private readonly manifestPersistence: TtsManifestPersistencePort,
  ) {}
  
  async execute(query: GetTtsManifestQuery): Promise<TtsManifestWithSegmentsDto> {
    // 1. Get manifest
    const manifest = await this.manifestPersistence.findById(query.manifestId);
    
    if (!manifest) {
      throw new ResourceNotFoundException('TtsManifest', query.manifestId);
    }
    
    // 2. Get segments
    const segments = await this.manifestPersistence.findSegmentsByManifest(
      query.manifestId
    );
    
    // 3. Calculate cumulative timing
    let cumulativeTime = 0;
    const segmentsWithTiming = segments.map(segment => {
      const startTime = cumulativeTime;
      const endTime = cumulativeTime + (segment.duration || 0);
      cumulativeTime = endTime;
      
      return {
        ...segment,
        startTime,
        endTime,
      };
    });
    
    return {
      ...manifest,
      segments: segmentsWithTiming,
      totalDuration: cumulativeTime,
    };
  }
}
```

**Task 2.2.3: TTS Generation Worker**

**File:** `backend/src/modules/tts/infrastructure/queue/tts-generation.processor.ts`

```typescript
@Processor('tts')
@Injectable()
export class TtsGenerationProcessor {
  constructor(
    @Inject(TTS_MANIFEST_PERSISTENCE_PORT)
    private readonly manifestPersistence: TtsManifestPersistencePort,
    @Inject(TTS_CONNECTION_PORT)
    private readonly connectionPort: TtsConnectionPort,
    @Inject(TTS_PROVIDER_REGISTRY_PORT)
    private readonly providerRegistry: TtsProviderRegistryPort,
    @Inject(MEDIA_STORAGE_PORT)
    private readonly mediaStorage: MediaStoragePort,
    @Inject(TTS_USAGE_PORT)
    private readonly usagePort: TtsUsagePort,
    private readonly logger: Logger,
  ) {}
  
  @Process('generate-manifest')
  async handleGenerateManifest(job: Job<GenerateTtsManifestJobData>) {
    const { manifestId, connectionId } = job.data;
    
    try {
      // 1. Get manifest and connection
      const manifest = await this.manifestPersistence.findById(manifestId);
      const connection = await this.connectionPort.findById(connectionId);
      
      if (!manifest || !connection) {
        throw new Error('Manifest or connection not found');
      }
      
      // 2. Update status
      await this.manifestPersistence.updateStatus(manifestId, 'PROCESSING');
      
      // 3. Get provider
      const provider = this.providerRegistry.getProvider(connection.provider);
      
      // 4. Get all segments
      const segments = await this.manifestPersistence.findSegmentsByManifest(manifestId);
      
      // 5. Generate each segment
      let completedCount = 0;
      
      for (const segment of segments) {
        try {
          // Generate audio
          const result = await provider.generate({
            text: segment.blockText,
            voiceId: connection.voiceId,
            language: manifest.language,
            stability: connection.stability,
            similarity: connection.similarity,
            style: connection.style,
          });
          
          // Upload to Cloudinary
          const uploadResult = await this.mediaStorage.uploadBuffer({
            buffer: result.audioBuffer,
            folder: `tts/${manifestId}`,
            resourceType: 'video',  // Audio in Cloudinary
            format: result.format,
            publicId: `segment_${segment.blockIndex}`,
          });
          
          // Update segment
          await this.manifestPersistence.updateSegment(segment.id, {
            status: 'GENERATED',
            audioUrl: uploadResult.secureUrl,
            publicId: uploadResult.publicId,
            duration: result.duration,
            sizeBytes: BigInt(result.audioBuffer.length),
            format: result.format,
            wordTimings: result.wordTimings,
            generatedAt: new Date(),
          });
          
          completedCount++;
          
          // Update progress
          await this.manifestPersistence.updateProgress(manifestId, completedCount);
          await job.progress((completedCount / segments.length) * 100);
          
        } catch (error) {
          // Mark segment as failed
          await this.manifestPersistence.updateSegment(segment.id, {
            status: 'FAILED',
            failureReason: error.message,
          });
          
          this.logger.error({
            message: 'TTS segment generation failed',
            segmentId: segment.id,
            error: error.message,
          });
        }
      }
      
      // 6. Calculate total duration
      const totalDuration = segments.reduce(
        (sum, s) => sum + (s.duration || 0),
        0
      );
      
      // 7. Mark as completed
      await this.manifestPersistence.updateStatus(manifestId, 'COMPLETED', {
        completedAt: new Date(),
        totalDuration,
      });
      
      // 8. Record usage
      if (connection.userId) {
        await this.usagePort.recordUsage({
          userId: connection.userId,
          connectionId: connection.id,
          provider: connection.provider,
          characterCount: manifest.characterCount,
          segmentCount: segments.length,
          totalDuration,
          estimatedCost: manifest.estimatedCost,
          chapterId: manifest.chapterId,
          manifestId: manifest.id,
        });
      }
      
      this.logger.log({
        message: 'TTS manifest generation completed',
        manifestId,
        completedSegments: completedCount,
        totalSegments: segments.length,
      });
      
    } catch (error) {
      this.logger.error({
        message: 'TTS manifest generation failed',
        manifestId,
        error: error.message,
      });
      
      await this.manifestPersistence.updateStatus(manifestId, 'FAILED', {
        failureReason: error.message,
      });
      
      throw error;
    }
  }
}
```

**Files to create:**
- `backend/src/modules/tts/application/commands/generate-tts-manifest/*`
- `backend/src/modules/tts/application/commands/delete-tts-manifest/*`
- `backend/src/modules/tts/application/queries/get-tts-manifest/*`
- `backend/src/modules/tts/application/queries/list-user-manifests/*`
- `backend/src/modules/tts/infrastructure/queue/tts-generation.processor.ts`
- `backend/src/modules/tts/application/ports/tts-manifest-persistence.port.ts`
- `backend/src/modules/tts/application/ports/tts-generation-queue.port.ts`
- `backend/src/modules/tts/application/ports/tts-quota.port.ts`

---

#### Phase 2.3: HTTP API & Module Wiring (1 ngày)

**File:** `backend/src/modules/tts/presentation/http/controllers/tts.controller.ts`

```typescript
@Controller('tts')
@ApiTags('Text-to-Speech')
export class TtsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}
  
  @Post('manifests')
  @ApiOperation({ summary: 'Generate TTS manifest for chapter' })
  @ApiResponse({ status: 201, type: TtsManifestResponse })
  async generateManifest(
    @Body() dto: GenerateTtsManifestRequest,
    @CurrentUserId() userId: string,
  ): Promise<TtsManifestResponse> {
    const command = new GenerateTtsManifestCommand(
      userId,
      dto.chapterId,
      dto.connectionId,
      dto.language,
    );
    
    const result = await this.commandBus.execute(command);
    return TtsManifestResponse.from(result);
  }
  
  @Get('manifests/:id')
  @ApiOperation({ summary: 'Get TTS manifest with segments' })
  @ApiResponse({ status: 200, type: TtsManifestWithSegmentsResponse })
  async getManifest(
    @Param('id') manifestId: string,
  ): Promise<TtsManifestWithSegmentsResponse> {
    const query = new GetTtsManifestQuery(manifestId);
    const result = await this.queryBus.execute(query);
    return TtsManifestWithSegmentsResponse.from(result);
  }
  
  @Get('connections')
  @ApiOperation({ summary: 'List user TTS connections' })
  async listConnections(
    @CurrentUserId() userId: string,
  ): Promise<TtsConnectionResponse[]> {
    const query = new ListUserTtsConnectionsQuery(userId);
    const result = await this.queryBus.execute(query);
    return result.map(TtsConnectionResponse.from);
  }
  
  @Get('quota')
  @ApiOperation({ summary: 'Get TTS quota info' })
  async getQuota(
    @CurrentUserId() userId: string,
  ): Promise<TtsQuotaResponse> {
    const query = new GetTtsQuotaQuery(userId);
    const result = await this.queryBus.execute(query);
    return TtsQuotaResponse.from(result);
  }
}
```

**File:** `backend/src/modules/tts/tts.module.ts`

```typescript
@Module({
  imports: [
    PrismaModule,
    QueueModule,
    MediaModule,
  ],
  controllers: [
    TtsController,
    AdminTtsController,
  ],
  providers: [
    // Providers
    ElevenLabsTtsProvider,
    WebSpeechTtsProvider,
    GoogleCloudTtsProvider,
    AzureTtsProvider,
    
    // Persistence
    PrismaTtsManifestPersistence,
    PrismaTtsConnectionPersistence,
    PrismaTtsQuotaPersistence,
    PrismaTtsUsagePersistence,
    
    // Queue
    TtsGenerationQueueAdapter,
    TtsGenerationProcessor,
    
    // Handlers
    GenerateTtsManifestCommandHandler,
    GetTtsManifestQueryHandler,
    ListUserTtsConnectionsQueryHandler,
    GetTtsQuotaQueryHandler,
    
    // Ports
    {
      provide: TTS_PROVIDER_REGISTRY_PORT,
      useClass: TtsProviderRegistry,
    },
    {
      provide: TTS_MANIFEST_PERSISTENCE_PORT,
      useExisting: PrismaTtsManifestPersistence,
    },
    // ... other port providers
  ],
  exports: [
    TTS_MANIFEST_PERSISTENCE_PORT,
  ],
})
export class TtsModule {}
```

---

### 3. Frontend Implementation (3-4 ngày)

#### Phase 3.1: Web Speech API Service (1 ngày)

**File:** `frontend/src/app/core/tts/web-speech-tts.service.ts`

```typescript
import { Injectable, signal } from '@angular/core';

export interface TtsPlayback {
  segmentIndex: number;
  blockId: string;
  currentTime: number;
  duration: number;
  playing: boolean;
}

@Injectable({ providedIn: 'root' })
export class WebSpeechTtsService {
  private synthesis = window.speechSynthesis;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  
  playback = signal<TtsPlayback | null>(null);
  voices = signal<SpeechSynthesisVoice[]>([]);
  
  constructor() {
    this.loadVoices();
  }
  
  private loadVoices(): void {
    const voices = this.synthesis.getVoices();
    this.voices.set(voices);
    
    // Load again when voices change (async in some browsers)
    this.synthesis.onvoiceschanged = () => {
      this.voices.set(this.synthesis.getVoices());
    };
  }
  
  speak(
    text: string,
    options: {
      voiceName?: string;
      language?: string;
      rate?: number;
      pitch?: number;
      volume?: number;
      onBoundary?: (event: SpeechSynthesisEvent) => void;
      onEnd?: () => void;
    } = {}
  ): void {
    // Cancel current
    this.stop();
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Configure voice
    if (options.voiceName) {
      const voice = this.voices().find(v => v.name === options.voiceName);
      if (voice) utterance.voice = voice;
    }
    
    if (options.language) {
      utterance.lang = options.language;
    }
    
    // Configure parameters
    utterance.rate = options.rate ?? 1.0;
    utterance.pitch = options.pitch ?? 1.0;
    utterance.volume = options.volume ?? 1.0;
    
    // Events
    utterance.onboundary = (event) => {
      options.onBoundary?.(event);
    };
    
    utterance.onend = () => {
      this.playback.set(null);
      options.onEnd?.();
    };
    
    utterance.onerror = (event) => {
      console.error('Speech synthesis error', event);
      this.playback.set(null);
    };
    
    this.currentUtterance = utterance;
    this.synthesis.speak(utterance);
  }
  
  pause(): void {
    if (this.synthesis.speaking) {
      this.synthesis.pause();
    }
  }
  
  resume(): void {
    if (this.synthesis.paused) {
      this.synthesis.resume();
    }
  }
  
  stop(): void {
    this.synthesis.cancel();
    this.currentUtterance = null;
    this.playback.set(null);
  }
  
  setRate(rate: number): void {
    // For Web Speech API, need to restart with new rate
    // Store current position and restart
  }
}
```

---

#### Phase 3.2: AI TTS Player (2 ngày)

**File:** `frontend/src/app/core/tts/ai-tts-player.service.ts`

```typescript
@Injectable({ providedIn: 'root' })
export class AiTtsPlayerService {
  private audio: HTMLAudioElement | null = null;
  private currentManifest: TtsManifestWithSegments | null = null;
  private currentSegmentIndex = 0;
  
  playback = signal<TtsPlayback>({
    segmentIndex: 0,
    blockId: '',
    currentTime: 0,
    duration: 0,
    playing: false,
  });
  
  async loadManifest(manifestId: string): Promise<void> {
    const manifest = await this.repository.getManifest(manifestId);
    this.currentManifest = manifest;
    this.currentSegmentIndex = 0;
  }
  
  async play(segmentIndex?: number): Promise<void> {
    if (!this.currentManifest) return;
    
    if (segmentIndex !== undefined) {
      this.currentSegmentIndex = segmentIndex;
    }
    
    const segment = this.currentManifest.segments[this.currentSegmentIndex];
    
    if (!segment || segment.status !== 'GENERATED') {
      console.warn('Segment not ready', segment);
      return;
    }
    
    // Create or reuse audio element
    if (!this.audio) {
      this.audio = new Audio();
      this.setupAudioListeners();
    }
    
    // Load segment audio
    this.audio.src = segment.audioUrl;
    this.audio.playbackRate = this.getPlaybackRate();
    
    try {
      await this.audio.play();
      
      this.playback.update(p => ({
        ...p,
        segmentIndex: this.currentSegmentIndex,
        blockId: segment.blockId,
        playing: true,
        duration: segment.duration || 0,
      }));
    } catch (error) {
      console.error('Playback failed', error);
    }
  }
  
  pause(): void {
    this.audio?.pause();
    this.playback.update(p => ({ ...p, playing: false }));
  }
  
  resume(): void {
    this.audio?.play();
    this.playback.update(p => ({ ...p, playing: true }));
  }
  
  stop(): void {
    this.audio?.pause();
    if (this.audio) {
      this.audio.currentTime = 0;
    }
    this.playback.set({
      segmentIndex: 0,
      blockId: '',
      currentTime: 0,
      duration: 0,
      playing: false,
    });
  }
  
  next(): void {
    if (!this.currentManifest) return;
    
    if (this.currentSegmentIndex < this.currentManifest.segments.length - 1) {
      this.currentSegmentIndex++;
      this.play();
    }
  }
  
  previous(): void {
    if (this.currentSegmentIndex > 0) {
      this.currentSegmentIndex--;
      this.play();
    }
  }
  
  setSpeed(speed: number): void {
    if (this.audio) {
      this.audio.playbackRate = speed;
      localStorage.setItem('tts-playback-rate', speed.toString());
    }
  }
  
  private getPlaybackRate(): number {
    const saved = localStorage.getItem('tts-playback-rate');
    return saved ? parseFloat(saved) : 1.0;
  }
  
  private setupAudioListeners(): void {
    if (!this.audio) return;
    
    this.audio.ontimeupdate = () => {
      if (!this.audio) return;
      
      this.playback.update(p => ({
        ...p,
        currentTime: this.audio!.currentTime,
      }));
    };
    
    this.audio.onended = () => {
      // Auto-play next segment
      this.next();
    };
    
    this.audio.onerror = (event) => {
      console.error('Audio error', event);
      this.playback.update(p => ({ ...p, playing: false }));
    };
  }
}
```

---

#### Phase 3.3: TTS UI Controls (1 ngày)

**File:** `frontend/src/app/features/public/chapter-reader/ui/tts-player/tts-player.component.ts`

```typescript
@Component({
  selector: 'app-tts-player',
  standalone: true,
  template: `
    <div class="tts-player" [class.expanded]="expanded()">
      <div class="player-header">
        <button (click)="toggleExpand()" class="expand-btn">
          <span class="icon">🎧</span>
          <span>Audio Reader</span>
        </button>
        
        @if (manifest()) {
          <span class="status">
            {{ manifest()!.completedSegments }} / {{ manifest()!.totalSegments }} segments
          </span>
        }
      </div>
      
      @if (expanded()) {
        <div class="player-controls">
          <!-- Voice selection -->
          <div class="control-group">
            <label>Voice:</label>
            <select [(ngModel)]="selectedConnectionId" (change)="onConnectionChange()">
              <option value="web-speech">Browser (Free)</option>
              @for (conn of connections(); track conn.id) {
                <option [value]="conn.id">
                  {{ conn.voiceName }} ({{ conn.provider }})
                </option>
              }
            </select>
          </div>
          
          <!-- Playback controls -->
          <div class="playback-controls">
            <button (click)="previous()" [disabled]="!canGoPrevious()">
              ⏮
            </button>
            
            @if (playback()?.playing) {
              <button (click)="pause()" class="play-pause">
                ⏸
              </button>
            } @else {
              <button (click)="play()" class="play-pause">
                ▶
              </button>
            }
            
            <button (click)="next()" [disabled]="!canGoNext()">
              ⏭
            </button>
            
            <button (click)="stop()">
              ⏹
            </button>
          </div>
          
          <!-- Speed control -->
          <div class="control-group">
            <label>Speed: {{ speed() }}x</label>
            <input 
              type="range" 
              min="0.5" 
              max="2.0" 
              step="0.1"
              [(ngModel)]="speed"
              (input)="onSpeedChange()" />
          </div>
          
          <!-- Progress -->
          @if (playback()) {
            <div class="progress-bar">
              <div 
                class="progress-fill"
                [style.width.%]="(playback()!.currentTime / playback()!.duration) * 100">
              </div>
            </div>
            <div class="time-display">
              {{ formatTime(playback()!.currentTime) }} / {{ formatTime(playback()!.duration) }}
            </div>
          }
          
          <!-- Quota info -->
          @if (quota()) {
            <div class="quota-info">
              Quota: {{ quota()!.currentMonthUsage }} / {{ quota()!.monthlyCharacterLimit }} chars
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [/* ... */]
})
export class TtsPlayerComponent implements OnInit {
  private webSpeechService = inject(WebSpeechTtsService);
  private aiTtsService = inject(AiTtsPlayerService);
  private repository = inject(TtsRepository);
  
  @Input() chapterId = input.required<string>();
  
  expanded = signal(false);
  connections = signal<TtsConnection[]>([]);
  selectedConnectionId = signal<string>('web-speech');
  manifest = signal<TtsManifest | null>(null);
  playback = computed(() => {
    return this.selectedConnectionId() === 'web-speech'
      ? this.webSpeechService.playback()
      : this.aiTtsService.playback();
  });
  quota = signal<TtsQuota | null>(null);
  speed = signal(1.0);
  
  async ngOnInit() {
    await this.loadConnections();
    await this.loadQuota();
  }
  
  async onConnectionChange() {
    const connId = this.selectedConnectionId();
    
    if (connId === 'web-speech') {
      // Use Web Speech API
      return;
    }
    
    // Generate or load AI manifest
    await this.loadOrGenerateManifest(connId);
  }
  
  async loadOrGenerateManifest(connectionId: string) {
    try {
      // Try to find existing manifest
      let manifest = await this.repository.findManifest({
        chapterId: this.chapterId(),
        connectionId,
        language: 'vi-VN',
      });
      
      if (!manifest) {
        // Generate new manifest
        manifest = await this.repository.generateManifest({
          chapterId: this.chapterId(),
          connectionId,
          language: 'vi-VN',
        });
      }
      
      this.manifest.set(manifest);
      await this.aiTtsService.loadManifest(manifest.id);
      
    } catch (error) {
      console.error('Failed to load manifest', error);
      alert('Failed to load TTS manifest');
    }
  }
  
  play() {
    if (this.selectedConnectionId() === 'web-speech') {
      // Get chapter text blocks
      const blocks = this.getChapterBlocks();
      this.webSpeechService.speak(blocks.join('\n\n'));
    } else {
      this.aiTtsService.play();
    }
  }
  
  pause() {
    if (this.selectedConnectionId() === 'web-speech') {
      this.webSpeechService.pause();
    } else {
      this.aiTtsService.pause();
    }
  }
  
  onSpeedChange() {
    const newSpeed = this.speed();
    
    if (this.selectedConnectionId() === 'web-speech') {
      // Web Speech API needs to restart
    } else {
      this.aiTtsService.setSpeed(newSpeed);
    }
  }
}
```

---

## 📝 IMPLEMENTATION ORDER

### Day 1-2: TTS Provider Port & Implementations
- [ ] Database migration
- [ ] TTS provider port interface
- [ ] ElevenLabs provider implementation
- [ ] Web Speech provider stub
- [ ] Tests

### Day 3-5: Manifest Generation & Worker
- [ ] Generate manifest command
- [ ] TTS generation worker
- [ ] Segment processing
- [ ] Cloudinary upload integration
- [ ] Tests

### Day 6: HTTP API & Module Wiring
- [ ] TTS controllers
- [ ] Request/Response DTOs
- [ ] Module registration
- [ ] E2E tests

### Day 7: Web Speech API Frontend
- [ ] WebSpeechTtsService
- [ ] Basic playback controls
- [ ] Speed control
- [ ] Tests

### Day 8-9: AI TTS Player Frontend
- [ ] AiTtsPlayerService
- [ ] Manifest loading
- [ ] Segment playback
- [ ] Auto-scroll integration
- [ ] Tests

### Day 10: TTS UI Controls
- [ ] TtsPlayerComponent
- [ ] Voice selection
- [ ] Quota display
- [ ] Progress bar
- [ ] E2E tests

### Day 11-12: Integration & Polish
- [ ] Auto-scroll on playback
- [ ] Word-level highlighting
- [ ] Error handling
- [ ] Documentation

---

## 🧪 TESTING STRATEGY

### Security Tests
- [ ] Cannot access other user's manifests
- [ ] Quota enforcement
- [ ] Provider credentials encrypted

### Functional Tests
- [ ] Generate manifest → segments created
- [ ] Worker generates audio → uploaded to Cloudinary
- [ ] Playback → auto-scrolls to block
- [ ] Speed change → applied without regenerating

### Performance Tests
- [ ] Worker processes 50 segments < 5 minutes
- [ ] Segment playback starts < 500ms
- [ ] Cache hit on repeat generation

---

## 🚨 RISKS & MITIGATION

### Risk 1: Provider API rate limits
**Mitigation:** Queue with backoff, batch processing, circuit breaker

### Risk 2: Audio generation costs
**Mitigation:** Strict quota limits, cache aggressively, warn users

### Risk 3: Large audio files
**Mitigation:** Segment-based approach, stream from Cloudinary

---

## 📚 DOCUMENTATION

- [ ] TTS provider setup guide
- [ ] API docs: TTS endpoints
- [ ] User guide: How to use TTS
- [ ] Cost estimation guide

---

## ✅ DEFINITION OF DONE

- [ ] All tests passing
- [ ] TTS providers working
- [ ] Quota enforced
- [ ] Web Speech API fallback functional
- [ ] Auto-scroll on playback
- [ ] Speed control working
- [ ] Documentation complete

---

**Critical Notes:**
1. **Separate from AI Gateway** - TTS is NOT chat
2. **Cache aggressively** - By chapter version + voice + style
3. **Segment-based** - Never generate full chapter audio at once
4. **Client-side speed** - No need to regenerate for different speeds
5. **Quota enforcement** - Prevent cost overruns
