# SPRINT 12 — Content Protection (Thực dụng)
**Timeline:** 6–10 ngày  
**Mục tiêu:** Entitlement-based protection với signed URLs, leak tracing và forensic watermarking

---

## 🎯 ACCEPTANCE CRITERIA

✅ Signed URL/cookie ngắn hạn cho comic  
✅ Text API tiếp tục entitlement check và `private, no-store`  
✅ Pseudonymous leak token bằng HMAC (không nhúng raw user ID)  
✅ Watermark visible nhẹ cho comic trả phí  
✅ Tool nội bộ giải mã leak token với audit  
✅ **KHÔNG** chặn bôi đen (xung đột inline comments)  
✅ **KHÔNG** chặn chuột phải/DevTools (phá accessibility)  
✅ **KHÔNG** dynamic font scrambling (phá TTS/search/a11y)  

---

## 📊 PHILOSOPHY

### Mục tiêu đúng:
1. **Entitlement enforcement** - Người chưa trả không access được
2. **Hotlink prevention** - Không share trực tiếp URL
3. **Forensic tracing** - Tìm nguồn leak nếu xảy ra
4. **Abuse handling** - Xử lý người vi phạm

### Không nên coi là security control:
- ❌ Chặn select/copy text (phá accessibility)
- ❌ Chặn chuột phải/F12 (dễ bypass, phá UX)
- ❌ Font scrambling (phá TTS, search, screen reader)
- ❌ Canvas fingerprinting aggressive (privacy concern)

### Thực tế:
> Browser đã nhận plaintext/ảnh → không thể ngăn người quyết tâm trích xuất  
> Mục tiêu: Tăng ma sát + forensic tracing + xử lý abuse

---

## 🏗️ TECHNICAL DESIGN

### 1. Signed URLs cho Comic (2 ngày)

**Task 1.1: Cloudinary Signed URLs**

**File:** `backend/src/modules/chapters/application/queries/get-chapter-reader-with-signed-media/get-chapter-reader-with-signed-media.query-handler.ts`

```typescript
@Injectable()
export class GetChapterReaderWithSignedMediaQueryHandler {
  constructor(
    @Inject(CHAPTER_READER_PORT)
    private readonly chapterReader: ChapterReaderPort,
    @Inject(MEDIA_SIGNATURE_PORT)
    private readonly mediaSignature: MediaSignaturePort,
    private readonly config: ConfigService,
  ) {}
  
  async execute(query: GetChapterReaderWithSignedMediaQuery): Promise<ChapterReaderDto> {
    // 1. Get chapter with entitlement check
    const chapter = await this.chapterReader.getChapterForUser(
      query.chapterId,
      query.userId,
    );
    
    if (!chapter.access.allowed) {
      throw new AccessDeniedException('You do not have access to this chapter');
    }
    
    // 2. Sign media URLs if needed
    if (chapter.access.state === 'ENTITLED' || chapter.access.state === 'PAID') {
      chapter.media = await this.signMediaUrls(
        chapter.media,
        query.userId,
        query.chapterId,
      );
    }
    
    return chapter;
  }
  
  private async signMediaUrls(
    media: MediaAsset[],
    userId: string,
    chapterId: string,
  ): Promise<MediaAsset[]> {
    const ttl = this.config.get('media.signedUrlTtl', 3600); // 1 hour
    
    return Promise.all(
      media.map(async (asset) => {
        // Generate pseudonymous token
        const token = this.mediaSignature.generateLeakToken({
          userId,
          assetId: asset.id,
          chapterId,
          expiresAt: new Date(Date.now() + ttl * 1000),
        });
        
        // Sign URL with Cloudinary
        const signedUrl = this.mediaSignature.signCloudinaryUrl({
          publicId: asset.publicId,
          transformation: asset.transformation,
          ttl,
          // Embed token in transformation parameters
          overlayText: token.substring(0, 8), // First 8 chars visible watermark
        });
        
        return {
          ...asset,
          url: signedUrl,
          _leakToken: token, // Store full token for forensics
        };
      })
    );
  }
}
```

**Task 1.2: Leak Token Generation**

**File:** `backend/src/modules/media/infrastructure/signature/leak-token.service.ts`

```typescript
import { createHmac } from 'crypto';

@Injectable()
export class LeakTokenService {
  private readonly secret: string;
  
  constructor(private readonly config: ConfigService) {
    this.secret = this.config.get('security.leakTokenSecret');
    
    if (!this.secret) {
      throw new Error('Leak token secret not configured');
    }
  }
  
  generateLeakToken(input: {
    userId: string;
    assetId: string;
    chapterId: string;
    expiresAt: Date;
  }): string {
    // Create pseudonymous token (NOT embedding raw user ID)
    const payload = {
      u: this.hashUserId(input.userId),
      a: input.assetId,
      c: input.chapterId,
      e: Math.floor(input.expiresAt.getTime() / 1000),
    };
    
    const data = JSON.stringify(payload);
    const signature = createHmac('sha256', this.secret)
      .update(data)
      .digest('hex')
      .substring(0, 16);
    
    // Encode as base64
    const token = Buffer.from(`${data}.${signature}`).toString('base64url');
    
    return token;
  }
  
  decodeLeakToken(token: string): {
    userHash: string;
    assetId: string;
    chapterId: string;
    expiresAt: Date;
    valid: boolean;
  } | null {
    try {
      const decoded = Buffer.from(token, 'base64url').toString('utf-8');
      const [data, signature] = decoded.split('.');
      
      // Verify signature
      const expectedSignature = createHmac('sha256', this.secret)
        .update(data)
        .digest('hex')
        .substring(0, 16);
      
      if (signature !== expectedSignature) {
        return null;
      }
      
      const payload = JSON.parse(data);
      
      return {
        userHash: payload.u,
        assetId: payload.a,
        chapterId: payload.c,
        expiresAt: new Date(payload.e * 1000),
        valid: true,
      };
    } catch (error) {
      return null;
    }
  }
  
  async resolveUserFromHash(userHash: string): Promise<string | null> {
    // Query database to find user by hash
    // This lookup is intentionally slow to prevent brute force
    const user = await this.prisma.user.findFirst({
      where: {
        // Store hash in a dedicated field for lookup
        leakTokenHash: userHash,
      },
      select: { id: true },
    });
    
    return user?.id || null;
  }
  
  private hashUserId(userId: string): string {
    // One-way hash with secret salt
    // Cannot reverse to get userId
    return createHmac('sha256', this.secret)
      .update(userId)
      .digest('hex')
      .substring(0, 32);
  }
}
```

---

### 2. Text API Protection (1 ngày)

**Task 2.1: Cache Headers Enhancement**

**File:** `backend/src/modules/chapters/presentation/http/controllers/public-chapter-reader.controller.ts`

```typescript
@Controller('public/chapters')
export class PublicChapterReaderController {
  constructor(
    private readonly queryBus: QueryBus,
  ) {}
  
  @Get(':storySlug/:chapterSlug')
  @Header('Cache-Control', 'private, no-store, no-cache, must-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async getChapter(
    @Param('storySlug') storySlug: string,
    @Param('chapterSlug') chapterSlug: string,
    @CurrentUserId() userId: string | null,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ChapterReaderResponse> {
    const query = new GetPublicChapterReaderQuery(
      storySlug,
      chapterSlug,
      userId,
    );
    
    const result = await this.queryBus.execute(query);
    
    // Add security headers for paid content
    if (result.chapter.access.state === 'ENTITLED') {
      response.setHeader('X-Content-Type-Options', 'nosniff');
      response.setHeader('X-Frame-Options', 'DENY');
      response.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
    }
    
    return ChapterReaderResponse.from(result);
  }
}
```

---

### 3. Visual Watermark cho Comic (2 ngày)

**Task 3.1: Cloudinary Overlay Transformation**

**File:** `backend/src/modules/media/infrastructure/cloudinary/watermark-generator.service.ts`

```typescript
@Injectable()
export class WatermarkGeneratorService {
  constructor(
    private readonly config: ConfigService,
    private readonly cloudinary: CloudinaryService,
  ) {}
  
  generateWatermarkedUrl(input: {
    publicId: string;
    userId: string;
    leakToken: string;
    isPaid: boolean;
  }): string {
    if (!input.isPaid) {
      // No watermark for free content
      return this.cloudinary.buildUrl(input.publicId);
    }
    
    // Extract short token for visible watermark
    const shortToken = input.leakToken.substring(0, 8);
    
    // Cloudinary transformation with text overlay
    const transformation: CloudinaryTransformation = {
      // Main image
      width: 800,
      crop: 'limit',
      quality: 'auto:good',
      
      // Text overlay (bottom-right, semi-transparent)
      overlay: {
        font_family: 'Arial',
        font_size: 12,
        font_weight: 'normal',
        text: shortToken,
      },
      gravity: 'south_east',
      x: 10,
      y: 10,
      opacity: 30, // 30% opacity - visible but not intrusive
      color: '#FFFFFF',
    };
    
    return this.cloudinary.buildUrl(input.publicId, transformation);
  }
  
  generateInvisibleWatermark(input: {
    publicId: string;
    leakToken: string;
  }): string {
    // EXPERIMENTAL: LSB steganography
    // WARNING: Not recommended for production
    // - Can be removed by simple image processing
    // - Conflicts with image optimization
    // - Better to use visible watermark only
    
    throw new Error('Invisible watermark not recommended - use visible only');
  }
}
```

**Task 3.2: Watermark Policy**

**File:** `backend/src/modules/media/domain/policies/watermark.policy.ts`

```typescript
export class WatermarkPolicy {
  /**
   * Determine if content should be watermarked
   */
  static shouldWatermark(chapter: ChapterDto): boolean {
    // Only watermark paid content that user has purchased
    return (
      chapter.accessType === 'PAID' &&
      chapter.access.state === 'ENTITLED'
    );
  }
  
  /**
   * WARNING: Do NOT use these techniques
   */
  static readonly FORBIDDEN_TECHNIQUES = [
    'Zero-width characters in text', // Breaks TTS, search, copy-paste
    'CSS font scrambling',           // Breaks TTS, search, accessibility
    'Canvas fingerprinting',         // Privacy concern
    'Aggressive DRM',                // Poor UX, easily bypassed
  ];
  
  /**
   * Recommended approach
   */
  static readonly RECOMMENDED = {
    visible_watermark: true,        // Deterrent + forensic
    signed_urls: true,              // Prevent hotlinking
    entitlement_check: true,        // Access control
    abuse_response_plan: true,      // Handle violations
  };
}
```

---

### 4. Forensic Tools (2 ngày)

**Task 4.1: Leak Investigation Tool**

**File:** `backend/src/modules/admin/application/commands/investigate-leak/investigate-leak.command-handler.ts`

```typescript
@Injectable()
export class InvestigateLeakCommandHandler {
  constructor(
    private readonly leakToken: LeakTokenService,
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}
  
  async execute(command: InvestigateLeakCommand): Promise<LeakInvestigationResult> {
    // 1. Decode leak token
    const decoded = this.leakToken.decodeLeakToken(command.leakToken);
    
    if (!decoded || !decoded.valid) {
      throw new InvalidInputException('Invalid leak token');
    }
    
    // 2. Resolve user from hash
    const userId = await this.leakToken.resolveUserFromHash(decoded.userHash);
    
    if (!userId) {
      return {
        found: false,
        reason: 'User hash not found in database',
      };
    }
    
    // 3. Get user details
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
      },
    });
    
    if (!user) {
      return {
        found: false,
        reason: 'User deleted',
      };
    }
    
    // 4. Get chapter and asset details
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: decoded.chapterId },
      include: { story: true },
    });
    
    const asset = await this.prisma.media.findUnique({
      where: { id: decoded.assetId },
    });
    
    // 5. Get purchase/entitlement history
    const entitlement = await this.prisma.chapterEntitlement.findUnique({
      where: {
        userId_chapterId: {
          userId,
          chapterId: decoded.chapterId,
        },
      },
    });
    
    // 6. Audit log this investigation
    await this.auditLog.log({
      action: 'LEAK_INVESTIGATION',
      actor: command.investigatorId,
      resource: 'User',
      resourceId: userId,
      metadata: {
        leakToken: command.leakToken,
        chapterId: decoded.chapterId,
        assetId: decoded.assetId,
        expiresAt: decoded.expiresAt,
      },
    });
    
    return {
      found: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        createdAt: user.createdAt,
      },
      chapter: chapter ? {
        id: chapter.id,
        title: chapter.title,
        storyTitle: chapter.story.title,
      } : null,
      asset: asset ? {
        id: asset.id,
        publicId: asset.publicId,
        url: asset.publicUrl,
      } : null,
      entitlement: entitlement ? {
        purchasedAt: entitlement.purchasedAt,
        priceCredits: entitlement.priceCredits,
        status: entitlement.status,
      } : null,
      tokenExpiry: decoded.expiresAt,
    };
  }
}
```

**Task 4.2: False Positive Review**

**File:** `backend/src/modules/admin/application/commands/review-leak-report/review-leak-report.command-handler.ts`

```typescript
@Injectable()
export class ReviewLeakReportCommandHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}
  
  async execute(command: ReviewLeakReportCommand): Promise<void> {
    // 1. Get investigation result
    const investigation = await this.prisma.leakInvestigation.findUnique({
      where: { id: command.investigationId },
    });
    
    if (!investigation) {
      throw new ResourceNotFoundException('LeakInvestigation', command.investigationId);
    }
    
    // 2. Review decision
    await this.prisma.leakInvestigation.update({
      where: { id: command.investigationId },
      data: {
        reviewedBy: command.reviewerId,
        reviewedAt: new Date(),
        reviewDecision: command.decision, // CONFIRMED, FALSE_POSITIVE, INCONCLUSIVE
        reviewNotes: command.notes,
      },
    });
    
    // 3. If confirmed, take action
    if (command.decision === 'CONFIRMED' && command.action) {
      switch (command.action) {
        case 'WARNING':
          await this.issueWarning(investigation.userId, command.notes);
          break;
        case 'SUSPEND':
          await this.suspendUser(investigation.userId, command.notes);
          break;
        case 'BAN':
          await this.banUser(investigation.userId, command.notes);
          break;
      }
    }
  }
  
  private async issueWarning(userId: string, reason: string): Promise<void> {
    // Send warning notification
    await this.prisma.notification.create({
      data: {
        userId,
        type: 'SECURITY_WARNING',
        title: 'Cảnh báo vi phạm bản quyền',
        content: reason,
      },
    });
  }
  
  private async suspendUser(userId: string, reason: string): Promise<void> {
    // Temporary suspension
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: 'SUSPENDED',
        suspendedAt: new Date(),
        suspensionReason: reason,
      },
    });
  }
  
  private async banUser(userId: string, reason: string): Promise<void> {
    // Permanent ban
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: 'BANNED',
        bannedAt: new Date(),
        banReason: reason,
      },
    });
  }
}
```

---

### 5. Frontend - KHÔNG làm gì phá UX (1 ngày)

**Task 5.1: Documentation - What NOT to do**

**File:** `CONTENT_PROTECTION_GUIDELINES.md`

```markdown
# Content Protection Guidelines

## ✅ RECOMMENDED

### 1. Entitlement-based Access Control
- Server-side checks before serving content
- JWT/session-based authentication
- Proper HTTP cache headers

### 2. Signed URLs for Media
- Short-lived tokens (1-4 hours)
- HMAC-based signatures
- Cloudinary signed URLs

### 3. Visible Watermarking
- Semi-transparent text overlay
- Pseudonymous leak tokens
- Bottom-right corner, 30% opacity

### 4. Forensic Tracing
- Leak token investigation tools
- Audit logging
- False positive review process

### 5. Abuse Response
- Warning system
- Temporary suspension
- Permanent ban for repeat offenders

---

## ❌ DO NOT IMPLEMENT

### 1. Text Selection Blocking
```javascript
// ❌ BAD - Breaks accessibility
document.addEventListener('selectstart', (e) => e.preventDefault());
document.addEventListener('copy', (e) => e.preventDefault());
```

**Why:**
- Breaks screen readers
- Prevents legitimate copy-paste for notes
- Easily bypassed (disable JS)
- Poor user experience

### 2. Right-Click Blocking
```javascript
// ❌ BAD - Annoying and useless
document.addEventListener('contextmenu', (e) => e.preventDefault());
```

**Why:**
- Trivial to bypass
- Breaks browser accessibility features
- Annoys legitimate users

### 3. DevTools Detection
```javascript
// ❌ BAD - Cat and mouse game
setInterval(() => {
  if (window.outerWidth - window.innerWidth > 100) {
    alert('DevTools detected!');
  }
}, 1000);
```

**Why:**
- Unreliable detection
- Can be bypassed easily
- Performance overhead
- False positives

### 4. CSS Font Scrambling
```css
/* ❌ BAD - Breaks everything */
@font-face {
  font-family: 'scrambled';
  /* Custom font with scrambled glyphs */
}
```

**Why:**
- Breaks text-to-speech
- Breaks search/find
- Breaks screen readers
- Breaks offline reading
- Can be reverse-engineered

### 5. Zero-Width Characters
```javascript
// ❌ BAD - Invisible watermark in text
const watermark = '​‌‍'; // Zero-width chars
```

**Why:**
- Breaks TTS engines
- Affects search indexing
- Can be stripped easily
- Privacy concern (tracking users)

### 6. Canvas Fingerprinting
```javascript
// ❌ BAD - Privacy violation
const canvas = document.createElement('canvas');
// Generate unique fingerprint
```

**Why:**
- Privacy violation
- GDPR/CCPA concerns
- Can be blocked by browsers
- Not reliable for protection

---

## ⚠️ IMPORTANT REMINDERS

### Inline Comments Compatibility
- **DO NOT** block text selection
- Users need to select text to add inline comments
- This is a core feature, not abuse

### Accessibility Requirements
- Screen readers must work
- Copy-paste must work for notes
- TTS must work
- Keyboard navigation must work

### Legal Reality
- Once content is in browser, it can be extracted
- Goal is deterrence + forensics, not perfect DRM
- Focus on making abuse inconvenient, not impossible

---

## 📊 EFFECTIVENESS HIERARCHY

1. **Entitlement Check** - 95% effective
   - Stops casual sharing
   - Clear paywall

2. **Signed URLs** - 90% effective
   - Prevents hotlinking
   - Short-lived tokens

3. **Visible Watermark** - 70% effective
   - Deterrent (fear of tracing)
   - Forensic evidence

4. **Leak Investigation** - 60% effective
   - Post-incident response
   - Deterrent through punishment

5. **Right-click block** - 5% effective
   - Trivial bypass
   - Annoys users

6. **Font scrambling** - 0% effective
   - Breaks features
   - Easily reversed
```

---

## 📝 IMPLEMENTATION ORDER

### Day 1-2: Signed URLs
- [ ] Leak token generation
- [ ] HMAC-based pseudonymous tokens
- [ ] Cloudinary signing
- [ ] Tests

### Day 3: Text API Headers
- [ ] Cache-Control headers
- [ ] Security headers
- [ ] Tests

### Day 4-5: Visual Watermark
- [ ] Cloudinary overlay
- [ ] Watermark policy
- [ ] Integration with signed URLs
- [ ] Tests

### Day 6-8: Forensic Tools
- [ ] Leak investigation command
- [ ] Token decoding
- [ ] User resolution
- [ ] Audit logging
- [ ] Tests

### Day 9: False Positive Review
- [ ] Review workflow
- [ ] Action system (warning/suspend/ban)
- [ ] Admin UI
- [ ] Tests

### Day 10: Documentation & Guidelines
- [ ] What NOT to do guide
- [ ] Effectiveness analysis
- [ ] Legal disclaimer
- [ ] Training materials

---

## 🧪 TESTING STRATEGY

### Security Tests
- [ ] Token cannot be forged
- [ ] User ID not exposed in token
- [ ] Signed URLs expire correctly
- [ ] Entitlement always checked

### Accessibility Tests
- [ ] Screen reader works
- [ ] Copy-paste works
- [ ] TTS works
- [ ] Keyboard navigation works

### Forensic Tests
- [ ] Token decoding accurate
- [ ] User resolution correct
- [ ] Audit trail complete

---

## 🚨 CRITICAL REMINDERS

### What This System DOES:
1. ✅ Prevent casual content sharing
2. ✅ Stop URL hotlinking
3. ✅ Trace leaks after they happen
4. ✅ Deter abuse through accountability

### What This System DOES NOT:
1. ❌ Stop determined pirates
2. ❌ Prevent screenshot/screen recording
3. ❌ Guarantee zero leakage
4. ❌ Replace legal enforcement

### Legal Disclaimer:
> Content protection is a business risk mitigation strategy,  
> not a perfect technical solution.  
> Focus on user experience and deterrence,  
> not an arms race with determined attackers.

---

## ✅ DEFINITION OF DONE

- [ ] All tests passing
- [ ] Signed URLs working
- [ ] Leak tokens pseudonymous
- [ ] Forensic tools functional
- [ ] NO text selection blocking
- [ ] NO right-click blocking
- [ ] NO font scrambling
- [ ] Accessibility validated
- [ ] Documentation complete
