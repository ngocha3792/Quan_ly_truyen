# SPRINT 2 — Inline Comments cho Truyện Chữ
**Timeline:** 8–12 ngày  
**Mục tiêu:** Text-range anchored comments với re-anchoring và entitlement protection

---

## 🎯 ACCEPTANCE CRITERIA

✅ Bôi đen đoạn text → toolbar bình luận/reaction xuất hiện  
✅ Bubble số comment hiển thị bên cạnh paragraph có comments  
✅ Panel thread theo anchor position  
✅ Backend xác minh range tồn tại trong chapter version (không tin client)  
✅ Khi tác giả sửa chương, background job re-anchor bằng block ID, quote hash và context  
✅ Comment trên chương trả phí phải kiểm tra entitlement trước khi trả excerpt  
✅ Tái sử dụng toàn bộ reactions/reports/moderation hiện có  

---

## 📊 PHÂN TÍCH HIỆN TẠI

### Comment System hiện có:

**Model `Comment` (Prisma):**
- `id`, `storyId`, `chapterId`, `userId`, `parentId` (threading)
- `body`, `moderationStatus`, `likeCount`, `replyCount`
- `editedAt`, `createdAt`, `updatedAt`, `deletedAt`

**Relations:**
- `CommentReaction`: reactions (LIKE, LOVE, etc.)
- `Report`: abuse reports
- `ModerationAction`: moderation history

**Existing endpoints:**
- `POST /api/v1/stories/:storySlug/comments` - Create story comment
- `POST /api/v1/stories/:storySlug/chapters/:chapterNumber/comments` - Create chapter comment
- `GET /api/v1/stories/:storySlug/comments` - List story comments
- `GET /api/v1/stories/:storySlug/chapters/:chapterNumber/comments` - List chapter comments
- `POST /api/v1/comments/:commentId/replies` - Create reply
- `PUT /api/v1/comments/:commentId` - Update comment
- `DELETE /api/v1/comments/:commentId` - Delete comment
- `PUT /api/v1/comments/:commentId/reaction` - Set reaction
- `DELETE /api/v1/comments/:commentId/reaction` - Clear reaction

**Abuse protection:**
- Redis rate limiting
- Write guard (profanity, spam detection)
- Metrics tracking

### Chapter Content Structure:

**`ChapterContentDocument` (Block-based):**
```typescript
interface ChapterContentDocument {
  schemaVersion: 1;
  blocks: ChapterContentBlock[];
}

interface ChapterContentBlock {
  id: string;              // UUID - stable across edits
  type: 'paragraph' | 'heading' | 'blockquote' | 'list' | 'code' | 'horizontal_rule';
  text: string;            // Lossless Markdown
  marks: ChapterContentMark[];
}

interface ChapterContentMark {
  type: 'bold' | 'italic' | 'code' | 'link';
  from: number;  // Character offset in block.text
  to: number;
  href?: string;
}
```

**Block ID reconciliation:**
- Exact match → keep ID
- Edited block → similarity matching (0.25 threshold)
- Inserted block → new ID

**Chapter versioning:**
- `Chapter.version` - optimistic locking counter
- `ChapterVersion` table stores history (deferred in V1 scope)
- `contentDocument` stored as JSONB

---

## 🏗️ TECHNICAL DESIGN

### 1. Database Schema Changes

**New table: `CommentAnchor`**

```prisma
enum CommentAnchorType {
  TEXT_RANGE @map("text_range")
  BLOCK      @map("block")       // Future: whole block comments
  
  @@map("comment_anchor_type")
}

enum CommentAnchorStatus {
  ACTIVE     @map("active")      // Anchor valid in current version
  REANCHORED @map("reanchored")  // Successfully re-anchored after edit
  ORPHANED   @map("orphaned")    // Could not re-anchor
  
  @@map("comment_anchor_status")
}

model CommentAnchor {
  id        String              @id @default(uuid()) @db.Uuid
  commentId String              @unique @map("comment_id") @db.Uuid
  chapterId String              @map("chapter_id") @db.Uuid
  
  // Version tracking
  chapterVersion       Int     @map("chapter_version")
  lastVerifiedVersion  Int     @map("last_verified_version")
  
  // Anchor specification
  anchorType           CommentAnchorType   @map("anchor_type")
  status               CommentAnchorStatus @default(ACTIVE)
  
  // Text range anchor (for TEXT_RANGE type)
  startBlockId         String?  @map("start_block_id") @db.Uuid
  startOffset          Int?     @map("start_offset")    // Character offset in startBlock
  endBlockId           String?  @map("end_block_id") @db.Uuid
  endOffset            Int?     @map("end_offset")      // Character offset in endBlock
  
  // Quote for verification & re-anchoring
  quoteText            String   @map("quote_text") @db.Text       // Selected text
  quoteHash            String   @map("quote_hash") @db.VarChar(64) // SHA-256 of normalized quote
  excerptBefore        String?  @map("excerpt_before") @db.VarChar(200) // Context before
  excerptAfter         String?  @map("excerpt_after") @db.VarChar(200)  // Context after
  
  // Re-anchoring metadata
  reanchoredAt         DateTime? @map("reanchored_at") @db.Timestamptz(3)
  reanchoredFromVersion Int?    @map("reanchored_from_version")
  orphanedAt           DateTime? @map("orphaned_at") @db.Timestamptz(3)
  orphanedReason       String?   @map("orphaned_reason") @db.VarChar(500)
  
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt  DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)
  
  comment Comment @relation(fields: [commentId], references: [id], onDelete: Cascade)
  chapter Chapter @relation(fields: [chapterId], references: [id], onDelete: Cascade)
  
  @@index([chapterId, status])
  @@index([chapterId, startBlockId])
  @@index([status, lastVerifiedVersion])
  @@index([quoteHash])
  @@map("comment_anchors")
}

// Add relation to Comment model
model Comment {
  // ... existing fields ...
  anchor CommentAnchor?
}

// Add relation to Chapter model
model Chapter {
  // ... existing fields ...
  commentAnchors CommentAnchor[]
}
```

**Migration checklist:**
- [ ] Create enums `CommentAnchorType`, `CommentAnchorStatus`
- [ ] Create table `comment_anchors`
- [ ] Add indexes for query performance
- [ ] Add foreign key constraints
- [ ] Update Comment/Chapter models

---

### 2. Backend Implementation

#### Phase 2.1: Domain Logic - Anchor Verification & Re-anchoring (3 ngày)

**Task 2.1.1: Create Anchor Domain Value Objects**

**File:** `backend/src/modules/comments/domain/value-objects/text-range-anchor.value-object.ts`

```typescript
import { createHash } from 'node:crypto';

export interface TextRangeAnchor {
  readonly startBlockId: string;
  readonly startOffset: number;
  readonly endBlockId: string;
  readonly endOffset: number;
  readonly quoteText: string;
  readonly quoteHash: string;
  readonly excerptBefore?: string;
  readonly excerptAfter?: string;
}

export interface BlockContent {
  readonly id: string;
  readonly text: string;
}

export interface AnchorVerificationInput {
  readonly anchor: TextRangeAnchor;
  readonly blocks: readonly BlockContent[];
}

export interface AnchorVerificationResult {
  readonly valid: boolean;
  readonly reason?: 'block_not_found' | 'offset_out_of_bounds' | 'quote_mismatch';
  readonly extractedQuote?: string;
}

/**
 * Verifies that a text range anchor is valid in the given block structure.
 * CRITICAL: Always verify anchor server-side - never trust client excerpt.
 */
export function verifyTextRangeAnchor(
  input: AnchorVerificationInput,
): AnchorVerificationResult {
  const { anchor, blocks } = input;
  
  // Find start and end blocks
  const startBlock = blocks.find(b => b.id === anchor.startBlockId);
  const endBlock = blocks.find(b => b.id === anchor.endBlockId);
  
  if (!startBlock) {
    return { valid: false, reason: 'block_not_found' };
  }
  if (!endBlock) {
    return { valid: false, reason: 'block_not_found' };
  }
  
  // Verify offsets are in bounds
  if (anchor.startOffset < 0 || anchor.startOffset > startBlock.text.length) {
    return { valid: false, reason: 'offset_out_of_bounds' };
  }
  if (anchor.endOffset < 0 || anchor.endOffset > endBlock.text.length) {
    return { valid: false, reason: 'offset_out_of_bounds' };
  }
  
  // Extract actual quote from blocks
  const extractedQuote = extractQuoteFromRange(
    blocks,
    anchor.startBlockId,
    anchor.startOffset,
    anchor.endBlockId,
    anchor.endOffset,
  );
  
  if (!extractedQuote) {
    return { valid: false, reason: 'block_not_found' };
  }
  
  // Verify quote hash matches
  const extractedHash = hashQuote(extractedQuote);
  if (extractedHash !== anchor.quoteHash) {
    return { 
      valid: false, 
      reason: 'quote_mismatch',
      extractedQuote,
    };
  }
  
  return { valid: true, extractedQuote };
}

/**
 * Creates a text range anchor from user selection.
 * Extracts context for re-anchoring.
 */
export function createTextRangeAnchor(
  blocks: readonly BlockContent[],
  startBlockId: string,
  startOffset: number,
  endBlockId: string,
  endOffset: number,
): TextRangeAnchor | null {
  const quoteText = extractQuoteFromRange(
    blocks,
    startBlockId,
    startOffset,
    endBlockId,
    endOffset,
  );
  
  if (!quoteText) return null;
  
  // Validate selection length
  if (quoteText.length < 10) return null;  // Too short
  if (quoteText.length > 2000) return null; // Too long
  
  const quoteHash = hashQuote(quoteText);
  
  // Extract context for re-anchoring
  const startBlock = blocks.find(b => b.id === startBlockId);
  const endBlock = blocks.find(b => b.id === endBlockId);
  
  const excerptBefore = startBlock 
    ? startBlock.text.slice(Math.max(0, startOffset - 100), startOffset)
    : undefined;
  
  const excerptAfter = endBlock
    ? endBlock.text.slice(endOffset, Math.min(endBlock.text.length, endOffset + 100))
    : undefined;
  
  return {
    startBlockId,
    startOffset,
    endBlockId,
    endOffset,
    quoteText,
    quoteHash,
    excerptBefore,
    excerptAfter,
  };
}

/**
 * Attempts to re-anchor a comment after chapter edit.
 * Uses block ID stability, quote hash and surrounding context.
 */
export interface ReanchorInput {
  readonly originalAnchor: TextRangeAnchor;
  readonly oldBlocks: readonly BlockContent[];
  readonly newBlocks: readonly BlockContent[];
}

export interface ReanchorResult {
  readonly success: boolean;
  readonly newAnchor?: TextRangeAnchor;
  readonly strategy?: 'exact_match' | 'block_id_search' | 'context_search';
  readonly confidence?: number; // 0-1
}

export function reanchorTextRange(input: ReanchorInput): ReanchorResult {
  const { originalAnchor, newBlocks } = input;
  
  // Strategy 1: Try exact block IDs + offsets (block unchanged)
  const exactResult = tryExactBlockMatch(originalAnchor, newBlocks);
  if (exactResult.success) {
    return { ...exactResult, strategy: 'exact_match', confidence: 1.0 };
  }
  
  // Strategy 2: Search for quote hash in same/nearby blocks
  const blockIdResult = tryBlockIdSearch(originalAnchor, newBlocks);
  if (blockIdResult.success && blockIdResult.confidence! >= 0.8) {
    return { ...blockIdResult, strategy: 'block_id_search' };
  }
  
  // Strategy 3: Use context (excerptBefore/After) to find quote
  const contextResult = tryContextSearch(originalAnchor, newBlocks);
  if (contextResult.success && contextResult.confidence! >= 0.7) {
    return { ...contextResult, strategy: 'context_search' };
  }
  
  // Failed to re-anchor
  return { success: false };
}

function extractQuoteFromRange(
  blocks: readonly BlockContent[],
  startBlockId: string,
  startOffset: number,
  endBlockId: string,
  endOffset: number,
): string | null {
  const startIndex = blocks.findIndex(b => b.id === startBlockId);
  const endIndex = blocks.findIndex(b => b.id === endBlockId);
  
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    return null;
  }
  
  if (startIndex === endIndex) {
    // Single block selection
    const block = blocks[startIndex];
    return block!.text.slice(startOffset, endOffset);
  }
  
  // Multi-block selection
  const parts: string[] = [];
  
  for (let i = startIndex; i <= endIndex; i++) {
    const block = blocks[i]!;
    
    if (i === startIndex) {
      parts.push(block.text.slice(startOffset));
    } else if (i === endIndex) {
      parts.push(block.text.slice(0, endOffset));
    } else {
      parts.push(block.text);
    }
  }
  
  return parts.join('\n\n'); // Blocks separated by double newline
}

function hashQuote(text: string): string {
  // Normalize: lowercase, collapse whitespace, trim
  const normalized = text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  
  return createHash('sha256')
    .update(normalized, 'utf8')
    .digest('hex');
}

function tryExactBlockMatch(
  anchor: TextRangeAnchor,
  blocks: readonly BlockContent[],
): ReanchorResult {
  const verification = verifyTextRangeAnchor({ anchor, blocks });
  
  if (verification.valid) {
    return { success: true, newAnchor: anchor };
  }
  
  return { success: false };
}

function tryBlockIdSearch(
  anchor: TextRangeAnchor,
  blocks: readonly BlockContent[],
): ReanchorResult {
  // Search in original start block for quote hash
  const startBlock = blocks.find(b => b.id === anchor.startBlockId);
  if (!startBlock) return { success: false };
  
  // Find quote text in block by hash
  const result = findQuoteInBlock(startBlock, anchor.quoteHash, anchor.quoteText.length);
  
  if (result) {
    const newAnchor: TextRangeAnchor = {
      ...anchor,
      startOffset: result.startOffset,
      endOffset: result.endOffset,
      endBlockId: anchor.startBlockId, // Assume same block for now
    };
    
    // Verify new anchor
    const verification = verifyTextRangeAnchor({ anchor: newAnchor, blocks });
    if (verification.valid) {
      return { success: true, newAnchor, confidence: result.confidence };
    }
  }
  
  return { success: false };
}

function tryContextSearch(
  anchor: TextRangeAnchor,
  blocks: readonly BlockContent[],
): ReanchorResult {
  // Use excerptBefore/After to find quote position
  if (!anchor.excerptBefore && !anchor.excerptAfter) {
    return { success: false };
  }
  
  // Search all blocks for quote with context
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!;
    const fullText = block.text;
    
    // Look for excerpt patterns
    if (anchor.excerptBefore) {
      const beforeIndex = fullText.indexOf(anchor.excerptBefore);
      if (beforeIndex !== -1) {
        const quoteStart = beforeIndex + anchor.excerptBefore.length;
        const quoteEnd = quoteStart + anchor.quoteText.length;
        
        if (quoteEnd <= fullText.length) {
          const extractedQuote = fullText.slice(quoteStart, quoteEnd);
          const extractedHash = hashQuote(extractedQuote);
          
          if (extractedHash === anchor.quoteHash) {
            const newAnchor: TextRangeAnchor = {
              ...anchor,
              startBlockId: block.id,
              startOffset: quoteStart,
              endBlockId: block.id,
              endOffset: quoteEnd,
            };
            
            return { success: true, newAnchor, confidence: 0.75 };
          }
        }
      }
    }
  }
  
  return { success: false };
}

function findQuoteInBlock(
  block: BlockContent,
  targetHash: string,
  expectedLength: number,
): { startOffset: number; endOffset: number; confidence: number } | null {
  const text = block.text;
  
  // Sliding window search with similar length
  const minLength = Math.floor(expectedLength * 0.9);
  const maxLength = Math.ceil(expectedLength * 1.1);
  
  for (let start = 0; start < text.length; start++) {
    for (let length = minLength; length <= maxLength; length++) {
      if (start + length > text.length) break;
      
      const candidate = text.slice(start, start + length);
      const candidateHash = hashQuote(candidate);
      
      if (candidateHash === targetHash) {
        return {
          startOffset: start,
          endOffset: start + length,
          confidence: 0.9,
        };
      }
    }
  }
  
  return null;
}
```

**Task 2.1.2: Create Anchor Policy**

**File:** `backend/src/modules/comments/domain/policies/comment-anchor.policy.ts`

```typescript
import type { TextRangeAnchor } from '../value-objects/text-range-anchor.value-object';

export class CommentAnchorPolicy {
  static readonly MIN_QUOTE_LENGTH = 10;
  static readonly MAX_QUOTE_LENGTH = 2000;
  static readonly MAX_EXCERPT_LENGTH = 200;
  static readonly MIN_REANCHOR_CONFIDENCE = 0.7;
  
  static validateQuoteLength(quoteText: string): boolean {
    const length = quoteText.trim().length;
    return length >= this.MIN_QUOTE_LENGTH && length <= this.MAX_QUOTE_LENGTH;
  }
  
  static shouldAttemptReanchor(anchor: TextRangeAnchor, newVersion: number): boolean {
    // Only re-anchor if quote is meaningful
    if (!this.validateQuoteLength(anchor.quoteText)) {
      return false;
    }
    
    // Must have context for re-anchoring
    if (!anchor.excerptBefore && !anchor.excerptAfter) {
      return false;
    }
    
    return true;
  }
  
  static isConfidentReanchor(confidence: number): boolean {
    return confidence >= this.MIN_REANCHOR_CONFIDENCE;
  }
}
```

**Files to create:**
- `backend/src/modules/comments/domain/value-objects/text-range-anchor.value-object.ts`
- `backend/src/modules/comments/domain/value-objects/text-range-anchor.value-object.spec.ts`
- `backend/src/modules/comments/domain/policies/comment-anchor.policy.ts`

**Tests:**
- Unit: `text-range-anchor.value-object.spec.ts`
  - `verifyTextRangeAnchor()` with valid/invalid ranges
  - `createTextRangeAnchor()` with various selections
  - `reanchorTextRange()` exact match, block search, context search
  - Edge cases: multi-block, special characters, Unicode

---

#### Phase 2.2: Application Commands & Queries (2 ngày)

**Task 2.2.1: Create Anchored Comment Command**

**File:** `backend/src/modules/comments/application/commands/create-anchored-comment/create-anchored-comment.command.ts`

```typescript
export interface TextRangeAnchorInput {
  readonly startBlockId: string;
  readonly startOffset: number;
  readonly endBlockId: string;
  readonly endOffset: number;
  readonly quoteText: string; // Client-provided, will be verified
}

export class CreateAnchoredCommentCommand {
  constructor(
    public readonly userId: string | null,
    public readonly storyId: string,
    public readonly chapterId: string,
    public readonly body: string,
    public readonly anchor: TextRangeAnchorInput,
    public readonly ipAddress: string,
  ) {}
}
```

**File:** `backend/src/modules/comments/application/commands/create-anchored-comment/create-anchored-comment.command-handler.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ChapterContentDocument } from '@/modules/chapters/domain';
import {
  createTextRangeAnchor,
  verifyTextRangeAnchor,
} from '../../../domain/value-objects/text-range-anchor.value-object';
import { CommentAnchorPolicy } from '../../../domain/policies/comment-anchor.policy';
import {
  InvalidAnchorException,
  CommentChapterNotFoundException,
} from '../../../domain/exceptions/comment.exceptions';
import type { StoryCommentResultDto } from '../../dto';
import {
  COMMENT_PERSISTENCE_PORT,
  COMMENT_WRITE_GUARD_PORT,
  COMMENT_METRICS_PORT,
  type CommentPersistencePort,
  type CommentWriteGuardPort,
  type CommentMetricsPort,
} from '../../ports';
import { 
  CHAPTER_READER_PORT,
  type ChapterReaderPort 
} from '../../ports/chapter-reader.port';
import { requireReaderUserId } from '../../../domain/policies/comment-auth.policy';

@Injectable()
export class CreateAnchoredCommentCommandHandler {
  constructor(
    @Inject(COMMENT_PERSISTENCE_PORT)
    private readonly persistence: CommentPersistencePort,
    @Inject(COMMENT_WRITE_GUARD_PORT)
    private readonly abuse: CommentWriteGuardPort,
    @Inject(COMMENT_METRICS_PORT)
    private readonly metrics: CommentMetricsPort,
    @Inject(CHAPTER_READER_PORT)
    private readonly chapterReader: ChapterReaderPort,
    private readonly config: ConfigService,
  ) {}

  async execute(
    command: CreateAnchoredCommentCommand,
  ): Promise<StoryCommentResultDto> {
    const userId = requireReaderUserId(command.userId);
    
    // 1. Fetch chapter content to verify anchor
    const chapter = await this.chapterReader.findChapterById(command.chapterId);
    if (!chapter) {
      throw new CommentChapterNotFoundException(command.chapterId);
    }
    
    if (!chapter.contentDocument) {
      throw new InvalidAnchorException(
        'Chapter does not have structured content document'
      );
    }
    
    // 2. Verify entitlement for paid chapters (SECURITY CRITICAL)
    if (chapter.accessType === 'PAID') {
      const hasAccess = await this.chapterReader.checkUserAccess(
        userId,
        chapter.id,
      );
      if (!hasAccess) {
        throw new InvalidAnchorException(
          'Cannot comment on locked chapter'
        );
      }
    }
    
    // 3. Create and verify anchor (NEVER TRUST CLIENT)
    const verifiedAnchor = createTextRangeAnchor(
      chapter.contentDocument.blocks,
      command.anchor.startBlockId,
      command.anchor.startOffset,
      command.anchor.endBlockId,
      command.anchor.endOffset,
    );
    
    if (!verifiedAnchor) {
      throw new InvalidAnchorException('Invalid text range selection');
    }
    
    // 4. Validate quote length policy
    if (!CommentAnchorPolicy.validateQuoteLength(verifiedAnchor.quoteText)) {
      throw new InvalidAnchorException(
        `Quote must be between ${CommentAnchorPolicy.MIN_QUOTE_LENGTH} and ${CommentAnchorPolicy.MAX_QUOTE_LENGTH} characters`
      );
    }
    
    // 5. Verify anchor in chapter (double-check)
    const verification = verifyTextRangeAnchor({
      anchor: verifiedAnchor,
      blocks: chapter.contentDocument.blocks,
    });
    
    if (!verification.valid) {
      throw new InvalidAnchorException(
        `Anchor verification failed: ${verification.reason}`
      );
    }
    
    // 6. Abuse guard
    const cleanBody = await this.abuse.prepare({
      userId,
      storyId: command.storyId,
      chapterId: command.chapterId,
      body: command.body,
      ipAddress: command.ipAddress,
    });
    
    // 7. Create comment with anchor
    const result = await this.persistence.createAnchoredComment({
      userId,
      storyId: command.storyId,
      chapterId: command.chapterId,
      body: cleanBody,
      anchor: {
        chapterVersion: chapter.version,
        anchorType: 'TEXT_RANGE',
        startBlockId: verifiedAnchor.startBlockId,
        startOffset: verifiedAnchor.startOffset,
        endBlockId: verifiedAnchor.endBlockId,
        endOffset: verifiedAnchor.endOffset,
        quoteText: verifiedAnchor.quoteText,
        quoteHash: verifiedAnchor.quoteHash,
        excerptBefore: verifiedAnchor.excerptBefore,
        excerptAfter: verifiedAnchor.excerptAfter,
      },
      createdAt: new Date(),
    });
    
    this.metrics.recordOperation('create_anchored');
    return result.comment;
  }
}
```

**Task 2.2.2: List Comments with Anchors Query**

**File:** `backend/src/modules/comments/application/queries/list-chapter-comments-with-anchors/list-chapter-comments-with-anchors.query.ts`

```typescript
export class ListChapterCommentsWithAnchorsQuery {
  constructor(
    public readonly storySlug: string,
    public readonly chapterNumber: string,
    public readonly viewerUserId: string | null,
    public readonly page: number,
    public readonly pageSize: number,
  ) {}
}
```

**File:** `backend/src/modules/comments/application/queries/list-chapter-comments-with-anchors/list-chapter-comments-with-anchors.query-handler.ts`

```typescript
@Injectable()
export class ListChapterCommentsWithAnchorsQueryHandler {
  constructor(
    @Inject(COMMENT_PERSISTENCE_PORT)
    private readonly persistence: CommentPersistencePort,
    @Inject(CHAPTER_READER_PORT)
    private readonly chapterReader: ChapterReaderPort,
  ) {}
  
  async execute(query: ListChapterCommentsWithAnchorsQuery): Promise<CommentPageView> {
    // 1. Fetch comments (reuse existing persistence)
    const result = await this.persistence.listComments({
      storySlug: query.storySlug,
      chapterNumber: query.chapterNumber,
      page: query.page,
      pageSize: query.pageSize,
    });
    
    if (result.status !== 'ok') {
      throw new Error(`Failed to list comments: ${result.status}`);
    }
    
    // 2. Check if viewer has access to paid chapter
    const chapter = await this.chapterReader.findByStoryAndNumber(
      query.storySlug,
      query.chapterNumber,
    );
    
    const hasAccess = chapter && query.viewerUserId
      ? await this.chapterReader.checkUserAccess(query.viewerUserId, chapter.id)
      : chapter?.accessType !== 'PAID';
    
    // 3. Map comments, filtering excerpts for locked chapters
    const items = result.page.items.map(comment => ({
      ...comment,
      anchor: comment.anchor ? {
        ...comment.anchor,
        // SECURITY: Hide excerpt for locked paid chapters
        quoteText: hasAccess ? comment.anchor.quoteText : '[Nội dung bị khóa]',
        excerptBefore: hasAccess ? comment.anchor.excerptBefore : undefined,
        excerptAfter: hasAccess ? comment.anchor.excerptAfter : undefined,
      } : undefined,
    }));
    
    return {
      ...result.page,
      items,
    };
  }
}
```

**Files to create:**
- `backend/src/modules/comments/application/commands/create-anchored-comment/*`
- `backend/src/modules/comments/application/queries/list-chapter-comments-with-anchors/*`
- `backend/src/modules/comments/application/ports/chapter-reader.port.ts` (interface for chapter access)
- `backend/src/modules/comments/domain/exceptions/comment.exceptions.ts` (add `InvalidAnchorException`)

**Tests:**
- Unit: Command handler with mocked dependencies
- Integration: Create anchored comment, verify in DB
- Security: Verify entitlement check for paid chapters

---

#### Phase 2.3: Infrastructure - Persistence (2 ngày)

**Task 2.3.1: Update Prisma Persistence Layer**

**File:** `backend/src/modules/comments/infrastructure/persistence/prisma-comment.persistence.ts`

```typescript
// Add to existing PrismaCommentPersistence class

async createAnchoredComment(
  input: CreateAnchoredCommentInput,
): Promise<CreateStoryCommentResult> {
  try {
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Verify story exists
      const story = await tx.story.findFirst({
        where: { id: input.storyId, ...PUBLIC_STORY_WHERE },
        select: { id: true },
      });
      if (!story) return { status: 'story_not_found' as const };
      
      // 2. Verify chapter exists
      const chapter = await tx.chapter.findFirst({
        where: {
          id: input.chapterId,
          storyId: input.storyId,
          status: ChapterStatus.PUBLISHED,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!chapter) return { status: 'chapter_not_found' as const };
      
      // 3. Create comment
      const comment = await tx.comment.create({
        data: {
          storyId: input.storyId,
          chapterId: input.chapterId,
          userId: input.userId,
          body: input.body,
          moderationStatus: ModerationStatus.VISIBLE,
          createdAt: input.createdAt,
        },
        select: COMMENT_SELECT,
      });
      
      // 4. Create anchor
      await tx.commentAnchor.create({
        data: {
          commentId: comment.id,
          chapterId: input.chapterId,
          chapterVersion: input.anchor.chapterVersion,
          lastVerifiedVersion: input.anchor.chapterVersion,
          anchorType: input.anchor.anchorType,
          status: 'ACTIVE',
          startBlockId: input.anchor.startBlockId,
          startOffset: input.anchor.startOffset,
          endBlockId: input.anchor.endBlockId,
          endOffset: input.anchor.endOffset,
          quoteText: input.anchor.quoteText,
          quoteHash: input.anchor.quoteHash,
          excerptBefore: input.anchor.excerptBefore,
          excerptAfter: input.anchor.excerptAfter,
        },
      });
      
      // 5. Increment comment count
      await tx.story.update({
        where: { id: input.storyId },
        data: { commentCount: { increment: 1 } },
      });
      
      return { 
        status: 'created' as const, 
        comment: mapCommentRow(comment),
      };
    });
    
    return result;
  } catch (error) {
    throw mapPrismaError(error);
  }
}

// Modify existing listComments to include anchors
async listComments(input: ListCommentsInput): Promise<ListCommentsResult> {
  // ... existing logic ...
  
  // Add anchor to COMMENT_SELECT
  const COMMENT_WITH_ANCHOR_SELECT = {
    ...COMMENT_SELECT,
    anchor: {
      select: {
        id: true,
        chapterVersion: true,
        lastVerifiedVersion: true,
        anchorType: true,
        status: true,
        startBlockId: true,
        startOffset: true,
        endBlockId: true,
        endOffset: true,
        quoteText: true,
        quoteHash: true,
        excerptBefore: true,
        excerptAfter: true,
        reanchoredAt: true,
        orphanedAt: true,
      },
    },
  };
  
  // ... rest of implementation ...
}
```

**Task 2.3.2: Chapter Reader Adapter**

**File:** `backend/src/modules/comments/infrastructure/chapters/chapter-reader.adapter.ts`

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database';
import { ChapterAccessType, ChapterEntitlementStatus } from '@/generated/prisma/client';
import type { ChapterReaderPort } from '../../application/ports/chapter-reader.port';
import type { ChapterContentDocument } from '@/modules/chapters/domain';

@Injectable()
export class ChapterReaderAdapter implements ChapterReaderPort {
  constructor(private readonly prisma: PrismaService) {}
  
  async findChapterById(chapterId: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      select: {
        id: true,
        storyId: true,
        version: true,
        contentDocument: true,
        accessType: true,
      },
    });
    
    if (!chapter) return null;
    
    return {
      id: chapter.id,
      storyId: chapter.storyId,
      version: chapter.version,
      contentDocument: chapter.contentDocument as ChapterContentDocument,
      accessType: chapter.accessType as ChapterAccessType,
    };
  }
  
  async checkUserAccess(userId: string, chapterId: string): Promise<boolean> {
    // Check entitlement for paid chapter
    const entitlement = await this.prisma.chapterEntitlement.findUnique({
      where: {
        userId_chapterId: {
          userId,
          chapterId,
        },
      },
      select: { status: true },
    });
    
    return entitlement?.status === ChapterEntitlementStatus.UNLOCKED;
  }
}
```

**Files to modify:**
- `backend/src/modules/comments/infrastructure/persistence/prisma-comment.persistence.ts`
- `backend/src/modules/comments/comments.module.ts` (register new handlers)

**Files to create:**
- `backend/src/modules/comments/infrastructure/chapters/chapter-reader.adapter.ts`

**Tests:**
- Integration: Create anchored comment, verify anchor in DB
- Integration: List comments with anchors, verify entitlement filtering

---

#### Phase 2.4: Re-anchoring Background Job (2 ngày)

**Task 2.4.1: Re-anchor Worker**

**File:** `backend/src/modules/comments/infrastructure/workers/comment-reanchor.processor.ts`

```typescript
import { Processor, Process } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '@/infrastructure/database';
import { reanchorTextRange } from '../../domain/value-objects/text-range-anchor.value-object';
import { CommentAnchorPolicy } from '../../domain/policies/comment-anchor.policy';
import type { ChapterContentDocument } from '@/modules/chapters/domain';

export interface ReanchorChapterJobData {
  readonly chapterId: string;
  readonly oldVersion: number;
  readonly newVersion: number;
}

@Processor('comments')
@Injectable()
export class CommentReanchorProcessor {
  private readonly logger = new Logger(CommentReanchorProcessor.name);
  
  constructor(private readonly prisma: PrismaService) {}
  
  @Process('reanchor-chapter')
  async handleReanchor(job: Job<ReanchorChapterJobData>) {
    const { chapterId, oldVersion, newVersion } = job.data;
    
    this.logger.log({
      message: 'Starting re-anchor job',
      chapterId,
      oldVersion,
      newVersion,
    });
    
    try {
      // 1. Fetch chapter with old and new content
      const chapter = await this.prisma.chapter.findUnique({
        where: { id: chapterId },
        select: {
          id: true,
          version: true,
          contentDocument: true,
        },
      });
      
      if (!chapter || chapter.version !== newVersion) {
        this.logger.warn('Chapter version mismatch, skipping re-anchor');
        return;
      }
      
      const newDocument = chapter.contentDocument as ChapterContentDocument;
      
      // 2. Get old version from history (if available)
      // Note: ChapterVersion table is deferred in V1, use previous snapshot
      // For V1, we'll attempt re-anchor with just new blocks
      
      // 3. Fetch all ACTIVE anchors for this chapter at old version
      const anchors = await this.prisma.commentAnchor.findMany({
        where: {
          chapterId,
          status: 'ACTIVE',
          lastVerifiedVersion: oldVersion,
        },
        select: {
          id: true,
          commentId: true,
          startBlockId: true,
          startOffset: true,
          endBlockId: true,
          endOffset: true,
          quoteText: true,
          quoteHash: true,
          excerptBefore: true,
          excerptAfter: true,
        },
      });
      
      this.logger.log(`Found ${anchors.length} anchors to re-anchor`);
      
      // 4. Attempt re-anchor for each
      const results = {
        success: 0,
        orphaned: 0,
        skipped: 0,
      };
      
      for (const anchor of anchors) {
        try {
          const result = reanchorTextRange({
            originalAnchor: {
              startBlockId: anchor.startBlockId!,
              startOffset: anchor.startOffset!,
              endBlockId: anchor.endBlockId!,
              endOffset: anchor.endOffset!,
              quoteText: anchor.quoteText,
              quoteHash: anchor.quoteHash,
              excerptBefore: anchor.excerptBefore ?? undefined,
              excerptAfter: anchor.excerptAfter ?? undefined,
            },
            oldBlocks: [], // Not available in V1
            newBlocks: newDocument.blocks,
          });
          
          if (result.success && result.newAnchor) {
            const isConfident = CommentAnchorPolicy.isConfidentReanchor(
              result.confidence ?? 0
            );
            
            if (isConfident) {
              // Update anchor with new position
              await this.prisma.commentAnchor.update({
                where: { id: anchor.id },
                data: {
                  status: 'REANCHORED',
                  startBlockId: result.newAnchor.startBlockId,
                  startOffset: result.newAnchor.startOffset,
                  endBlockId: result.newAnchor.endBlockId,
                  endOffset: result.newAnchor.endOffset,
                  lastVerifiedVersion: newVersion,
                  reanchoredAt: new Date(),
                  reanchoredFromVersion: oldVersion,
                },
              });
              results.success++;
            } else {
              results.skipped++;
            }
          } else {
            // Mark as orphaned
            await this.prisma.commentAnchor.update({
              where: { id: anchor.id },
              data: {
                status: 'ORPHANED',
                orphanedAt: new Date(),
                orphanedReason: 'Could not find quote in updated chapter',
              },
            });
            results.orphaned++;
          }
        } catch (error) {
          this.logger.error({
            message: 'Failed to re-anchor individual comment',
            anchorId: anchor.id,
            error: error instanceof Error ? error.message : 'Unknown',
          });
        }
      }
      
      this.logger.log({
        message: 'Re-anchor job completed',
        chapterId,
        results,
      });
    } catch (error) {
      this.logger.error({
        message: 'Re-anchor job failed',
        chapterId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      throw error;
    }
  }
}
```

**Task 2.4.2: Trigger Re-anchor on Chapter Update**

**File:** `backend/src/modules/chapters/infrastructure/persistence/prisma-chapter.persistence.ts`

```typescript
// Modify updateAuthorChapter method

async updateAuthorChapter(
  input: UpdateAuthorChapterInput,
): Promise<UpdateAuthorChapterResult> {
  // ... existing logic ...
  
  const result = await this.prisma.$transaction(async (tx) => {
    // ... existing update logic ...
    
    const updated = await tx.chapter.update({
      where: { id: input.chapterId },
      data: {
        // ... existing fields ...
        version: { increment: 1 }, // Increment version
      },
      select: { 
        ...CHAPTER_SELECT,
        version: true,
      },
    });
    
    // ✅ NEW: Enqueue re-anchor job if content changed
    if (input.content && currentChapter.content !== input.content) {
      await this.queueReanchorJob({
        chapterId: input.chapterId,
        oldVersion: currentChapter.version,
        newVersion: updated.version,
      });
    }
    
    return { status: 'updated', chapter: mapChapterRow(updated) };
  });
  
  return result;
}

private async queueReanchorJob(data: ReanchorChapterJobData) {
  // Add to BullMQ
  await this.commentQueue.add('reanchor-chapter', data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  });
}
```

**Files to create:**
- `backend/src/modules/comments/infrastructure/workers/comment-reanchor.processor.ts`

**Files to modify:**
- `backend/src/modules/chapters/infrastructure/persistence/prisma-chapter.persistence.ts`
- `backend/src/modules/comments/comments.module.ts` (register processor)

**Tests:**
- Integration: Update chapter, verify re-anchor job queued
- E2E: Update chapter with anchored comments, verify re-anchoring

---

#### Phase 2.5: HTTP API (1 ngày)

**Task 2.5.1: Add Anchored Comment Endpoints**

**File:** `backend/src/modules/comments/presentation/http/requests/create-anchored-comment.request.ts`

```typescript
import { IsString, IsInt, Min, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class TextRangeAnchorDto {
  @IsString()
  startBlockId!: string;
  
  @IsInt()
  @Min(0)
  startOffset!: number;
  
  @IsString()
  endBlockId!: string;
  
  @IsInt()
  @Min(0)
  endOffset!: number;
  
  @IsString()
  @MaxLength(2000)
  quoteText!: string;
}

export class CreateAnchoredCommentRequest {
  @IsString()
  @MaxLength(5000)
  body!: string;
  
  @ValidateNested()
  @Type(() => TextRangeAnchorDto)
  anchor!: TextRangeAnchorDto;
}
```

**File:** `backend/src/modules/comments/presentation/http/controllers/comment-write.controller.ts`

```typescript
// Add to existing CommentWriteController

@Post('stories/:storySlug/chapters/:chapterNumber/anchored-comments')
@ApiOperation({ summary: 'Create anchored comment on chapter text' })
@ApiResponse({ status: 201, type: StoryCommentResponse })
async createAnchoredComment(
  @Param('storySlug') storySlug: string,
  @Param('chapterNumber') chapterNumber: string,
  @Body() dto: CreateAnchoredCommentRequest,
  @CurrentUserId() userId: string,
  @ClientIp() ipAddress: string,
): Promise<StoryCommentResponse> {
  // 1. Find story and chapter
  const story = await this.findStoryBySlug(storySlug);
  const chapter = await this.findChapterByNumber(story.id, chapterNumber);
  
  // 2. Execute command
  const command = new CreateAnchoredCommentCommand(
    userId,
    story.id,
    chapter.id,
    dto.body,
    dto.anchor,
    ipAddress,
  );
  
  const result = await this.commandBus.execute(command);
  
  return StoryCommentResponse.from(result);
}
```

**Files to create:**
- `backend/src/modules/comments/presentation/http/requests/create-anchored-comment.request.ts`

**Files to modify:**
- `backend/src/modules/comments/presentation/http/controllers/comment-write.controller.ts`
- `backend/src/modules/comments/presentation/http/responses/comment.response.ts` (add anchor field)

**Tests:**
- E2E: POST anchored comment, verify created
- E2E: Try to create anchored comment on paid chapter without access (should fail)

---

### 3. Frontend Implementation (3-4 ngày)

#### Phase 3.1: Text Selection & Toolbar (2 ngày)

**Task 3.1.1: Create Text Selection Service**

**File:** `frontend/src/app/features/public/chapter-reader/data-access/text-selection.service.ts`

```typescript
import { Injectable, signal } from '@angular/core';

export interface TextSelection {
  readonly text: string;
  readonly startBlockId: string;
  readonly startOffset: number;
  readonly endBlockId: string;
  readonly endOffset: number;
  readonly rect: DOMRect;
}

@Injectable()
export class TextSelectionService {
  private selectionSignal = signal<TextSelection | null>(null);
  
  selection = this.selectionSignal.asReadonly();
  
  captureSelection(containerElement: HTMLElement): TextSelection | null {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      this.clearSelection();
      return null;
    }
    
    const range = selection.getRangeAt(0);
    const text = selection.toString().trim();
    
    if (text.length < 10) {
      this.clearSelection();
      return null;
    }
    
    // Find start and end block elements
    const startBlock = this.findBlockElement(range.startContainer);
    const endBlock = this.findBlockElement(range.endContainer);
    
    if (!startBlock || !endBlock) {
      this.clearSelection();
      return null;
    }
    
    const startBlockId = startBlock.getAttribute('data-block-id');
    const endBlockId = endBlock.getAttribute('data-block-id');
    
    if (!startBlockId || !endBlockId) {
      this.clearSelection();
      return null;
    }
    
    // Calculate character offsets within blocks
    const startOffset = this.getCharacterOffset(
      startBlock,
      range.startContainer,
      range.startOffset,
    );
    const endOffset = this.getCharacterOffset(
      endBlock,
      range.endContainer,
      range.endOffset,
    );
    
    const rect = range.getBoundingClientRect();
    
    const textSelection: TextSelection = {
      text,
      startBlockId,
      startOffset,
      endBlockId,
      endOffset,
      rect,
    };
    
    this.selectionSignal.set(textSelection);
    return textSelection;
  }
  
  clearSelection(): void {
    this.selectionSignal.set(null);
    window.getSelection()?.removeAllRanges();
  }
  
  private findBlockElement(node: Node): HTMLElement | null {
    let current = node;
    
    while (current && current !== document.body) {
      if (
        current instanceof HTMLElement &&
        current.hasAttribute('data-block-id')
      ) {
        return current;
      }
      current = current.parentNode!;
    }
    
    return null;
  }
  
  private getCharacterOffset(
    blockElement: HTMLElement,
    targetNode: Node,
    offset: number,
  ): number {
    let charCount = 0;
    const walker = document.createTreeWalker(
      blockElement,
      NodeFilter.SHOW_TEXT,
      null,
    );
    
    let currentNode: Node | null;
    while ((currentNode = walker.nextNode())) {
      if (currentNode === targetNode) {
        return charCount + offset;
      }
      charCount += currentNode.textContent?.length || 0;
    }
    
    return charCount;
  }
}
```

**Task 3.1.2: Create Comment Toolbar Component**

**File:** `frontend/src/app/features/public/chapter-reader/ui/comment-toolbar/comment-toolbar.component.ts`

```typescript
import { Component, Output, EventEmitter, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface CommentToolbarAction {
  type: 'comment' | 'highlight' | 'share';
}

@Component({
  selector: 'app-comment-toolbar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div 
      class="comment-toolbar"
      [style.left.px]="position().x"
      [style.top.px]="position().y"
      [@fadeSlide]="'visible'">
      
      <button 
        class="toolbar-btn toolbar-btn-comment"
        (click)="onAction('comment')"
        title="Bình luận đoạn này">
        <svg><!-- comment icon --></svg>
        Bình luận
      </button>
      
      <button 
        class="toolbar-btn toolbar-btn-highlight"
        (click)="onAction('highlight')"
        title="Đánh dấu">
        <svg><!-- highlight icon --></svg>
      </button>
      
      <button 
        class="toolbar-btn toolbar-btn-share"
        (click)="onAction('share')"
        title="Chia sẻ">
        <svg><!-- share icon --></svg>
      </button>
    </div>
  `,
  styles: [`
    .comment-toolbar {
      position: fixed;
      z-index: 1000;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      display: flex;
      gap: 4px;
      padding: 8px;
      transform: translateX(-50%) translateY(-100%) translateY(-12px);
    }
    
    .toolbar-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      border: none;
      background: transparent;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      color: #333;
      transition: background 0.2s;
    }
    
    .toolbar-btn:hover {
      background: #f5f5f5;
    }
    
    .toolbar-btn-comment:hover {
      background: #fff3e0;
      color: #f57c00;
    }
    
    .toolbar-btn svg {
      width: 18px;
      height: 18px;
    }
  `],
  animations: [
    // fade slide animation
  ]
})
export class CommentToolbarComponent {
  position = input.required<{ x: number; y: number }>();
  
  @Output() action = new EventEmitter<CommentToolbarAction['type']>();
  
  onAction(type: CommentToolbarAction['type']): void {
    this.action.emit(type);
  }
}
```

**Task 3.1.3: Integrate Selection into Chapter Reader**

**File:** `frontend/src/app/features/public/chapter-reader/pages/chapter-reader-page/chapter-reader-page.component.ts`

```typescript
// Add to existing component

protected selectionService = inject(TextSelectionService);
protected showToolbar = signal(false);
protected toolbarPosition = signal({ x: 0, y: 0 });

ngAfterViewInit() {
  // Listen for text selection
  this.contentElement.nativeElement.addEventListener(
    'mouseup',
    this.onTextSelected.bind(this),
  );
  
  // Clear selection on click outside
  document.addEventListener('click', this.onClickOutside.bind(this));
}

private onTextSelected(event: MouseEvent): void {
  setTimeout(() => {
    const selection = this.selectionService.captureSelection(
      this.contentElement.nativeElement,
    );
    
    if (selection) {
      this.showToolbar.set(true);
      this.toolbarPosition.set({
        x: selection.rect.left + selection.rect.width / 2,
        y: selection.rect.top,
      });
    } else {
      this.showToolbar.set(false);
    }
  }, 10);
}

protected onToolbarAction(action: string): void {
  const selection = this.selectionService.selection();
  
  if (!selection) return;
  
  switch (action) {
    case 'comment':
      this.openCommentDialog(selection);
      break;
    case 'highlight':
      // Future feature
      break;
    case 'share':
      // Future feature
      break;
  }
}

private openCommentDialog(selection: TextSelection): void {
  // Show comment creation dialog
  this.commentDialogData.set({
    anchor: {
      startBlockId: selection.startBlockId,
      startOffset: selection.startOffset,
      endBlockId: selection.endBlockId,
      endOffset: selection.endOffset,
      quoteText: selection.text,
    },
  });
  this.showCommentDialog.set(true);
}
```

**Files to create:**
- `frontend/src/app/features/public/chapter-reader/data-access/text-selection.service.ts`
- `frontend/src/app/features/public/chapter-reader/ui/comment-toolbar/comment-toolbar.component.ts`

**Files to modify:**
- `frontend/src/app/features/public/chapter-reader/pages/chapter-reader-page/chapter-reader-page.component.ts`
- `frontend/src/app/features/public/chapter-reader/pages/chapter-reader-page/chapter-reader-page.component.html`

**Tests:**
- Unit: TextSelectionService offset calculation
- E2E: Select text, verify toolbar appears

---

#### Phase 3.2: Comment Bubbles & Thread Panel (1 ngày)

**Task 3.2.1: Render Blocks with data-block-id**

**File:** `frontend/src/app/features/public/chapter-reader/ui/chapter-content/chapter-content.component.ts`

```typescript
@Component({
  selector: 'app-chapter-content',
  standalone: true,
  template: `
    <div class="chapter-content">
      @for (block of blocks(); track block.id) {
        <div 
          class="content-block"
          [attr.data-block-id]="block.id"
          [class]="'block-' + block.type">
          
          <!-- Render block text (Markdown) -->
          <div [innerHTML]="renderBlock(block) | sanitize"></div>
          
          <!-- Comment bubble indicator -->
          @if (getBlockCommentCount(block.id) > 0) {
            <button 
              class="comment-bubble"
              (click)="onBlockCommentsClick(block.id)">
              {{ getBlockCommentCount(block.id) }}
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .content-block {
      position: relative;
      margin-bottom: 1.5em;
      padding-left: 40px; /* Space for bubble */
    }
    
    .comment-bubble {
      position: absolute;
      left: 0;
      top: 0;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #ff9800;
      color: white;
      border: none;
      cursor: pointer;
      font-size: 12px;
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s;
    }
    
    .comment-bubble:hover {
      transform: scale(1.1);
      background: #f57c00;
    }
  `]
})
export class ChapterContentComponent {
  blocks = input.required<ChapterContentBlock[]>();
  comments = input.required<CommentWithAnchor[]>();
  
  @Output() blockCommentsClick = new EventEmitter<string>();
  
  private commentCountByBlock = computed(() => {
    const counts = new Map<string, number>();
    
    for (const comment of this.comments()) {
      if (comment.anchor?.startBlockId) {
        const blockId = comment.anchor.startBlockId;
        counts.set(blockId, (counts.get(blockId) || 0) + 1);
      }
    }
    
    return counts;
  });
  
  getBlockCommentCount(blockId: string): number {
    return this.commentCountByBlock().get(blockId) || 0;
  }
  
  onBlockCommentsClick(blockId: string): void {
    this.blockCommentsClick.emit(blockId);
  }
  
  renderBlock(block: ChapterContentBlock): string {
    // Use markdown-it or similar to render block.text
    return this.markdownService.render(block.text);
  }
}
```

**Task 3.2.2: Comment Thread Panel**

**File:** `frontend/src/app/features/public/chapter-reader/ui/anchored-comments-panel/anchored-comments-panel.component.ts`

```typescript
@Component({
  selector: 'app-anchored-comments-panel',
  standalone: true,
  template: `
    <div class="anchored-comments-panel" [class.open]="isOpen()">
      <div class="panel-header">
        <h3>Bình luận trên đoạn văn</h3>
        <button (click)="close.emit()" class="close-btn">×</button>
      </div>
      
      <div class="panel-content">
        <!-- Highlighted quote -->
        @if (focusedBlockId()) {
          <div class="quoted-text">
            <div class="quote-mark">"</div>
            <p>{{ getBlockQuote(focusedBlockId()) }}</p>
          </div>
        }
        
        <!-- Comments for this block -->
        <div class="comments-list">
          @for (comment of filteredComments(); track comment.id) {
            <app-comment-thread-item
              [comment]="comment"
              (reply)="onReply($event)"
              (edit)="onEdit($event)"
              (delete)="onDelete($event)"
            />
          }
        </div>
        
        @if (filteredComments().length === 0) {
          <div class="empty-state">
            Chưa có bình luận nào trên đoạn này
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .anchored-comments-panel {
      position: fixed;
      right: 0;
      top: 0;
      bottom: 0;
      width: 400px;
      background: white;
      box-shadow: -2px 0 8px rgba(0,0,0,0.1);
      transform: translateX(100%);
      transition: transform 0.3s;
      z-index: 100;
      display: flex;
      flex-direction: column;
    }
    
    .anchored-comments-panel.open {
      transform: translateX(0);
    }
    
    .panel-header {
      padding: 20px;
      border-bottom: 1px solid #e0e0e0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .quoted-text {
      margin: 20px;
      padding: 16px;
      background: #f5f5f5;
      border-left: 4px solid #ff9800;
      font-style: italic;
      position: relative;
    }
    
    .quote-mark {
      position: absolute;
      top: -10px;
      left: 10px;
      font-size: 48px;
      color: #ff9800;
      opacity: 0.3;
    }
  `]
})
export class AnchoredCommentsPanelComponent {
  isOpen = input.required<boolean>();
  focusedBlockId = input<string | null>(null);
  comments = input.required<CommentWithAnchor[]>();
  blocks = input.required<ChapterContentBlock[]>();
  
  @Output() close = new EventEmitter<void>();
  @Output() reply = new EventEmitter<any>();
  @Output() edit = new EventEmitter<any>();
  @Output() delete = new EventEmitter<string>();
  
  filteredComments = computed(() => {
    const blockId = this.focusedBlockId();
    if (!blockId) return [];
    
    return this.comments().filter(
      c => c.anchor?.startBlockId === blockId
    );
  });
  
  getBlockQuote(blockId: string): string {
    const comments = this.filteredComments();
    if (comments.length === 0) return '';
    
    // Use first comment's quote
    return comments[0]?.anchor?.quoteText || '';
  }
  
  onReply(event: any): void {
    this.reply.emit(event);
  }
  
  onEdit(event: any): void {
    this.edit.emit(event);
  }
  
  onDelete(commentId: string): void {
    this.delete.emit(commentId);
  }
}
```

**Files to create:**
- `frontend/src/app/features/public/chapter-reader/ui/chapter-content/chapter-content.component.ts`
- `frontend/src/app/features/public/chapter-reader/ui/anchored-comments-panel/anchored-comments-panel.component.ts`

**Files to modify:**
- `frontend/src/app/features/public/chapter-reader/domain/chapter-reader.models.ts` (add anchor types)
- `frontend/src/app/features/public/chapter-reader/pages/chapter-reader-page/chapter-reader-page.component.html`

**Tests:**
- Unit: Comment count aggregation
- E2E: Click bubble, verify panel opens with filtered comments

---

#### Phase 3.3: Create Anchored Comment API Integration (1 ngày)

**Task 3.3.1: Update Repository**

**File:** `frontend/src/app/features/public/chapter-reader/data-access/chapter-reader-http.repository.ts`

```typescript
// Add to existing repository

async createAnchoredComment(
  storySlug: string,
  chapterNumber: number,
  body: string,
  anchor: TextRangeAnchorDto,
): Promise<Comment> {
  const response = await firstValueFrom(
    this.http.post<ApiSuccessEnvelope<CommentResponse>>(
      `/api/v1/stories/${storySlug}/chapters/${chapterNumber}/anchored-comments`,
      { body, anchor },
    ),
  );
  
  return mapCommentResponse(response.data);
}
```

**Task 3.3.2: Update Store**

**File:** `frontend/src/app/features/public/chapter-reader/data-access/chapter-reader.store.ts`

```typescript
// Add to existing store

async addAnchoredComment(
  body: string,
  anchor: TextSelection,
): Promise<void> {
  const view = this.view();
  if (!view) return;
  
  this.setLoading(true);
  
  try {
    const comment = await this.repository.createAnchoredComment(
      view.story.slug,
      view.chapter.number,
      body,
      {
        startBlockId: anchor.startBlockId,
        startOffset: anchor.startOffset,
        endBlockId: anchor.endBlockId,
        endOffset: anchor.endOffset,
        quoteText: anchor.text,
      },
    );
    
    // Add to comments list
    this.state.update(s => ({
      ...s,
      view: s.view ? {
        ...s.view,
        comments: {
          ...s.view.comments,
          items: [comment, ...s.view.comments.items],
        },
      } : null,
      loading: false,
    }));
    
    this.notificationService.success('Đã đăng bình luận');
  } catch (error) {
    this.setError('Failed to create anchored comment');
    this.notificationService.error('Không thể đăng bình luận');
  }
}
```

**Files to modify:**
- `frontend/src/app/features/public/chapter-reader/data-access/chapter-reader-http.repository.ts`
- `frontend/src/app/features/public/chapter-reader/data-access/chapter-reader.store.ts`

**Tests:**
- Integration: Create anchored comment, verify API call
- E2E: Full flow - select text, add comment, verify displayed

---

## 📝 IMPLEMENTATION ORDER

### Day 1-3: Domain & Anchor Logic
- [ ] Database migration (CommentAnchor table)
- [ ] Create text-range-anchor value object
- [ ] Implement verifyTextRangeAnchor
- [ ] Implement createTextRangeAnchor
- [ ] Implement reanchorTextRange
- [ ] Unit tests for anchor logic

### Day 4-5: Application Layer
- [ ] Create CreateAnchoredCommentCommand & Handler
- [ ] Create ListChapterCommentsWithAnchorsQuery
- [ ] Add ChapterReaderAdapter for entitlement checks
- [ ] Integration tests

### Day 6-7: Infrastructure & Re-anchoring
- [ ] Update PrismaCommentPersistence
- [ ] Create CommentReanchorProcessor
- [ ] Integrate re-anchor trigger in chapter update
- [ ] Worker tests

### Day 8: HTTP API
- [ ] Add anchored comment endpoints
- [ ] Update response DTOs
- [ ] E2E API tests

### Day 9-10: Frontend Selection & Toolbar
- [ ] TextSelectionService
- [ ] CommentToolbarComponent
- [ ] Integrate into chapter reader
- [ ] Tests

### Day 11: Frontend Bubbles & Panel
- [ ] Render blocks with data-block-id
- [ ] Comment bubble indicators
- [ ] AnchoredCommentsPanel
- [ ] Tests

### Day 12: API Integration & Polish
- [ ] Update repository & store
- [ ] End-to-end testing
- [ ] Bug fixes & polish
- [ ] Documentation

---

## 🧪 TESTING STRATEGY

### Unit Tests
- [ ] `text-range-anchor.value-object.spec.ts` - All anchor functions
- [ ] `comment-anchor.policy.spec.ts` - Policy validations
- [ ] `text-selection.service.spec.ts` - Offset calculation

### Integration Tests
- [ ] Create anchored comment → verify in DB
- [ ] List comments with anchors → verify filtering
- [ ] Update chapter → verify re-anchor job queued
- [ ] Re-anchor processor → verify anchor updates

### E2E Tests (Playwright)
- [ ] Select text → toolbar appears
- [ ] Click comment → dialog opens
- [ ] Submit anchored comment → appears with bubble
- [ ] Click bubble → panel opens with comments
- [ ] Paid chapter: verify excerpt hidden without access
- [ ] Author edits chapter → comments re-anchored

### Security Tests
- [ ] Cannot create anchored comment on paid chapter without access
- [ ] Excerpt hidden for locked chapters
- [ ] Server validates anchor (doesn't trust client)
- [ ] Quote hash mismatch rejected

---

## 🔧 CONFIGURATION

### Environment Variables
```env
# Comment anchoring
COMMENT_ANCHOR_MIN_QUOTE_LENGTH=10
COMMENT_ANCHOR_MAX_QUOTE_LENGTH=2000
COMMENT_ANCHOR_REANCHOR_CONFIDENCE_THRESHOLD=0.7

# Re-anchoring worker
COMMENT_REANCHOR_ENABLED=true
COMMENT_REANCHOR_BATCH_SIZE=50
```

---

## 🚨 RISKS & MITIGATION

### Risk 1: Re-anchoring fails for heavily edited chapters
**Mitigation:** 
- Use multiple strategies (block ID, context, quote hash)
- Mark as ORPHANED if confidence < threshold
- Display orphaned comments separately
- Allow manual re-positioning by users (future)

### Risk 2: Performance with many comments per block
**Mitigation:**
- Paginate anchored comments
- Load comments on-demand when bubble clicked
- Index by startBlockId for fast queries

### Risk 3: Excerpt leaks paid content
**Mitigation:**
- ALWAYS check entitlement server-side
- Filter excerpts in query handler
- Log access attempts for security monitoring
- Truncate excerpts to 200 chars max

### Risk 4: Complex multi-block selections
**Mitigation:**
- Limit selection to 2000 chars
- Handle newlines between blocks correctly
- Test with various Markdown structures (code, lists, quotes)

---

## 📊 SUCCESS METRICS

**Functionality:**
- ✅ 95%+ of anchors successfully re-anchored after edits
- ✅ < 5% orphaned rate
- ✅ 100% entitlement checks before showing excerpts
- ✅ Server-side anchor verification (no trust of client)

**Performance:**
- ✅ Comment creation < 500ms
- ✅ Re-anchor job < 30s per chapter
- ✅ Comment list query < 300ms

**User Experience:**
- ✅ Toolbar appears within 100ms of selection
- ✅ Comment bubbles visible without scrolling
- ✅ Panel opens smoothly (< 300ms animation)

---

## 📚 DOCUMENTATION TO UPDATE

- [ ] API docs: Anchored comment endpoints
- [ ] Database schema: CommentAnchor table
- [ ] Architecture docs: Re-anchoring worker
- [ ] User guide: How to comment on text
- [ ] Author guide: What happens when editing chapters with comments
- [ ] Security docs: Entitlement protection for excerpts

---

## ✅ DEFINITION OF DONE

- [ ] All tests passing (unit, integration, E2E)
- [ ] Anchor verification always server-side
- [ ] Entitlement checks for paid chapters
- [ ] Re-anchoring worker functional
- [ ] Code review approved
- [ ] Migrations tested on staging
- [ ] Security audit passed
- [ ] Documentation updated
- [ ] Feature flag enabled in staging for 7 days
- [ ] No data leaks in paid content excerpts
- [ ] Performance metrics meet targets

---

**Critical Security Notes:**
1. **NEVER trust client-provided quoteText** - always verify server-side
2. **ALWAYS check entitlement** before returning excerpts for paid chapters
3. **Hash quotes consistently** - normalize before hashing
4. **Limit excerpt length** to prevent full content leaks
5. **Log suspicious attempts** to access locked content

**Notes for Implementation Agent:**
- Follow existing comment module patterns
- Reuse CommentReaction, Report, ModerationAction
- Block IDs from ChapterContentDocument are stable across edits
- Test multi-block selections thoroughly
- Consider UX for orphaned comments (show with warning)
