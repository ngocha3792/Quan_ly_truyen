# SPRINT 7 — Author Studio v2
**Timeline:** 10–15 ngày  
**Mục tiêu:** Rich text editor với autosave, optimistic concurrency, local recovery và chapter workflow

---

## 🎯 ACCEPTANCE CRITERIA

✅ TipTap/ProseMirror editor thay textarea  
✅ Autosave debounce 2-3 giây  
✅ Optimistic concurrency bằng chapter version/ETag  
✅ Local IndexedDB recovery nếu tab crash  
✅ Hiển thị trạng thái: Đang lưu / Đã lưu / Có xung đột  
✅ Diff và restore dựa trên ChapterVersion  
✅ Permission contributor checked backend (không chỉ ẩn nút)  
✅ Chapter workflow: DRAFT → IN_REVIEW → APPROVED → SCHEDULED → PUBLISHED  
✅ Story submission pattern tái sử dụng, không dùng chung table  

---

## 📊 PHÂN TÍCH HIỆN TẠI

### Chapter Model hiện tại:
- `Chapter` có `status`: DRAFT, SCHEDULED, PUBLISHED
- `version` field cho optimistic locking
- `contentDocument` lưu ChapterContentDocument
- `updatedById` track người sửa cuối

### Story Submission Pattern:
- `StorySubmission` với workflow approval
- `SubmissionStatus`: DRAFT → PENDING → APPROVED → REJECTED
- Moderator reviews và approve
- Có thể tái sử dụng pattern

### Contributor System:
- `StoryContributor` với roles và permissions
- `canEdit` field
- Backend checks qua AuthorizationModule

### Thiếu:
- ❌ Rich text editor infrastructure
- ❌ Autosave mechanism
- ❌ Version history tracking
- ❌ Local draft recovery
- ❌ Chapter-level approval workflow
- ❌ Detailed permission checks

---

## 🏗️ TECHNICAL DESIGN

### 1. Database Schema Changes

```prisma
enum ChapterStatus {
  DRAFT       @map("draft")
  IN_REVIEW   @map("in_review")     // NEW
  APPROVED    @map("approved")      // NEW
  SCHEDULED   @map("scheduled")
  PUBLISHED   @map("published")
  ARCHIVED    @map("archived")
  
  @@map("chapter_status")
}

enum ChapterVersionType {
  AUTOSAVE    @map("autosave")
  MANUAL_SAVE @map("manual_save")
  PUBLISHED   @map("published")
  
  @@map("chapter_version_type")
}

model ChapterVersion {
  id              String              @id @default(uuid()) @db.Uuid
  chapterId       String              @map("chapter_id") @db.Uuid
  versionNumber   Int                 @map("version_number")
  
  // Content snapshot
  title           String              @db.VarChar(255)
  content         String              @db.Text
  contentDocument Json?               @map("content_document")
  documentSchemaVersion Int?          @map("document_schema_version")
  wordCount       Int                 @default(0) @map("word_count")
  
  // Version metadata
  versionType     ChapterVersionType  @map("version_type")
  comment         String?             @db.Text
  createdById     String              @map("created_by_id") @db.Uuid
  
  // Retention
  isRetained      Boolean             @default(false) @map("is_retained")  // Keep forever
  expiresAt       DateTime?           @map("expires_at") @db.Timestamptz(3)
  
  createdAt       DateTime            @default(now()) @map("created_at") @db.Timestamptz(3)
  
  chapter         Chapter             @relation(fields: [chapterId], references: [id], onDelete: Cascade)
  createdBy       User                @relation(fields: [createdById], references: [id])
  
  @@unique([chapterId, versionNumber])
  @@index([chapterId, createdAt])
  @@index([versionType, expiresAt])
  @@map("chapter_versions")
}

model ChapterReview {
  id          String            @id @default(uuid()) @db.Uuid
  chapterId   String            @map("chapter_id") @db.Uuid
  reviewerId  String            @map("reviewer_id") @db.Uuid
  
  // Review decision
  decision    String            @db.VarChar(20)  // APPROVED, REJECTED, REQUEST_CHANGES
  comment     String?           @db.Text
  
  // Review context
  reviewedVersion Int            @map("reviewed_version")
  
  createdAt   DateTime          @default(now()) @map("created_at") @db.Timestamptz(3)
  
  chapter     Chapter           @relation(fields: [chapterId], references: [id], onDelete: Cascade)
  reviewer    User              @relation(fields: [reviewerId], references: [id])
  
  @@index([chapterId, createdAt])
  @@index([reviewerId, createdAt])
  @@map("chapter_reviews")
}

model ChapterEditSession {
  id              String    @id @default(uuid()) @db.Uuid
  chapterId       String    @map("chapter_id") @db.Uuid
  userId          String    @map("user_id") @db.Uuid
  
  // Session tracking
  sessionToken    String    @unique @map("session_token") @db.VarChar(64)
  activeTabId     String?   @map("active_tab_id") @db.VarChar(64)
  
  // Heartbeat
  lastHeartbeatAt DateTime  @default(now()) @map("last_heartbeat_at") @db.Timestamptz(3)
  expiresAt       DateTime  @map("expires_at") @db.Timestamptz(3)
  
  createdAt       DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)
  
  chapter Chapter @relation(fields: [chapterId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([chapterId, lastHeartbeatAt])
  @@index([expiresAt])
  @@map("chapter_edit_sessions")
}

// Add relations to existing models
model Chapter {
  // ... existing fields ...
  versions      ChapterVersion[]
  reviews       ChapterReview[]
  editSessions  ChapterEditSession[]
}

model User {
  // ... existing fields ...
  chapterVersions  ChapterVersion[]
  chapterReviews   ChapterReview[]
  editSessions     ChapterEditSession[]
}
```

---

### 2. Frontend - TipTap Editor Integration (3 ngày)

**Task 2.1: TipTap Setup**

**File:** `frontend/src/app/features/author-portal/chapter-editor/editor/tiptap-editor.service.ts`

```typescript
import { Injectable, signal, effect } from '@angular/core';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import { Markdown } from 'tiptap-markdown';

export interface EditorState {
  content: string;
  wordCount: number;
  characterCount: number;
  isDirty: boolean;
  lastSaved?: Date;
}

@Injectable()
export class TiptapEditorService {
  private editor: Editor | null = null;
  
  state = signal<EditorState>({
    content: '',
    wordCount: 0,
    characterCount: 0,
    isDirty: false,
  });
  
  createEditor(
    element: Element,
    options: {
      initialContent?: string;
      placeholder?: string;
      onUpdate?: (content: string) => void;
    } = {}
  ): Editor {
    this.editor = new Editor({
      element,
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [1, 2, 3, 4, 5, 6],
          },
          codeBlock: {
            HTMLAttributes: {
              class: 'code-block',
            },
          },
        }),
        Placeholder.configure({
          placeholder: options.placeholder || 'Bắt đầu viết chương...',
        }),
        CharacterCount,
        Markdown.configure({
          html: false,
          transformPastedText: true,
          transformCopiedText: true,
        }),
      ],
      content: options.initialContent || '',
      editorProps: {
        attributes: {
          class: 'prose prose-lg max-w-none focus:outline-none',
        },
      },
      onUpdate: ({ editor }) => {
        const markdown = editor.storage.markdown.getMarkdown();
        const wordCount = editor.storage.characterCount.words();
        const characterCount = editor.storage.characterCount.characters();
        
        this.state.update(s => ({
          ...s,
          content: markdown,
          wordCount,
          characterCount,
          isDirty: true,
        }));
        
        options.onUpdate?.(markdown);
      },
    });
    
    return this.editor;
  }
  
  setContent(content: string): void {
    if (this.editor) {
      this.editor.commands.setContent(content);
      this.state.update(s => ({ ...s, isDirty: false }));
    }
  }
  
  getContent(): string {
    return this.editor?.storage.markdown.getMarkdown() || '';
  }
  
  getContentDocument(): ChapterContentDocument {
    // Convert TipTap JSON to ChapterContentDocument format
    const json = this.editor?.getJSON();
    return this.convertToContentDocument(json);
  }
  
  markSaved(): void {
    this.state.update(s => ({
      ...s,
      isDirty: false,
      lastSaved: new Date(),
    }));
  }
  
  destroy(): void {
    this.editor?.destroy();
    this.editor = null;
  }
  
  private convertToContentDocument(json: any): ChapterContentDocument {
    // Convert TipTap JSON to our ChapterContentDocument format
    const blocks: ChapterContentBlock[] = [];
    
    if (json?.content) {
      for (const node of json.content) {
        const block = this.convertNodeToBlock(node);
        if (block) blocks.push(block);
      }
    }
    
    return {
      schemaVersion: 1,
      blocks,
    };
  }
  
  private convertNodeToBlock(node: any): ChapterContentBlock | null {
    const typeMap: Record<string, ChapterContentBlockType> = {
      paragraph: 'paragraph',
      heading: 'heading',
      blockquote: 'blockquote',
      bulletList: 'list',
      orderedList: 'list',
      codeBlock: 'code',
      horizontalRule: 'horizontal_rule',
    };
    
    const blockType = typeMap[node.type];
    if (!blockType) return null;
    
    // Extract text and marks
    const text = this.extractText(node);
    const marks = this.extractMarks(node);
    
    return {
      id: randomUUID(),
      type: blockType,
      text,
      marks,
    };
  }
  
  private extractText(node: any): string {
    if (node.text) return node.text;
    
    if (node.content) {
      return node.content.map((n: any) => this.extractText(n)).join('');
    }
    
    return '';
  }
  
  private extractMarks(node: any): ChapterContentMark[] {
    // Simplified - full implementation would track mark positions
    return [];
  }
}
```

**Task 2.2: Editor Component**

**File:** `frontend/src/app/features/author-portal/chapter-editor/editor/chapter-editor.component.ts`

```typescript
@Component({
  selector: 'app-chapter-editor',
  standalone: true,
  template: `
    <div class="chapter-editor">
      <!-- Toolbar -->
      <div class="editor-toolbar">
        <div class="toolbar-left">
          <button (click)="editor.chain().focus().toggleBold().run()" 
                  [class.active]="editor?.isActive('bold')">
            <strong>B</strong>
          </button>
          <button (click)="editor.chain().focus().toggleItalic().run()"
                  [class.active]="editor?.isActive('italic')">
            <em>I</em>
          </button>
          <button (click)="editor.chain().focus().toggleHeading({ level: 2 }).run()"
                  [class.active]="editor?.isActive('heading', { level: 2 })">
            H2
          </button>
          <button (click)="editor.chain().focus().toggleBlockquote().run()"
                  [class.active]="editor?.isActive('blockquote')">
            "
          </button>
          <button (click)="editor.chain().focus().toggleCodeBlock().run()"
                  [class.active]="editor?.isActive('codeBlock')">
            Code
          </button>
        </div>
        
        <div class="toolbar-right">
          <span class="word-count">
            {{ editorState().wordCount }} từ
          </span>
          
          <span class="save-status" [class]="saveStatus()">
            {{ saveStatusText() }}
          </span>
        </div>
      </div>
      
      <!-- Editor -->
      <div #editorElement class="editor-content"></div>
      
      <!-- Conflict warning -->
      @if (hasConflict()) {
        <div class="conflict-warning">
          <span class="icon">⚠️</span>
          <span>Có xung đột! Chương đã được cập nhật bởi người khác.</span>
          <button (click)="resolveConflict()">Xem thay đổi</button>
        </div>
      }
    </div>
  `,
  styles: [`
    .chapter-editor {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    
    .editor-toolbar {
      display: flex;
      justify-content: space-between;
      padding: 12px;
      border-bottom: 1px solid #e0e0e0;
      background: white;
    }
    
    .toolbar-left button {
      padding: 8px 12px;
      margin-right: 4px;
      border: 1px solid #ddd;
      background: white;
      cursor: pointer;
      border-radius: 4px;
    }
    
    .toolbar-left button.active {
      background: #e3f2fd;
      border-color: #2196f3;
    }
    
    .save-status {
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 14px;
    }
    
    .save-status.saving {
      background: #fff3e0;
      color: #f57c00;
    }
    
    .save-status.saved {
      background: #e8f5e9;
      color: #4caf50;
    }
    
    .save-status.conflict {
      background: #ffebee;
      color: #f44336;
    }
    
    .editor-content {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
    }
    
    .conflict-warning {
      padding: 16px;
      background: #fff3cd;
      border-top: 2px solid #ffc107;
      display: flex;
      align-items: center;
      gap: 12px;
    }
  `]
})
export class ChapterEditorComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('editorElement') editorElement!: ElementRef;
  @Input() chapterId = input.required<string>();
  
  private editorService = inject(TiptapEditorService);
  private autosaveService = inject(ChapterAutosaveService);
  private recoveryService = inject(EditorRecoveryService);
  private store = inject(ChapterEditorStore);
  
  editor: Editor | null = null;
  editorState = this.editorService.state;
  saveStatus = this.autosaveService.status;
  hasConflict = this.store.hasConflict;
  
  saveStatusText = computed(() => {
    switch (this.saveStatus()) {
      case 'saving': return 'Đang lưu...';
      case 'saved': return 'Đã lưu';
      case 'conflict': return 'Có xung đột';
      case 'error': return 'Lỗi lưu';
      default: return '';
    }
  });
  
  ngAfterViewInit() {
    this.initializeEditor();
  }
  
  async ngOnInit() {
    await this.loadChapter();
    
    // Check for local recovery
    const recovered = await this.recoveryService.checkRecovery(this.chapterId());
    if (recovered) {
      // Show recovery prompt
      this.showRecoveryDialog(recovered);
    }
  }
  
  ngOnDestroy() {
    this.editorService.destroy();
    this.autosaveService.stop();
  }
  
  private async initializeEditor() {
    this.editor = this.editorService.createEditor(
      this.editorElement.nativeElement,
      {
        placeholder: 'Bắt đầu viết chương của bạn...',
        onUpdate: (content) => {
          this.autosaveService.scheduleAutosave({
            chapterId: this.chapterId(),
            content,
          });
          
          // Save to local recovery
          this.recoveryService.saveLocal(this.chapterId(), content);
        },
      }
    );
  }
  
  private async loadChapter() {
    const chapter = await this.store.load(this.chapterId());
    
    if (chapter) {
      this.editorService.setContent(chapter.content);
    }
  }
  
  private showRecoveryDialog(recoveredContent: string) {
    // Show dialog asking user if they want to restore
  }
  
  resolveConflict() {
    // Show conflict resolution UI
  }
}
```

---

### 3. Autosave System (2 ngày)

**Task 3.1: Autosave Service**

**File:** `frontend/src/app/features/author-portal/chapter-editor/services/chapter-autosave.service.ts`

```typescript
import { Injectable, signal } from '@angular/core';
import { Subject, debounceTime, switchMap, catchError, of } from 'rxjs';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';

interface AutosaveData {
  chapterId: string;
  content: string;
}

@Injectable()
export class ChapterAutosaveService {
  private autosaveSubject = new Subject<AutosaveData>();
  private currentVersion = signal<number>(1);
  
  status = signal<SaveStatus>('idle');
  lastSaved = signal<Date | null>(null);
  errorMessage = signal<string | null>(null);
  
  constructor(
    private repository: ChapterEditorRepository,
  ) {
    this.setupAutosave();
  }
  
  private setupAutosave() {
    this.autosaveSubject.pipe(
      debounceTime(2500), // 2.5 second debounce
      switchMap(data => {
        this.status.set('saving');
        
        return this.repository.autosaveChapter({
          chapterId: data.chapterId,
          content: data.content,
          expectedVersion: this.currentVersion(),
        }).pipe(
          catchError(error => {
            if (error.code === 'VERSION_CONFLICT') {
              this.status.set('conflict');
              return of({ status: 'conflict', version: error.serverVersion });
            }
            
            this.status.set('error');
            this.errorMessage.set(error.message);
            return of({ status: 'error' });
          })
        );
      })
    ).subscribe(result => {
      if (result.status === 'conflict') {
        // Handle conflict
        this.handleVersionConflict(result.version);
      } else if (result.status === 'error') {
        // Error already set
      } else {
        this.status.set('saved');
        this.lastSaved.set(new Date());
        this.currentVersion.set(result.version);
        
        // Reset to idle after 3 seconds
        setTimeout(() => {
          if (this.status() === 'saved') {
            this.status.set('idle');
          }
        }, 3000);
      }
    });
  }
  
  scheduleAutosave(data: AutosaveData): void {
    this.autosaveSubject.next(data);
  }
  
  forceSave(data: AutosaveData): Promise<void> {
    this.status.set('saving');
    
    return new Promise((resolve, reject) => {
      this.repository.autosaveChapter({
        chapterId: data.chapterId,
        content: data.content,
        expectedVersion: this.currentVersion(),
      }).subscribe({
        next: (result) => {
          this.status.set('saved');
          this.lastSaved.set(new Date());
          this.currentVersion.set(result.version);
          resolve();
        },
        error: (error) => {
          if (error.code === 'VERSION_CONFLICT') {
            this.status.set('conflict');
          } else {
            this.status.set('error');
            this.errorMessage.set(error.message);
          }
          reject(error);
        }
      });
    });
  }
  
  stop(): void {
    this.autosaveSubject.complete();
  }
  
  private handleVersionConflict(serverVersion: number) {
    // Emit conflict event for UI to handle
    console.warn('Version conflict detected', {
      client: this.currentVersion(),
      server: serverVersion,
    });
  }
}
```

**Task 3.2: Backend Autosave Endpoint**

**File:** `backend/src/modules/chapters/application/commands/autosave-chapter/autosave-chapter.command-handler.ts`

```typescript
@Injectable()
export class AutosaveChapterCommandHandler {
  constructor(
    @Inject(CHAPTER_PERSISTENCE_PORT)
    private readonly persistence: ChapterPersistencePort,
    @Inject(CHAPTER_VERSION_PORT)
    private readonly versionPort: ChapterVersionPort,
    private readonly logger: Logger,
  ) {}
  
  async execute(command: AutosaveChapterCommand): Promise<AutosaveChapterResult> {
    // 1. Get current chapter
    const chapter = await this.persistence.findById(command.chapterId);
    
    if (!chapter) {
      throw new ResourceNotFoundException('Chapter', command.chapterId);
    }
    
    // 2. Verify permission
    await this.verifyEditPermission(command.userId, chapter);
    
    // 3. Optimistic concurrency check
    if (command.expectedVersion && chapter.version !== command.expectedVersion) {
      throw new VersionConflictException(
        `Version mismatch. Expected: ${command.expectedVersion}, Current: ${chapter.version}`,
        chapter.version,
      );
    }
    
    // 4. Parse content to ChapterContentDocument
    const contentDocument = createChapterContentDocument(
      command.content,
      chapter.contentDocument, // Previous for block ID reconciliation
    );
    
    const wordCount = this.calculateWordCount(command.content);
    
    // 5. Update chapter (increment version)
    const result = await this.persistence.update({
      chapterId: command.chapterId,
      content: command.content,
      contentDocument,
      wordCount,
      updatedById: command.userId,
      incrementVersion: true,
    });
    
    // 6. Create version snapshot (autosave)
    await this.versionPort.createVersion({
      chapterId: command.chapterId,
      versionNumber: result.version,
      versionType: 'AUTOSAVE',
      title: result.title,
      content: command.content,
      contentDocument,
      wordCount,
      createdById: command.userId,
      isRetained: false,
      expiresAt: this.calculateAutosaveExpiry(),
    });
    
    this.logger.log({
      message: 'Chapter autosaved',
      chapterId: command.chapterId,
      version: result.version,
      wordCount,
    });
    
    return {
      version: result.version,
      wordCount,
      savedAt: new Date(),
    };
  }
  
  private async verifyEditPermission(userId: string, chapter: ChapterDto): Promise<void> {
    // Check if user is author or contributor with edit permission
    const isAuthor = await this.persistence.isAuthor(userId, chapter.storyId);
    
    if (isAuthor) return;
    
    const contributor = await this.persistence.findContributor(userId, chapter.storyId);
    
    if (!contributor || !contributor.canEdit) {
      throw new AccessDeniedException('You do not have permission to edit this chapter');
    }
  }
  
  private calculateWordCount(content: string): number {
    return content.split(/\s+/).filter(w => w.length > 0).length;
  }
  
  private calculateAutosaveExpiry(): Date {
    // Keep autosaves for 7 days
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 7);
    return expiry;
  }
}
```

---

### 4. Local Recovery System (2 ngày)

**Task 4.1: IndexedDB Recovery Service**

**File:** `frontend/src/app/features/author-portal/chapter-editor/services/editor-recovery.service.ts`

```typescript
@Injectable({ providedIn: 'root' })
export class EditorRecoveryService {
  private db: IDBDatabase | null = null;
  
  async init(): Promise<void> {
    this.db = await openDB('chapter-editor-recovery', 1, {
      upgrade(db) {
        const store = db.createObjectStore('drafts', { keyPath: 'chapterId' });
        store.createIndex('savedAt', 'savedAt');
      },
    });
  }
  
  async saveLocal(chapterId: string, content: string): Promise<void> {
    if (!this.db) await this.init();
    
    const draft = {
      chapterId,
      content,
      savedAt: new Date().toISOString(),
      sessionId: this.getSessionId(),
    };
    
    await this.db!.put('drafts', draft);
  }
  
  async checkRecovery(chapterId: string): Promise<string | null> {
    if (!this.db) await this.init();
    
    const draft = await this.db!.get('drafts', chapterId);
    
    if (!draft) return null;
    
    // Check if draft is from different session (crash recovery)
    if (draft.sessionId !== this.getSessionId()) {
      return draft.content;
    }
    
    return null;
  }
  
  async acceptRecovery(chapterId: string): Promise<string | null> {
    const content = await this.checkRecovery(chapterId);
    
    if (content) {
      await this.clearDraft(chapterId);
    }
    
    return content;
  }
  
  async rejectRecovery(chapterId: string): Promise<void> {
    await this.clearDraft(chapterId);
  }
  
  async clearDraft(chapterId: string): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.delete('drafts', chapterId);
  }
  
  private getSessionId(): string {
    let sessionId = sessionStorage.getItem('editor-session-id');
    
    if (!sessionId) {
      sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem('editor-session-id', sessionId);
    }
    
    return sessionId;
  }
}
```

---

### 5. Chapter Workflow System (3 ngày)

**Task 5.1: Workflow Commands**

**File:** `backend/src/modules/chapters/application/commands/submit-chapter-for-review/submit-chapter-for-review.command-handler.ts`

```typescript
@Injectable()
export class SubmitChapterForReviewCommandHandler {
  constructor(
    @Inject(CHAPTER_PERSISTENCE_PORT)
    private readonly persistence: ChapterPersistencePort,
    @Inject(CHAPTER_VERSION_PORT)
    private readonly versionPort: ChapterVersionPort,
    private readonly eventBus: EventBus,
  ) {}
  
  async execute(command: SubmitChapterForReviewCommand): Promise<void> {
    // 1. Get chapter
    const chapter = await this.persistence.findById(command.chapterId);
    
    if (!chapter) {
      throw new ResourceNotFoundException('Chapter', command.chapterId);
    }
    
    // 2. Verify permission
    if (chapter.createdById !== command.userId) {
      throw new AccessDeniedException('Only chapter author can submit for review');
    }
    
    // 3. Validate state transition
    if (chapter.status !== 'DRAFT') {
      throw new InvalidStateTransitionException(
        `Cannot submit chapter in status: ${chapter.status}`
      );
    }
    
    // 4. Create manual save version
    await this.versionPort.createVersion({
      chapterId: command.chapterId,
      versionNumber: chapter.version + 1,
      versionType: 'MANUAL_SAVE',
      title: chapter.title,
      content: chapter.content,
      contentDocument: chapter.contentDocument,
      wordCount: chapter.wordCount,
      createdById: command.userId,
      comment: 'Submitted for review',
      isRetained: true,
    });
    
    // 5. Update status
    await this.persistence.updateStatus({
      chapterId: command.chapterId,
      status: 'IN_REVIEW',
      updatedById: command.userId,
    });
    
    // 6. Publish event
    this.eventBus.publish(new ChapterSubmittedForReviewEvent({
      chapterId: command.chapterId,
      storyId: chapter.storyId,
      authorId: command.userId,
    }));
  }
}
```

**File:** `backend/src/modules/chapters/application/commands/review-chapter/review-chapter.command-handler.ts`

```typescript
@Injectable()
export class ReviewChapterCommandHandler {
  constructor(
    @Inject(CHAPTER_PERSISTENCE_PORT)
    private readonly persistence: ChapterPersistencePort,
    @Inject(CHAPTER_REVIEW_PORT)
    private readonly reviewPort: ChapterReviewPort,
    private readonly authPolicy: AuthorizationPolicyService,
    private readonly eventBus: EventBus,
  ) {}
  
  async execute(command: ReviewChapterCommand): Promise<void> {
    // 1. Get chapter
    const chapter = await this.persistence.findById(command.chapterId);
    
    if (!chapter) {
      throw new ResourceNotFoundException('Chapter', command.chapterId);
    }
    
    // 2. Verify reviewer permission
    const canReview = await this.authPolicy.can(
      command.reviewerId,
      'review:chapter',
      { storyId: chapter.storyId },
    );
    
    if (!canReview) {
      throw new AccessDeniedException('You do not have permission to review chapters');
    }
    
    // 3. Validate state
    if (chapter.status !== 'IN_REVIEW') {
      throw new InvalidStateTransitionException(
        `Chapter must be in review status. Current: ${chapter.status}`
      );
    }
    
    // 4. Create review record
    await this.reviewPort.createReview({
      chapterId: command.chapterId,
      reviewerId: command.reviewerId,
      decision: command.decision,
      comment: command.comment,
      reviewedVersion: chapter.version,
    });
    
    // 5. Update chapter status based on decision
    let newStatus: ChapterStatus;
    
    switch (command.decision) {
      case 'APPROVED':
        newStatus = 'APPROVED';
        break;
      case 'REJECTED':
      case 'REQUEST_CHANGES':
        newStatus = 'DRAFT';
        break;
      default:
        throw new Error(`Unknown review decision: ${command.decision}`);
    }
    
    await this.persistence.updateStatus({
      chapterId: command.chapterId,
      status: newStatus,
      updatedById: command.reviewerId,
    });
    
    // 6. Publish event
    this.eventBus.publish(new ChapterReviewedEvent({
      chapterId: command.chapterId,
      reviewerId: command.reviewerId,
      decision: command.decision,
      newStatus,
    }));
  }
}
```

---

### 6. Version History & Diff (2 ngày)

**Task 6.1: Version History Query**

**File:** `backend/src/modules/chapters/application/queries/list-chapter-versions/list-chapter-versions.query-handler.ts`

```typescript
@Injectable()
export class ListChapterVersionsQueryHandler {
  constructor(
    @Inject(CHAPTER_VERSION_PORT)
    private readonly versionPort: ChapterVersionPort,
  ) {}
  
  async execute(query: ListChapterVersionsQuery): Promise<ChapterVersionPageDto> {
    const versions = await this.versionPort.listVersions({
      chapterId: query.chapterId,
      page: query.page,
      pageSize: query.pageSize,
      includeAutosaves: query.includeAutosaves ?? false,
    });
    
    return versions;
  }
}
```

**Task 6.2: Diff Generation**

**File:** `backend/src/modules/chapters/application/queries/get-version-diff/get-version-diff.query-handler.ts`

```typescript
import { diffLines, Change } from 'diff';

@Injectable()
export class GetVersionDiffQueryHandler {
  constructor(
    @Inject(CHAPTER_VERSION_PORT)
    private readonly versionPort: ChapterVersionPort,
  ) {}
  
  async execute(query: GetVersionDiffQuery): Promise<VersionDiffDto> {
    // Get both versions
    const [oldVersion, newVersion] = await Promise.all([
      this.versionPort.findVersion(query.oldVersionId),
      this.versionPort.findVersion(query.newVersionId),
    ]);
    
    if (!oldVersion || !newVersion) {
      throw new ResourceNotFoundException('Version');
    }
    
    // Generate diff
    const changes = diffLines(oldVersion.content, newVersion.content);
    
    return {
      oldVersion: {
        id: oldVersion.id,
        versionNumber: oldVersion.versionNumber,
        createdAt: oldVersion.createdAt,
      },
      newVersion: {
        id: newVersion.id,
        versionNumber: newVersion.versionNumber,
        createdAt: newVersion.createdAt,
      },
      changes: changes.map(this.mapChange),
      stats: this.calculateStats(changes),
    };
  }
  
  private mapChange(change: Change): DiffChange {
    return {
      type: change.added ? 'added' : change.removed ? 'removed' : 'unchanged',
      value: change.value,
      count: change.count,
    };
  }
  
  private calculateStats(changes: Change[]): DiffStats {
    let added = 0;
    let removed = 0;
    let unchanged = 0;
    
    for (const change of changes) {
      if (change.added) {
        added += change.count || 0;
      } else if (change.removed) {
        removed += change.count || 0;
      } else {
        unchanged += change.count || 0;
      }
    }
    
    return { added, removed, unchanged };
  }
}
```

---

## 📝 IMPLEMENTATION ORDER

### Day 1-3: TipTap Editor Integration
- [ ] Install TipTap dependencies
- [ ] Create TiptapEditorService
- [ ] Create ChapterEditorComponent
- [ ] Toolbar implementation
- [ ] Markdown conversion
- [ ] Tests

### Day 4-5: Autosave System
- [ ] ChapterAutosaveService
- [ ] Debounce implementation
- [ ] Backend autosave endpoint
- [ ] Optimistic concurrency
- [ ] Tests

### Day 6-7: Local Recovery
- [ ] IndexedDB setup
- [ ] EditorRecoveryService
- [ ] Crash detection
- [ ] Recovery dialog UI
- [ ] Tests

### Day 8-10: Chapter Workflow
- [ ] Database schema migration
- [ ] Submit for review command
- [ ] Review chapter command
- [ ] Approve/reject logic
- [ ] State transition validation
- [ ] Tests

### Day 11-12: Version History & Diff
- [ ] List versions query
- [ ] Get diff query
- [ ] Version history UI
- [ ] Diff viewer component
- [ ] Restore functionality
- [ ] Tests

### Day 13-14: Permission System
- [ ] Contributor permission checks
- [ ] Backend authorization
- [ ] UI permission gates
- [ ] Tests

### Day 15: Integration & Polish
- [ ] E2E tests
- [ ] Conflict resolution UI
- [ ] Documentation

---

## 🧪 TESTING STRATEGY

### Unit Tests
- [ ] Editor state management
- [ ] Autosave debounce
- [ ] Version conflict detection
- [ ] Diff generation

### Integration Tests
- [ ] Autosave → version created
- [ ] Conflict → proper error
- [ ] Review → status updated
- [ ] Recovery → draft restored

### E2E Tests
- [ ] Full editing session
- [ ] Multi-tab editing
- [ ] Crash recovery
- [ ] Version restore

---

## ✅ DEFINITION OF DONE

- [ ] All tests passing
- [ ] TipTap editor functional
- [ ] Autosave working (2.5s debounce)
- [ ] Version conflicts detected
- [ ] Local recovery functional
- [ ] Chapter workflow complete
- [ ] Permission checks backend + frontend
- [ ] Documentation complete
