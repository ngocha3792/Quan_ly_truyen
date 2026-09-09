# SPRINT 3 — Comic Pipeline và Inline Region
**Timeline:** 8–12 ngày  
**Mục tiêu:** Tối ưu hiển thị chapter comic dài với eager transformations, slice-based loading và inline comments

---

## 🎯 ACCEPTANCE CRITERIA

✅ Thiết bị RAM thấp đọc chương dài không giữ toàn bộ bitmap trong memory  
✅ Cloudinary eager transformations: AVIF/WebP/JPEG fallback  
✅ Ảnh dài tự động chia thành slices (~1200-2000px mỗi slice)  
✅ Frontend chỉ load slices quanh viewport (IntersectionObserver/windowing)  
✅ Không layout shift (placeholder theo aspect ratio)  
✅ Comic inline comments dùng normalized region (x/y/width/height)  
✅ Signed/authenticated Cloudinary delivery cho ảnh trả phí

---

## 📊 PHÂN TÍCH HIỆN TẠI (Dựa trên Repo)

### Backend Architecture hiện tại:

**Media Module:**
- `MediaAsset` model có `width`, `height`, `format`, `publicId`, `resourceType`
- `ChapterMedia` junction table: `chapterId`, `mediaAssetId`, `sortOrder`, `altText`, `caption`
- Cloudinary adapter: `cloudinary-media.adapter.ts`, `cloudinary-url.adapter.ts`
- Webhook inbox worker: xử lý upload success/failure từ Cloudinary
- Upload flow: Intent → Direct upload → Confirm → Webhook reconciliation

**Thiếu:**
- ❌ Eager transformations (hiện chỉ có `fetch_format: 'auto'` at delivery time)
- ❌ ChapterMediaSlice model cho ảnh dài
- ❌ Worker xử lý post-upload slicing
- ❌ Signed URL cho authenticated delivery

**Frontend Architecture hiện tại:**
- `chapter-reader-page.component.ts`: Hiển thị chapter content
- `ChapterReaderStore`: State management
- Chưa có lazy loading/windowing cho images

---

## 🏗️ TECHNICAL DESIGN

### 1. Database Schema Changes

**Thêm table mới:**
```prisma
model ChapterMediaSlice {
  id               String   @id @default(uuid()) @db.Uuid
  chapterMediaId   String   @map("chapter_media_id") @db.Uuid  // FK to ChapterMedia
  sliceIndex       Int      @map("slice_index")     // 0-based slice order
  
  // Dimensions
  width            Int                               // Slice width (px)
  height           Int                               // Slice height (px)
  offsetY          Int      @map("offset_y")        // Vertical offset in original (px)
  aspectRatio      Decimal  @map("aspect_ratio") @db.Decimal(10, 4)
  
  // Cloudinary
  publicId         String   @map("public_id") @db.VarChar(512)
  format           String   @db.VarChar(30)
  sizeBytes        BigInt?  @map("size_bytes")
  
  // Transformations (eager)
  avifPublicId     String?  @map("avif_public_id") @db.VarChar(512)
  webpPublicId     String?  @map("webp_public_id") @db.VarChar(512)
  
  processingStatus String   @default("PENDING") @db.VarChar(30) // PENDING|PROCESSING|READY|FAILED
  processingError  String?  @map("processing_error") @db.Text
  
  createdAt        DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt        DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)
  
  chapterMedia ChapterMedia @relation(fields: [chapterMediaId], references: [chapterId, mediaAssetId], onDelete: Cascade)
  
  @@unique([chapterMediaId, sliceIndex])
  @@index([processingStatus])
  @@map("chapter_media_slices")
}

// Thêm relation vào ChapterMedia
model ChapterMedia {
  // ... existing fields ...
  slices ChapterMediaSlice[]
}
```

**Migration checklist:**
- [ ] Tạo migration `add_chapter_media_slices`
- [ ] Thêm enum `MediaProcessingStatus` nếu chưa có
- [ ] Index trên `processingStatus` cho worker queries
- [ ] Backfill script cho ảnh đã tồn tại (optional)

---

### 2. Backend Implementation

#### Phase 2.1: Eager Transformations (2 ngày)

**File:** `backend/src/modules/media/infrastructure/cloudinary/cloudinary-media.adapter.ts`

**Task 2.1.1: Thêm eager transformations vào upload**
```typescript
// Modify uploadBuffer() method
const options: UploadApiOptions = {
  public_id: input.publicId,
  asset_folder: input.assetFolder,
  resource_type: input.resourceType,
  upload_preset: input.uploadPreset,
  overwrite: false,
  
  // ✅ NEW: Eager transformations
  eager: [
    // AVIF - best compression
    { format: 'avif', quality: 'auto', width: 1600, crop: 'limit' },
    // WebP - good fallback
    { format: 'webp', quality: 'auto', width: 1600, crop: 'limit' },
    // JPEG - universal fallback
    { format: 'jpg', quality: 'auto:good', width: 1600, crop: 'limit' },
  ],
  eager_async: true, // Process async to not block upload
  eager_notification_url: `${apiBaseUrl}/api/v1/webhooks/cloudinary`, // Webhook when ready
};
```

**Task 2.1.2: Update CloudinaryUrlAdapter với format selection**
```typescript
// cloudinary-url.adapter.ts
build(input: BuildMediaUrlInput): string {
  const transformation = this.resolveTransformation(input.preset);
  
  // ✅ NEW: Support format override
  if (input.preferredFormat) {
    transformation.push({ format: input.preferredFormat });
  }
  
  return this.cloudinary.url(input.publicId, {
    secure: true,
    resource_type: 'image',
    type: 'upload',
    transformation,
    sign_url: input.requiresSigning ?? false, // ✅ NEW: Signed URLs
  });
}
```

**Task 2.1.3: Webhook handler nhận eager completion**
```typescript
// cloudinary-webhook-inbox.processor.ts
// Thêm handler cho notification_type: 'eager'
private async handleEagerNotification(event: CloudinaryWebhookEvent) {
  // Update MediaAsset với eager transformation URLs
  // Trigger slice processing nếu là chapterImage
}
```

**Files to modify:**
- `backend/src/modules/media/infrastructure/cloudinary/cloudinary-media.adapter.ts`
- `backend/src/modules/media/infrastructure/cloudinary/cloudinary-url.adapter.ts`
- `backend/src/modules/media/infrastructure/cloudinary/cloudinary-webhook-inbox.processor.ts`
- `backend/src/modules/media/application/ports/media-url.port.ts` (add format param)

**Tests:**
- Unit: `cloudinary-media.adapter.spec.ts`
- Integration: Upload image, verify eager transformations created
- Webhook: Mock eager notification, verify handling

---

#### Phase 2.2: Image Slicing Worker (3 ngày)

**Task 2.2.1: Create Slicing Domain Logic**

**File:** `backend/src/modules/media/domain/policies/image-slicing.policy.ts`
```typescript
export class ImageSlicingPolicy {
  static readonly MIN_HEIGHT_FOR_SLICING = 2000; // px
  static readonly TARGET_SLICE_HEIGHT = 1600;    // px
  static readonly MAX_SLICE_HEIGHT = 2000;       // px
  
  static shouldSliceImage(width: number, height: number): boolean {
    return height >= this.MIN_HEIGHT_FOR_SLICING;
  }
  
  static calculateSlices(imageHeight: number): SliceSpec[] {
    if (imageHeight < this.MIN_HEIGHT_FOR_SLICING) {
      return []; // No slicing needed
    }
    
    const sliceCount = Math.ceil(imageHeight / this.TARGET_SLICE_HEIGHT);
    const actualSliceHeight = Math.ceil(imageHeight / sliceCount);
    
    const slices: SliceSpec[] = [];
    for (let i = 0; i < sliceCount; i++) {
      const offsetY = i * actualSliceHeight;
      const height = Math.min(actualSliceHeight, imageHeight - offsetY);
      
      slices.push({
        index: i,
        offsetY,
        height,
      });
    }
    
    return slices;
  }
}

export interface SliceSpec {
  index: number;
  offsetY: number;
  height: number;
}
```

**Task 2.2.2: Create Slicing Command & Handler**

**File:** `backend/src/modules/media/application/commands/process-image-slicing/process-image-slicing.command.ts`
```typescript
export class ProcessImageSlicingCommand {
  constructor(
    public readonly mediaAssetId: string,
    public readonly chapterMediaId: { chapterId: string; mediaAssetId: string },
  ) {}
}
```

**File:** `backend/src/modules/media/application/commands/process-image-slicing/process-image-slicing.command-handler.ts`
```typescript
@Injectable()
export class ProcessImageSlicingCommandHandler {
  constructor(
    @Inject(MEDIA_QUERY_PORT) private readonly mediaQuery: MediaQueryPort,
    @Inject(MEDIA_STORAGE_PORT) private readonly storage: MediaStoragePort,
    private readonly prisma: PrismaService,
    private readonly logger: Logger,
  ) {}
  
  async execute(command: ProcessImageSlicingCommand): Promise<void> {
    // 1. Get MediaAsset dimensions
    const asset = await this.mediaQuery.findById(command.mediaAssetId);
    if (!asset.width || !asset.height) {
      throw new InvalidInputException('Image dimensions not available');
    }
    
    // 2. Check if slicing needed
    if (!ImageSlicingPolicy.shouldSliceImage(asset.width, asset.height)) {
      this.logger.log(`Image ${asset.id} too short for slicing`);
      return;
    }
    
    // 3. Calculate slices
    const sliceSpecs = ImageSlicingPolicy.calculateSlices(asset.height);
    
    // 4. Generate Cloudinary transformation URLs for each slice
    const sliceRecords = sliceSpecs.map((spec) => ({
      id: randomUUID(),
      chapterMediaId: command.chapterMediaId,
      sliceIndex: spec.index,
      width: asset.width,
      height: spec.height,
      offsetY: spec.offsetY,
      aspectRatio: asset.width / spec.height,
      
      // Cloudinary crop transformation
      publicId: this.buildSlicePublicId(asset.publicId, spec.index),
      format: asset.format,
      
      processingStatus: 'READY',
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    
    // 5. Persist slices to DB
    await this.prisma.chapterMediaSlice.createMany({
      data: sliceRecords,
    });
    
    this.logger.log(`Created ${sliceRecords.length} slices for image ${asset.id}`);
  }
  
  private buildSlicePublicId(originalPublicId: string, sliceIndex: number): string {
    // Cloudinary derived transformation approach
    // Option A: Use original publicId + transformation params in URL
    // Option B: Generate explicit slice with uploader.explicit()
    return `${originalPublicId}_slice_${sliceIndex}`;
  }
}
```

**Task 2.2.3: Integrate slicing into upload workflow**

**File:** `backend/src/modules/media/infrastructure/cloudinary/cloudinary-webhook-inbox.processor.ts`
```typescript
private async handleUploadSuccess(event: InboundWebhookEvent) {
  // ... existing upload handling ...
  
  // ✅ NEW: Trigger slicing for chapter images
  if (mediaAsset.purpose === 'CHAPTER_IMAGE') {
    const chapterMedia = await this.prisma.chapterMedia.findFirst({
      where: { mediaAssetId: mediaAsset.id },
    });
    
    if (chapterMedia) {
      // Enqueue slicing job (async)
      await this.queueSlicingJob({
        mediaAssetId: mediaAsset.id,
        chapterMediaId: {
          chapterId: chapterMedia.chapterId,
          mediaAssetId: chapterMedia.mediaAssetId,
        },
      });
    }
  }
}
```

**Task 2.2.4: Create Queue Processor**

**File:** `backend/src/modules/media/infrastructure/queue/media-slicing.processor.ts`
```typescript
@Processor('media')
export class MediaSlicingProcessor {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly logger: Logger,
  ) {}
  
  @Process('process-image-slicing')
  async handleSlicing(job: Job<ProcessImageSlicingJobData>) {
    try {
      const command = new ProcessImageSlicingCommand(
        job.data.mediaAssetId,
        job.data.chapterMediaId,
      );
      await this.commandBus.execute(command);
    } catch (error) {
      this.logger.error(`Image slicing failed: ${error.message}`, error.stack);
      throw error; // Retry via BullMQ
    }
  }
}
```

**Files to create:**
- `backend/src/modules/media/domain/policies/image-slicing.policy.ts`
- `backend/src/modules/media/application/commands/process-image-slicing/*`
- `backend/src/modules/media/infrastructure/queue/media-slicing.processor.ts`

**Files to modify:**
- `backend/src/modules/media/infrastructure/cloudinary/cloudinary-webhook-inbox.processor.ts`
- `backend/src/modules/media/media.module.ts` (register processor)

**Tests:**
- Unit: `image-slicing.policy.spec.ts` - verify slice calculation
- Integration: Upload tall image, verify slices created
- E2E: Full flow from upload to slice availability

---

#### Phase 2.3: Signed/Authenticated URLs (1 ngày)

**Task 2.3.1: Implement signed URL generation**

**File:** `backend/src/modules/media/infrastructure/cloudinary/cloudinary-url.adapter.ts`
```typescript
build(input: BuildMediaUrlInput): string {
  if (!this.cloudinary) {
    throw new MediaStorageDisabledException();
  }
  
  const transformation = this.resolveTransformation(input.preset);
  const options: any = {
    secure: true,
    resource_type: input.resourceType === 'video' ? 'video' : 'image',
    type: 'upload',
    transformation,
  };
  
  // ✅ NEW: Signed URLs for authenticated content
  if (input.requiresSigning) {
    options.sign_url = true;
    options.type = 'authenticated'; // Cloudinary authenticated type
  }
  
  return this.cloudinary.url(input.publicId, options);
}
```

**Task 2.3.2: Add authentication check in chapter reader**

**File:** `backend/src/modules/chapters/application/queries/get-public-chapter/get-public-chapter.query-handler.ts`
```typescript
// Modify to include signed URLs for paid chapters
const chapter = await this.chapterReader.findPublicChapter(query);

// ✅ NEW: Generate signed URLs if chapter requires payment
if (chapter.accessType === 'PAID' && chapter.accessState === 'UNLOCKED') {
  chapter.media = chapter.media.map(m => ({
    ...m,
    url: this.mediaUrl.build({
      publicId: m.publicId,
      preset: 'chapterImage',
      requiresSigning: true, // ✅ Signed URL
    }),
  }));
}
```

**Files to modify:**
- `backend/src/modules/media/infrastructure/cloudinary/cloudinary-url.adapter.ts`
- `backend/src/modules/media/application/ports/media-url.port.ts`
- `backend/src/modules/chapters/application/queries/get-public-chapter/*`

**Tests:**
- Unit: Verify signed URL has signature parameter
- Integration: Verify unauthenticated access to signed URL fails (if Cloudinary supports)

---

#### Phase 2.4: Chapter Slices API (1 ngày)

**Task 2.4.1: Add slices to ChapterDTO**

**File:** `backend/src/modules/chapters/application/dto/public-chapter-reader.dto.ts`
```typescript
export interface PublicChapterReaderDto {
  // ... existing fields ...
  media: ChapterMediaDto[];
}

export interface ChapterMediaDto {
  id: string;
  sortOrder: number;
  altText?: string;
  caption?: string;
  
  // Original image
  width: number;
  height: number;
  url: string;
  
  // ✅ NEW: Slices (if image is tall)
  slices?: ChapterMediaSliceDto[];
}

export interface ChapterMediaSliceDto {
  sliceIndex: number;
  width: number;
  height: number;
  offsetY: number;
  aspectRatio: number;
  
  // URLs for different formats
  urls: {
    avif?: string;
    webp?: string;
    jpeg: string;
  };
}
```

**Task 2.4.2: Modify chapter persistence to include slices**

**File:** `backend/src/modules/chapters/infrastructure/persistence/prisma-chapter.persistence.ts`
```typescript
// Add slices to CHAPTER_MEDIA_SELECT
const CHAPTER_MEDIA_SELECT = {
  // ... existing ...
  slices: {
    select: {
      sliceIndex: true,
      width: true,
      height: true,
      offsetY: true,
      aspectRatio: true,
      publicId: true,
      format: true,
      avifPublicId: true,
      webpPublicId: true,
    },
    orderBy: { sliceIndex: 'asc' },
  },
};

// Map slices in result mapper
private mapChapterMedia(media: ChapterMediaRow): ChapterMediaDto {
  return {
    // ... existing ...
    slices: media.slices?.map(slice => ({
      sliceIndex: slice.sliceIndex,
      width: slice.width,
      height: slice.height,
      offsetY: slice.offsetY,
      aspectRatio: slice.aspectRatio.toNumber(),
      urls: {
        avif: slice.avifPublicId ? this.mediaUrl.build({
          publicId: slice.avifPublicId,
          preset: 'chapterImage',
        }) : undefined,
        webp: slice.webpPublicId ? this.mediaUrl.build({
          publicId: slice.webpPublicId,
          preset: 'chapterImage',
        }) : undefined,
        jpeg: this.mediaUrl.build({
          publicId: slice.publicId,
          preset: 'chapterImage',
        }),
      },
    })),
  };
}
```

**Files to modify:**
- `backend/src/modules/chapters/application/dto/public-chapter-reader.dto.ts`
- `backend/src/modules/chapters/infrastructure/persistence/prisma-chapter.persistence.ts`

**Tests:**
- Integration: Fetch chapter with sliced images, verify slices in response

---

### 3. Frontend Implementation (3 ngày)

#### Phase 3.1: Slice-based Image Rendering (2 ngày)

**Task 3.1.1: Create ChapterImageSlices component**

**File:** `frontend/src/app/features/public/chapter-reader/ui/chapter-image-slices/chapter-image-slices.component.ts`
```typescript
import { Component, Input, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

interface ImageSlice {
  sliceIndex: number;
  width: number;
  height: number;
  aspectRatio: number;
  urls: {
    avif?: string;
    webp?: string;
    jpeg: string;
  };
}

@Component({
  selector: 'app-chapter-image-slices',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="chapter-image-container">
      @for (slice of slices(); track slice.sliceIndex) {
        <div 
          class="image-slice-wrapper"
          [style.padding-bottom.%]="(100 / slice.aspectRatio)"
          [attr.data-slice-index]="slice.sliceIndex">
          
          <!-- Placeholder with aspect ratio to prevent layout shift -->
          <div class="slice-placeholder"></div>
          
          <!-- Lazy-loaded image -->
          <picture 
            #pictureElement
            class="slice-image"
            [class.loaded]="loadedSlices().has(slice.sliceIndex)"
            (load)="onSliceLoad(slice.sliceIndex)">
            
            @if (slice.urls.avif) {
              <source [srcset]="slice.urls.avif" type="image/avif">
            }
            @if (slice.urls.webp) {
              <source [srcset]="slice.urls.webp" type="image/webp">
            }
            <img 
              [src]="slice.urls.jpeg"
              [alt]="altText() || 'Chapter image slice ' + slice.sliceIndex"
              loading="lazy"
              [width]="slice.width"
              [height]="slice.height">
          </picture>
        </div>
      }
    </div>
  `,
  styles: [`
    .chapter-image-container {
      width: 100%;
      max-width: 1200px;
      margin: 0 auto;
    }
    
    .image-slice-wrapper {
      position: relative;
      width: 100%;
      overflow: hidden;
      background: #f0f0f0;
    }
    
    .slice-placeholder {
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }
    
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    
    .slice-image {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    
    .slice-image.loaded {
      opacity: 1;
    }
    
    .slice-image img {
      width: 100%;
      height: auto;
      display: block;
    }
  `]
})
export class ChapterImageSlicesComponent implements OnInit, OnDestroy {
  @Input() slices = signal<ImageSlice[]>([]);
  @Input() altText = signal<string | undefined>(undefined);
  
  protected loadedSlices = signal(new Set<number>());
  private observer?: IntersectionObserver;
  
  ngOnInit() {
    // Setup IntersectionObserver for lazy loading
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const sliceIndex = parseInt(
              entry.target.getAttribute('data-slice-index') || '0',
              10
            );
            // Browser's native lazy loading handles the actual load
            // We just track visibility
          }
        });
      },
      {
        rootMargin: '200px', // Load 200px before entering viewport
        threshold: 0.01,
      }
    );
    
    // Observe all slice wrappers
    setTimeout(() => {
      const wrappers = document.querySelectorAll('.image-slice-wrapper');
      wrappers.forEach(wrapper => this.observer?.observe(wrapper));
    }, 100);
  }
  
  ngOnDestroy() {
    this.observer?.disconnect();
  }
  
  protected onSliceLoad(sliceIndex: number) {
    this.loadedSlices.update(set => {
      const newSet = new Set(set);
      newSet.add(sliceIndex);
      return newSet;
    });
  }
}
```

**Task 3.1.2: Integrate into chapter reader**

**File:** `frontend/src/app/features/public/chapter-reader/pages/chapter-reader-page/chapter-reader-page.component.html`
```html
<!-- Modify chapter content rendering -->
<div class="chapter-content">
  @if (store.view(); as view) {
    @for (media of view.chapter.media; track media.id) {
      @if (media.slices && media.slices.length > 0) {
        <!-- ✅ NEW: Use slices for tall images -->
        <app-chapter-image-slices
          [slices]="media.slices"
          [altText]="media.altText"
        />
      } @else {
        <!-- Fallback: Single image -->
        <picture>
          <img 
            [src]="media.url" 
            [alt]="media.altText || 'Chapter image'"
            loading="lazy"
            [width]="media.width"
            [height]="media.height">
        </picture>
      }
    }
  }
</div>
```

**Files to create:**
- `frontend/src/app/features/public/chapter-reader/ui/chapter-image-slices/chapter-image-slices.component.ts`

**Files to modify:**
- `frontend/src/app/features/public/chapter-reader/domain/chapter-reader.models.ts` (add slice types)
- `frontend/src/app/features/public/chapter-reader/pages/chapter-reader-page/chapter-reader-page.component.html`

**Tests:**
- Unit: Component rendering with slices
- E2E: Playwright test lazy loading behavior

---

#### Phase 3.2: Inline Comic Comments (1 ngày)

**Task 3.2.1: Database schema for comment regions**

```prisma
// Add to Comment model
model Comment {
  // ... existing fields ...
  
  // ✅ NEW: Comic panel region (normalized coordinates)
  regionX      Decimal? @map("region_x") @db.Decimal(6, 4) // 0.0000 to 1.0000
  regionY      Decimal? @map("region_y") @db.Decimal(6, 4)
  regionWidth  Decimal? @map("region_width") @db.Decimal(6, 4)
  regionHeight Decimal? @map("region_height") @db.Decimal(6, 4)
  
  // Optional: Which image/slice this comment refers to
  mediaAssetId String? @map("media_asset_id") @db.Uuid
  sliceIndex   Int?    @map("slice_index")
}
```

**Task 3.2.2: Update comment creation API**

**File:** `backend/src/modules/comments/application/commands/create-comment/create-comment.command.ts`
```typescript
export class CreateCommentCommand {
  constructor(
    // ... existing ...
    public readonly region?: CommentRegion,
  ) {}
}

export interface CommentRegion {
  x: number;      // 0.0 to 1.0
  y: number;      // 0.0 to 1.0
  width: number;  // 0.0 to 1.0
  height: number; // 0.0 to 1.0
  mediaAssetId?: string;
  sliceIndex?: number;
}
```

**Task 3.2.3: Frontend comment overlay component**

**File:** `frontend/src/app/features/public/chapter-reader/ui/comic-comment-overlay/comic-comment-overlay.component.ts`
```typescript
@Component({
  selector: 'app-comic-comment-overlay',
  standalone: true,
  template: `
    <div class="comic-comment-overlay" (click)="onImageClick($event)">
      <!-- Image with slices -->
      <ng-content></ng-content>
      
      <!-- Comment markers -->
      @for (comment of comments(); track comment.id) {
        @if (comment.region) {
          <div 
            class="comment-marker"
            [style.left.%]="comment.region.x * 100"
            [style.top.%]="comment.region.y * 100"
            [style.width.%]="comment.region.width * 100"
            [style.height.%]="comment.region.height * 100"
            (click)="onCommentClick(comment, $event)">
            <span class="comment-count">{{ comment.replyCount || 1 }}</span>
          </div>
        }
      }
      
      <!-- Active comment thread -->
      @if (activeComment()) {
        <div 
          class="comment-thread-popup"
          [style.left.%]="activeComment().region.x * 100"
          [style.top.%]="(activeComment().region.y + activeComment().region.height) * 100">
          <app-comment-thread [comment]="activeComment()" />
        </div>
      }
    </div>
  `,
  styles: [`
    .comic-comment-overlay {
      position: relative;
      cursor: crosshair;
    }
    
    .comment-marker {
      position: absolute;
      border: 2px solid rgba(255, 200, 0, 0.8);
      background: rgba(255, 200, 0, 0.2);
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .comment-marker:hover {
      background: rgba(255, 200, 0, 0.4);
      border-width: 3px;
    }
    
    .comment-count {
      position: absolute;
      top: -12px;
      right: -12px;
      background: #ff6b00;
      color: white;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: bold;
    }
    
    .comment-thread-popup {
      position: absolute;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      padding: 16px;
      max-width: 400px;
      z-index: 10;
    }
  `]
})
export class ComicCommentOverlayComponent {
  @Input() comments = signal<CommentWithRegion[]>([]);
  @Output() commentCreate = new EventEmitter<CommentRegion>();
  
  protected activeComment = signal<CommentWithRegion | null>(null);
  
  onImageClick(event: MouseEvent) {
    if (this.activeComment()) {
      this.activeComment.set(null);
      return;
    }
    
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    
    // Create comment region (100px square normalized)
    const region: CommentRegion = {
      x: Math.max(0, x - 0.05),
      y: Math.max(0, y - 0.05),
      width: 0.1,
      height: 0.1,
    };
    
    this.commentCreate.emit(region);
  }
  
  onCommentClick(comment: CommentWithRegion, event: MouseEvent) {
    event.stopPropagation();
    this.activeComment.set(comment);
  }
}
```

**Files to create:**
- `frontend/src/app/features/public/chapter-reader/ui/comic-comment-overlay/comic-comment-overlay.component.ts`

**Files to modify:**
- `backend/src/modules/comments/application/commands/create-comment/*`
- `backend/prisma/schema.prisma` (add region fields)
- Frontend comment models and API

**Tests:**
- Unit: Region normalization calculation
- E2E: Click to add comment, verify region saved

---

## 📝 IMPLEMENTATION ORDER (Chi tiết theo ngày)

### Day 1-2: Backend Eager Transformations
- [ ] Add eager transformations to Cloudinary upload
- [ ] Update webhook handler for eager notifications
- [ ] Add format selection to URL adapter
- [ ] Tests: Upload image, verify AVIF/WebP/JPEG created

### Day 3-4: Database Schema & Slicing Logic
- [ ] Create migration for ChapterMediaSlice
- [ ] Implement ImageSlicingPolicy domain logic
- [ ] Create ProcessImageSlicingCommand & Handler
- [ ] Tests: Slice calculation for various heights

### Day 5-6: Slicing Worker Integration
- [ ] Create MediaSlicingProcessor (BullMQ)
- [ ] Integrate slicing trigger in webhook handler
- [ ] Update ChapterMedia queries to include slices
- [ ] Tests: End-to-end upload → slicing flow

### Day 7-8: Signed URLs & Chapter API
- [ ] Implement signed URL generation
- [ ] Add authentication check in chapter reader
- [ ] Update chapter DTOs with slices
- [ ] Tests: Verify signed URLs for paid content

### Day 9-10: Frontend Slice Rendering
- [ ] Create ChapterImageSlicesComponent
- [ ] Implement IntersectionObserver lazy loading
- [ ] Add aspect ratio placeholders
- [ ] Tests: Lazy loading behavior

### Day 11: Comic Inline Comments
- [ ] Add region fields to Comment schema
- [ ] Update comment creation with region
- [ ] Create ComicCommentOverlayComponent
- [ ] Tests: Region normalization

### Day 12: Testing & Polish
- [ ] E2E tests: Full reader flow with slices
- [ ] Performance testing on low-RAM devices
- [ ] Memory profiling (ensure slices unload)
- [ ] Documentation updates

---

## 🧪 TESTING STRATEGY

### Unit Tests
- [ ] `ImageSlicingPolicy.spec.ts` - slice calculation
- [ ] `cloudinary-media.adapter.spec.ts` - eager transformations
- [ ] `chapter-image-slices.component.spec.ts` - component rendering

### Integration Tests
- [ ] Upload tall image → verify slices created in DB
- [ ] Fetch chapter → verify slices in response
- [ ] Webhook processing → verify eager notification handled

### E2E Tests (Playwright)
- [ ] Navigate to chapter with tall images
- [ ] Verify lazy loading (only viewport slices loaded)
- [ ] Scroll down → verify new slices load
- [ ] Comment on comic panel → verify region saved
- [ ] Low bandwidth simulation

### Performance Tests
- [ ] Memory usage: Read 50-page chapter on 2GB RAM device
- [ ] Network: Verify only visible slices downloaded
- [ ] Layout shift: Measure CLS score

---

## 🔧 CONFIGURATION

### Environment Variables (add to backend)
```env
# Cloudinary eager transformations
CLOUDINARY_EAGER_ASYNC=true
CLOUDINARY_EAGER_NOTIFICATION_URL=https://your-domain.com/api/v1/webhooks/cloudinary

# Image slicing
IMAGE_SLICING_MIN_HEIGHT=2000
IMAGE_SLICING_TARGET_SLICE_HEIGHT=1600

# Signed URLs
CLOUDINARY_AUTH_TOKEN_ENABLED=true
CLOUDINARY_AUTH_TOKEN_DURATION=3600
```

### Feature Flags (optional)
```typescript
// config/reader-features.config.ts
export const readerFeaturesConfig = {
  comicSlicing: {
    enabled: true,
    minHeightForSlicing: 2000,
    targetSliceHeight: 1600,
  },
  inlineComments: {
    enabled: true,
    allowRegionComments: true,
  },
};
```

---

## 🚨 RISKS & MITIGATION

### Risk 1: Cloudinary eager transformations too slow
**Mitigation:** Use `eager_async: true`, fall back to on-demand if needed

### Risk 2: Large backfill of existing images
**Mitigation:** 
- Make slicing opt-in initially
- Run backfill script during off-peak hours
- Process in batches with rate limiting

### Risk 3: Frontend memory still high with many slices
**Mitigation:**
- Implement virtual scrolling/windowing
- Aggressively unload off-screen images
- Monitor with performance.memory API

### Risk 4: Signed URLs add latency
**Mitigation:**
- Cache signed URLs with short TTL (5 min)
- Pre-generate signatures server-side
- Fall back to regular URLs for free content

---

## 📊 SUCCESS METRICS

**Performance:**
- ✅ Memory usage < 500MB on 2GB RAM devices
- ✅ Only 3-5 slices loaded simultaneously
- ✅ Layout shift (CLS) < 0.1
- ✅ Time to first slice < 1s

**Functionality:**
- ✅ 95%+ of tall images successfully sliced
- ✅ Eager transformations complete within 30s
- ✅ Signed URLs work for paid chapters
- ✅ Inline comments render correctly

**User Experience:**
- ✅ Smooth scrolling (60fps)
- ✅ No visible loading gaps
- ✅ Comments overlay doesn't obstruct reading

---

## 📚 DOCUMENTATION TO UPDATE

- [ ] Backend API docs: Add slices to chapter response schema
- [ ] Frontend component library: Document ChapterImageSlicesComponent
- [ ] Cloudinary integration guide: Eager transformations setup
- [ ] Performance guide: Memory optimization techniques
- [ ] Author guide: How tall images are automatically sliced

---

## 🎓 KEY LEARNINGS FOR FUTURE SPRINTS

1. **Eager transformations** save bandwidth and improve perceived performance
2. **Normalized coordinates** (0-1) are resolution-independent
3. **IntersectionObserver** is essential for lazy loading performance
4. **Aspect ratio placeholders** prevent layout shift
5. **Signed URLs** add security but require caching strategy

---

## ✅ DEFINITION OF DONE

- [ ] All tests passing (unit, integration, E2E)
- [ ] Memory profiling confirms < 500MB on low-end devices
- [ ] Code review approved
- [ ] Documentation updated
- [ ] Migrations tested on staging
- [ ] Performance metrics meet targets
- [ ] Feature flag enabled in staging for 7 days
- [ ] No regression in existing chapter reader functionality

---

**Notes for Implementation Agent:**
- Follow the existing architecture patterns (CQRS, Ports & Adapters)
- Keep domain logic pure (no framework dependencies)
- Use existing infrastructure (BullMQ, Prisma, Cloudinary SDK)
- Match naming conventions from `CẤU_TRÚC_VÀ_DESIGN_PATTERNS.md`
- Write tests alongside implementation (not after)
- Commit frequently with descriptive messages
- Check existing similar features before implementing (e.g., media upload flow)
