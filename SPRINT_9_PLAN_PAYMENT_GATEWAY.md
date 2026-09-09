# SPRINT 9 — Early-access Paywall và Payment Gateway
**Timeline:** 10–15 ngày  
**Mục tiêu:** Early-access unlock policy + production payment gateway (MoMo/VNPAY)

---

## 🎯 ACCEPTANCE CRITERIA

✅ `unlockPolicy`: PERMANENT_PAID | EARLY_ACCESS  
✅ `freeAt` hoặc `paidWindowDays` cho early access  
✅ Access resolver tự trả free khi `now >= freeAt`  
✅ Purchase vẫn vĩnh viễn và giữ snapshot giá  
✅ Payment gateway abstraction (provider registry)  
✅ Production provider (MoMo hoặc VNPAY)  
✅ Webhook verification + replay protection  
✅ Reconciliation và refund mapping  
✅ Rollout theo story allowlist  

---

## 📊 PHÂN TÍCH HIỆN TẠI

### Chapter Monetization hiện có:
- `ChapterPricing` với `accessType`: FREE/PAID
- `ChapterEntitlement` tracking purchases
- `priceCredits` field
- Entitlement check trong chapter reader

### Payment System:
- Credit-based internal currency
- No production payment gateway yet
- Need external payment integration

### Thiếu:
- ❌ Early-access unlock policy
- ❌ Time-based free unlock
- ❌ Payment gateway abstraction
- ❌ Production providers
- ❌ Webhook infrastructure
- ❌ Reconciliation system

---

## 🏗️ TECHNICAL DESIGN

### 1. Database Schema Changes

```prisma
enum UnlockPolicy {
  PERMANENT_PAID  @map("permanent_paid")  // Always paid
  EARLY_ACCESS    @map("early_access")    // Paid initially, free later
  
  @@map("unlock_policy")
}

enum PaymentProvider {
  MOMO      @map("momo")
  VNPAY     @map("vnpay")
  ZALOPAY   @map("zalopay")
  VIETQR    @map("vietqr")     // Not recommended without reconciliation API
  INTERNAL  @map("internal")   // Credits
  
  @@map("payment_provider")
}

enum PaymentStatus {
  PENDING    @map("pending")
  PROCESSING @map("processing")
  COMPLETED  @map("completed")
  FAILED     @map("failed")
  CANCELLED  @map("cancelled")
  REFUNDED   @map("refunded")
  
  @@map("payment_status")
}

model ChapterPricing {
  // ... existing fields ...
  
  // NEW: Unlock policy
  unlockPolicy      UnlockPolicy  @default(PERMANENT_PAID) @map("unlock_policy")
  
  // Early access settings
  freeAt            DateTime?     @map("free_at") @db.Timestamptz(3)
  paidWindowDays    Int?          @map("paid_window_days")
  
  // Price snapshot (keep even after free)
  originalPriceCredits Decimal?   @map("original_price_credits") @db.Decimal(10, 2)
}

model PaymentTransaction {
  id                String          @id @default(uuid()) @db.Uuid
  userId            String          @map("user_id") @db.Uuid
  
  // Payment provider
  provider          PaymentProvider
  providerTxnId     String?         @unique @map("provider_txn_id") @db.VarChar(255)
  
  // Amount
  amountVnd         Decimal         @map("amount_vnd") @db.Decimal(12, 2)
  creditAmount      Decimal         @map("credit_amount") @db.Decimal(10, 2)
  
  // Status
  status            PaymentStatus   @default(PENDING)
  
  // Provider-specific data
  providerData      Json?           @map("provider_data")
  providerResponse  Json?           @map("provider_response")
  
  // Metadata
  description       String?         @db.VarChar(500)
  ipAddress         String?         @map("ip_address") @db.VarChar(45)
  userAgent         String?         @map("user_agent") @db.Text
  
  // Lifecycle
  initiatedAt       DateTime        @default(now()) @map("initiated_at") @db.Timestamptz(3)
  completedAt       DateTime?       @map("completed_at") @db.Timestamptz(3)
  failedAt          DateTime?       @map("failed_at") @db.Timestamptz(3)
  failureReason     String?         @map("failure_reason") @db.Text
  
  // Reconciliation
  reconciledAt      DateTime?       @map("reconciled_at") @db.Timestamptz(3)
  
  createdAt         DateTime        @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt         DateTime        @updatedAt @map("updated_at") @db.Timestamptz(3)
  
  user User @relation(fields: [userId], references: [id])
  
  @@index([userId, status, createdAt])
  @@index([provider, providerTxnId])
  @@index([status, createdAt])
  @@map("payment_transactions")
}

model PaymentWebhook {
  id                String    @id @default(uuid()) @db.Uuid
  provider          PaymentProvider
  
  // Webhook data
  signature         String    @db.Text
  payload           Json
  
  // Processing
  processed         Boolean   @default(false)
  processedAt       DateTime? @map("processed_at") @db.Timestamptz(3)
  
  // Idempotency
  idempotencyKey    String?   @unique @map("idempotency_key") @db.VarChar(255)
  
  // Result
  transactionId     String?   @map("transaction_id") @db.Uuid
  success           Boolean?
  errorMessage      String?   @map("error_message") @db.Text
  
  receivedAt        DateTime  @default(now()) @map("received_at") @db.Timestamptz(3)
  
  @@index([provider, processed])
  @@index([receivedAt])
  @@map("payment_webhooks")
}

model PaymentRefund {
  id                String    @id @default(uuid()) @db.Uuid
  transactionId     String    @map("transaction_id") @db.Uuid
  
  // Refund details
  amountVnd         Decimal   @map("amount_vnd") @db.Decimal(12, 2)
  creditAmount      Decimal   @map("credit_amount") @db.Decimal(10, 2)
  reason            String    @db.Text
  
  // Provider refund
  providerRefundId  String?   @map("provider_refund_id") @db.VarChar(255)
  providerResponse  Json?     @map("provider_response")
  
  // Status
  status            String    @db.VarChar(20)  // PENDING, COMPLETED, FAILED
  
  initiatedBy       String    @map("initiated_by") @db.Uuid
  completedAt       DateTime? @map("completed_at") @db.Timestamptz(3)
  
  createdAt         DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)
  
  transaction PaymentTransaction @relation(fields: [transactionId], references: [id])
  initiator   User               @relation(fields: [initiatedBy], references: [id])
  
  @@index([transactionId])
  @@map("payment_refunds")
}

model StoryPaymentAllowlist {
  storyId     String   @id @map("story_id") @db.Uuid
  
  // Gateway config
  enabledProviders PaymentProvider[]  @default([]) @map("enabled_providers")
  
  // Rollout control
  isEnabled   Boolean  @default(false) @map("is_enabled")
  enabledAt   DateTime? @map("enabled_at") @db.Timestamptz(3)
  enabledBy   String?  @map("enabled_by") @db.Uuid
  
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  
  story Story @relation(fields: [storyId], references: [id], onDelete: Cascade)
  
  @@map("story_payment_allowlists")
}

// Add relations
model User {
  // ... existing fields ...
  paymentTransactions PaymentTransaction[]
  paymentRefunds      PaymentRefund[]
}

model Story {
  // ... existing fields ...
  paymentAllowlist StoryPaymentAllowlist?
}

model PaymentTransaction {
  // ... existing fields ...
  refunds PaymentRefund[]
}
```

---

### 2. Early Access Unlock Logic (2 ngày)

**Task 2.1: Access Resolver Enhancement**

**File:** `backend/src/modules/chapters/domain/policies/chapter-access.policy.ts`

```typescript
export class ChapterAccessPolicy {
  static readonly EARLY_ACCESS_GRACE_PERIOD_HOURS = 24;
  
  static resolveAccess(
    pricing: ChapterPricingDto,
    entitlement: ChapterEntitlementDto | null,
    currentTime: Date = new Date(),
  ): ChapterAccessResult {
    // 1. FREE chapters always accessible
    if (pricing.accessType === 'FREE') {
      return { state: 'FREE', allowed: true };
    }
    
    // 2. AUTHOR_ONLY never accessible to regular users
    if (pricing.accessType === 'AUTHOR_ONLY') {
      return { state: 'LOCKED', allowed: false, reason: 'Author only' };
    }
    
    // 3. PAID chapters - check unlock policy
    if (pricing.accessType === 'PAID') {
      // 3a. Check if early access period ended
      if (pricing.unlockPolicy === 'EARLY_ACCESS') {
        if (this.isEarlyAccessEnded(pricing, currentTime)) {
          return {
            state: 'FREE',
            allowed: true,
            reason: 'Early access period ended',
            wasEarlyAccess: true,
          };
        }
      }
      
      // 3b. Check entitlement
      if (entitlement && entitlement.status === 'ACTIVE') {
        // Check expiry
        if (entitlement.expiresAt && entitlement.expiresAt < currentTime) {
          return {
            state: 'LOCKED',
            allowed: false,
            reason: 'Entitlement expired',
            priceCredits: pricing.priceCredits,
          };
        }
        
        return {
          state: 'ENTITLED',
          allowed: true,
          purchasedAt: entitlement.purchasedAt,
        };
      }
      
      // 3c. No entitlement and still in paid window
      return {
        state: 'LOCKED',
        allowed: false,
        priceCredits: pricing.priceCredits,
        unlockPolicy: pricing.unlockPolicy,
        freeAt: pricing.freeAt,
      };
    }
    
    // Fallback
    return { state: 'LOCKED', allowed: false };
  }
  
  private static isEarlyAccessEnded(
    pricing: ChapterPricingDto,
    currentTime: Date,
  ): boolean {
    // Check explicit freeAt timestamp
    if (pricing.freeAt) {
      return currentTime >= pricing.freeAt;
    }
    
    // Calculate from paidWindowDays + chapter publishedAt
    if (pricing.paidWindowDays && pricing.publishedAt) {
      const freeAt = new Date(pricing.publishedAt);
      freeAt.setDate(freeAt.getDate() + pricing.paidWindowDays);
      
      return currentTime >= freeAt;
    }
    
    // No early access configured
    return false;
  }
  
  static calculateFreeAt(
    publishedAt: Date,
    paidWindowDays: number,
  ): Date {
    const freeAt = new Date(publishedAt);
    freeAt.setDate(freeAt.getDate() + paidWindowDays);
    return freeAt;
  }
}

export interface ChapterAccessResult {
  state: 'FREE' | 'ENTITLED' | 'LOCKED' | 'BYPASS';
  allowed: boolean;
  reason?: string;
  priceCredits?: string;
  purchasedAt?: Date;
  freeAt?: Date;
  unlockPolicy?: string;
  wasEarlyAccess?: boolean;
}
```

**Task 2.2: Set Early Access Command**

**File:** `backend/src/modules/chapters/application/commands/set-chapter-early-access/set-chapter-early-access.command-handler.ts`

```typescript
@Injectable()
export class SetChapterEarlyAccessCommandHandler {
  constructor(
    @Inject(CHAPTER_PRICING_PORT)
    private readonly pricingPort: ChapterPricingPort,
    private readonly logger: Logger,
  ) {}
  
  async execute(command: SetChapterEarlyAccessCommand): Promise<void> {
    // 1. Get current pricing
    const pricing = await this.pricingPort.findByChapter(command.chapterId);
    
    if (!pricing) {
      throw new ResourceNotFoundException('ChapterPricing', command.chapterId);
    }
    
    // 2. Verify it's a paid chapter
    if (pricing.accessType !== 'PAID') {
      throw new InvalidInputException('Only paid chapters can have early access');
    }
    
    // 3. Calculate freeAt if using paidWindowDays
    let freeAt: Date | null = null;
    
    if (command.paidWindowDays) {
      const chapter = await this.pricingPort.getChapter(command.chapterId);
      
      if (!chapter.publishedAt) {
        throw new InvalidInputException('Chapter must be published to calculate freeAt');
      }
      
      freeAt = ChapterAccessPolicy.calculateFreeAt(
        chapter.publishedAt,
        command.paidWindowDays,
      );
    } else if (command.freeAt) {
      freeAt = command.freeAt;
    }
    
    // 4. Update pricing
    await this.pricingPort.update({
      chapterId: command.chapterId,
      unlockPolicy: 'EARLY_ACCESS',
      freeAt,
      paidWindowDays: command.paidWindowDays,
      originalPriceCredits: pricing.priceCredits,
    });
    
    this.logger.log({
      message: 'Chapter early access configured',
      chapterId: command.chapterId,
      freeAt,
      paidWindowDays: command.paidWindowDays,
    });
  }
}
```

---

### 3. Payment Gateway Abstraction (3 ngày)

**Task 3.1: Payment Provider Port**

**File:** `backend/src/modules/payment/application/ports/payment-provider.port.ts`

```typescript
export const PAYMENT_PROVIDER_PORT = Symbol.for('modules.payment.provider');

export interface CreatePaymentInput {
  readonly userId: string;
  readonly amountVnd: number;
  readonly creditAmount: number;
  readonly description: string;
  readonly returnUrl: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
}

export interface CreatePaymentResult {
  readonly transactionId: string;
  readonly paymentUrl: string;
  readonly providerTxnId: string;
  readonly expiresAt: Date;
}

export interface VerifyWebhookInput {
  readonly signature: string;
  readonly payload: any;
  readonly headers: Record<string, string>;
}

export interface VerifyWebhookResult {
  readonly valid: boolean;
  readonly providerTxnId?: string;
  readonly status?: string;
  readonly amount?: number;
}

export interface RefundPaymentInput {
  readonly transactionId: string;
  readonly reason: string;
  readonly initiatedBy: string;
}

export interface RefundPaymentResult {
  readonly providerRefundId: string;
  readonly status: string;
}

export interface PaymentProviderPort {
  readonly name: string;
  readonly enabled: boolean;
  
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  
  verifyWebhook(input: VerifyWebhookInput): Promise<VerifyWebhookResult>;
  
  refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult>;
  
  reconcile(date: Date): Promise<ReconciliationResult>;
}

export interface ReconciliationResult {
  readonly matched: number;
  readonly unmatched: number;
  readonly discrepancies: readonly Discrepancy[];
}

export interface Discrepancy {
  readonly providerTxnId: string;
  readonly type: 'missing_local' | 'missing_provider' | 'amount_mismatch' | 'status_mismatch';
  readonly details: Record<string, unknown>;
}
```

**Task 3.2: MoMo Provider Implementation**

**File:** `backend/src/modules/payment/infrastructure/providers/momo-payment.provider.ts`

```typescript
@Injectable()
export class MomoPaymentProvider implements PaymentProviderPort {
  readonly name = 'MoMo';
  readonly enabled: boolean;
  
  private readonly partnerCode: string;
  private readonly accessKey: string;
  private readonly secretKey: string;
  private readonly endpoint: string;
  
  constructor(private readonly config: ConfigService) {
    this.partnerCode = this.config.get('momo.partnerCode', '');
    this.accessKey = this.config.get('momo.accessKey', '');
    this.secretKey = this.config.get('momo.secretKey', '');
    this.endpoint = this.config.get('momo.endpoint', 'https://test-payment.momo.vn');
    this.enabled = !!this.partnerCode && !!this.secretKey;
  }
  
  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const orderId = `${input.userId}_${Date.now()}`;
    const requestId = `${orderId}_${Math.random().toString(36).slice(2)}`;
    
    const rawSignature = `accessKey=${this.accessKey}&amount=${input.amountVnd}&extraData=&ipnUrl=${this.config.get('momo.ipnUrl')}&orderId=${orderId}&orderInfo=${input.description}&partnerCode=${this.partnerCode}&redirectUrl=${input.returnUrl}&requestId=${requestId}&requestType=captureWallet`;
    
    const signature = createHmac('sha256', this.secretKey)
      .update(rawSignature)
      .digest('hex');
    
    const requestBody = {
      partnerCode: this.partnerCode,
      accessKey: this.accessKey,
      requestId,
      amount: input.amountVnd,
      orderId,
      orderInfo: input.description,
      redirectUrl: input.returnUrl,
      ipnUrl: this.config.get('momo.ipnUrl'),
      extraData: '',
      requestType: 'captureWallet',
      signature,
      lang: 'vi',
    };
    
    try {
      const response = await firstValueFrom(
        this.http.post(`${this.endpoint}/v2/gateway/api/create`, requestBody)
      );
      
      if (response.data.resultCode !== 0) {
        throw new PaymentException(
          `MoMo payment creation failed: ${response.data.message}`
        );
      }
      
      return {
        transactionId: input.userId, // Will be replaced with actual DB ID
        paymentUrl: response.data.payUrl,
        providerTxnId: orderId,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      };
    } catch (error) {
      throw new PaymentException(`MoMo API error: ${error.message}`);
    }
  }
  
  async verifyWebhook(input: VerifyWebhookInput): Promise<VerifyWebhookResult> {
    const payload = input.payload;
    
    // Verify signature
    const rawSignature = `accessKey=${this.accessKey}&amount=${payload.amount}&extraData=${payload.extraData}&message=${payload.message}&orderId=${payload.orderId}&orderInfo=${payload.orderInfo}&orderType=${payload.orderType}&partnerCode=${this.partnerCode}&payType=${payload.payType}&requestId=${payload.requestId}&responseTime=${payload.responseTime}&resultCode=${payload.resultCode}&transId=${payload.transId}`;
    
    const expectedSignature = createHmac('sha256', this.secretKey)
      .update(rawSignature)
      .digest('hex');
    
    if (payload.signature !== expectedSignature) {
      return { valid: false };
    }
    
    // Map result code to status
    let status: string;
    if (payload.resultCode === 0) {
      status = 'COMPLETED';
    } else if (payload.resultCode === 1006) {
      status = 'CANCELLED';
    } else {
      status = 'FAILED';
    }
    
    return {
      valid: true,
      providerTxnId: payload.orderId,
      status,
      amount: payload.amount,
    };
  }
  
  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult> {
    // MoMo refund API implementation
    const requestId = `refund_${Date.now()}`;
    
    // Get original transaction
    const transaction = await this.getTransaction(input.transactionId);
    
    const rawSignature = `accessKey=${this.accessKey}&amount=${transaction.amountVnd}&description=${input.reason}&orderId=${transaction.providerTxnId}&partnerCode=${this.partnerCode}&requestId=${requestId}&transId=${transaction.providerResponse?.transId}`;
    
    const signature = createHmac('sha256', this.secretKey)
      .update(rawSignature)
      .digest('hex');
    
    const requestBody = {
      partnerCode: this.partnerCode,
      accessKey: this.accessKey,
      requestId,
      amount: transaction.amountVnd,
      orderId: transaction.providerTxnId,
      transId: transaction.providerResponse?.transId,
      description: input.reason,
      signature,
    };
    
    const response = await firstValueFrom(
      this.http.post(`${this.endpoint}/v2/gateway/api/refund`, requestBody)
    );
    
    if (response.data.resultCode !== 0) {
      throw new PaymentException(`MoMo refund failed: ${response.data.message}`);
    }
    
    return {
      providerRefundId: response.data.transId,
      status: 'COMPLETED',
    };
  }
  
  async reconcile(date: Date): Promise<ReconciliationResult> {
    // Daily reconciliation with MoMo
    // Implementation depends on MoMo's reconciliation API
    throw new Error('Reconciliation not implemented for MoMo');
  }
  
  private async getTransaction(transactionId: string): Promise<any> {
    // Fetch from database
    return {};
  }
}
```

**Task 3.3: VNPAY Provider Implementation**

**File:** `backend/src/modules/payment/infrastructure/providers/vnpay-payment.provider.ts`

```typescript
@Injectable()
export class VnpayPaymentProvider implements PaymentProviderPort {
  readonly name = 'VNPAY';
  readonly enabled: boolean;
  
  private readonly tmnCode: string;
  private readonly hashSecret: string;
  private readonly endpoint: string;
  
  constructor(private readonly config: ConfigService) {
    this.tmnCode = this.config.get('vnpay.tmnCode', '');
    this.hashSecret = this.config.get('vnpay.hashSecret', '');
    this.endpoint = this.config.get('vnpay.endpoint', 'https://sandbox.vnpayment.vn');
    this.enabled = !!this.tmnCode && !!this.hashSecret;
  }
  
  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const txnRef = `${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
    const createDate = format(new Date(), 'yyyyMMddHHmmss');
    
    const params = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: this.tmnCode,
      vnp_Amount: (input.amountVnd * 100).toString(), // VNPay uses cents
      vnp_CurrCode: 'VND',
      vnp_TxnRef: txnRef,
      vnp_OrderInfo: input.description,
      vnp_OrderType: 'other',
      vnp_Locale: 'vn',
      vnp_ReturnUrl: input.returnUrl,
      vnp_IpAddr: input.ipAddress || '127.0.0.1',
      vnp_CreateDate: createDate,
    };
    
    // Sort params and create signature
    const sortedParams = this.sortObject(params);
    const signData = new URLSearchParams(sortedParams).toString();
    const secureHash = createHmac('sha512', this.hashSecret)
      .update(signData)
      .digest('hex');
    
    const paymentUrl = `${this.endpoint}/paymentv2/vpcpay.html?${signData}&vnp_SecureHash=${secureHash}`;
    
    return {
      transactionId: input.userId, // Placeholder
      paymentUrl,
      providerTxnId: txnRef,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };
  }
  
  async verifyWebhook(input: VerifyWebhookInput): Promise<VerifyWebhookResult> {
    const params = { ...input.payload };
    const secureHash = params.vnp_SecureHash;
    delete params.vnp_SecureHash;
    delete params.vnp_SecureHashType;
    
    const sortedParams = this.sortObject(params);
    const signData = new URLSearchParams(sortedParams).toString();
    const expectedHash = createHmac('sha512', this.hashSecret)
      .update(signData)
      .digest('hex');
    
    if (secureHash !== expectedHash) {
      return { valid: false };
    }
    
    let status: string;
    if (params.vnp_ResponseCode === '00') {
      status = 'COMPLETED';
    } else if (params.vnp_ResponseCode === '24') {
      status = 'CANCELLED';
    } else {
      status = 'FAILED';
    }
    
    return {
      valid: true,
      providerTxnId: params.vnp_TxnRef,
      status,
      amount: parseInt(params.vnp_Amount) / 100,
    };
  }
  
  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult> {
    // VNPAY refund implementation
    throw new Error('Refund not implemented for VNPAY');
  }
  
  async reconcile(date: Date): Promise<ReconciliationResult> {
    // VNPAY reconciliation
    throw new Error('Reconciliation not implemented for VNPAY');
  }
  
  private sortObject(obj: Record<string, string>): Record<string, string> {
    const sorted: Record<string, string> = {};
    Object.keys(obj).sort().forEach(key => {
      sorted[key] = obj[key];
    });
    return sorted;
  }
}
```

---

### 4. Webhook & Reconciliation (2 ngày)

**Task 4.1: Webhook Handler**

**File:** `backend/src/modules/payment/infrastructure/webhooks/payment-webhook.controller.ts`

```typescript
@Controller('webhooks/payment')
export class PaymentWebhookController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly logger: Logger,
  ) {}
  
  @Post('momo')
  async handleMomoWebhook(
    @Body() payload: any,
    @Headers() headers: Record<string, string>,
    @Ip() ip: string,
  ): Promise<any> {
    this.logger.log({
      message: 'MoMo webhook received',
      orderId: payload.orderId,
      ip,
    });
    
    try {
      const command = new ProcessPaymentWebhookCommand(
        'MOMO',
        payload,
        headers,
        ip,
      );
      
      await this.commandBus.execute(command);
      
      // MoMo expects 204 No Content
      return { statusCode: 204 };
    } catch (error) {
      this.logger.error('MoMo webhook processing failed', error);
      return { statusCode: 500 };
    }
  }
  
  @Get('vnpay')
  async handleVnpayWebhook(
    @Query() query: any,
    @Ip() ip: string,
  ): Promise<any> {
    this.logger.log({
      message: 'VNPAY webhook received',
      txnRef: query.vnp_TxnRef,
      ip,
    });
    
    try {
      const command = new ProcessPaymentWebhookCommand(
        'VNPAY',
        query,
        {},
        ip,
      );
      
      await this.commandBus.execute(command);
      
      // VNPAY expects specific response
      return {
        RspCode: '00',
        Message: 'Confirm Success',
      };
    } catch (error) {
      this.logger.error('VNPAY webhook processing failed', error);
      return {
        RspCode: '99',
        Message: 'Unknown error',
      };
    }
  }
}
```

**Task 4.2: Webhook Processor**

**File:** `backend/src/modules/payment/application/commands/process-payment-webhook/process-payment-webhook.command-handler.ts`

```typescript
@Injectable()
export class ProcessPaymentWebhookCommandHandler {
  constructor(
    @Inject(PAYMENT_PROVIDER_REGISTRY_PORT)
    private readonly providerRegistry: PaymentProviderRegistryPort,
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
    private readonly logger: Logger,
  ) {}
  
  async execute(command: ProcessPaymentWebhookCommand): Promise<void> {
    // 1. Get provider
    const provider = this.providerRegistry.getProvider(command.provider);
    
    // 2. Store webhook (idempotency)
    const idempotencyKey = this.generateIdempotencyKey(command);
    
    const existingWebhook = await this.prisma.paymentWebhook.findUnique({
      where: { idempotencyKey },
    });
    
    if (existingWebhook && existingWebhook.processed) {
      this.logger.log('Webhook already processed (idempotent)', { idempotencyKey });
      return;
    }
    
    const webhook = await this.prisma.paymentWebhook.create({
      data: {
        provider: command.provider,
        signature: command.headers['x-signature'] || '',
        payload: command.payload,
        idempotencyKey,
      },
    });
    
    try {
      // 3. Verify webhook signature
      const verification = await provider.verifyWebhook({
        signature: command.headers['x-signature'] || '',
        payload: command.payload,
        headers: command.headers,
      });
      
      if (!verification.valid) {
        throw new PaymentWebhookException('Invalid webhook signature');
      }
      
      // 4. Find transaction
      const transaction = await this.prisma.paymentTransaction.findUnique({
        where: { providerTxnId: verification.providerTxnId },
      });
      
      if (!transaction) {
        this.logger.warn('Transaction not found for webhook', {
          providerTxnId: verification.providerTxnId,
        });
        
        await this.prisma.paymentWebhook.update({
          where: { id: webhook.id },
          data: {
            processed: true,
            processedAt: new Date(),
            success: false,
            errorMessage: 'Transaction not found',
          },
        });
        
        return;
      }
      
      // 5. Update transaction status
      await this.prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          status: verification.status as PaymentStatus,
          providerResponse: command.payload,
          completedAt: verification.status === 'COMPLETED' ? new Date() : undefined,
          failedAt: verification.status === 'FAILED' ? new Date() : undefined,
          reconciledAt: new Date(),
        },
      });
      
      // 6. Mark webhook processed
      await this.prisma.paymentWebhook.update({
        where: { id: webhook.id },
        data: {
          processed: true,
          processedAt: new Date(),
          transactionId: transaction.id,
          success: true,
        },
      });
      
      // 7. Publish event
      if (verification.status === 'COMPLETED') {
        this.eventBus.publish(new PaymentCompletedEvent({
          transactionId: transaction.id,
          userId: transaction.userId,
          creditAmount: transaction.creditAmount,
        }));
      }
      
      this.logger.log({
        message: 'Webhook processed successfully',
        transactionId: transaction.id,
        status: verification.status,
      });
      
    } catch (error) {
      this.logger.error('Webhook processing failed', error);
      
      await this.prisma.paymentWebhook.update({
        where: { id: webhook.id },
        data: {
          processed: true,
          processedAt: new Date(),
          success: false,
          errorMessage: error.message,
        },
      });
      
      throw error;
    }
  }
  
  private generateIdempotencyKey(command: ProcessPaymentWebhookCommand): string {
    const data = JSON.stringify({
      provider: command.provider,
      payload: command.payload,
    });
    
    return createHash('sha256').update(data).digest('hex');
  }
}
```

---

## 📝 IMPLEMENTATION ORDER

### Day 1-2: Early Access Logic
- [ ] Database migration
- [ ] Access resolver enhancement
- [ ] Set early access command
- [ ] Tests

### Day 3-5: Payment Gateway Abstraction
- [ ] Provider port interface
- [ ] MoMo provider implementation
- [ ] VNPAY provider implementation
- [ ] Provider registry
- [ ] Tests

### Day 6-7: Transaction Management
- [ ] Create payment command
- [ ] Transaction lifecycle
- [ ] Status tracking
- [ ] Tests

### Day 8-9: Webhook & Reconciliation
- [ ] Webhook controller
- [ ] Webhook processor
- [ ] Signature verification
- [ ] Idempotency
- [ ] Replay protection
- [ ] Tests

### Day 10-11: Refund System
- [ ] Refund command
- [ ] Provider refund integration
- [ ] Refund tracking
- [ ] Tests

### Day 12-13: Rollout Control
- [ ] Story allowlist
- [ ] Provider enable/disable
- [ ] Admin UI
- [ ] Tests

### Day 14-15: Integration & Polish
- [ ] Frontend integration
- [ ] E2E payment flow
- [ ] Documentation

---

## 🧪 TESTING STRATEGY

### Functional Tests
- [ ] Early access unlock at correct time
- [ ] Payment creation
- [ ] Webhook processing
- [ ] Refund flow

### Security Tests
- [ ] Webhook signature verification
- [ ] Replay attack prevention
- [ ] Idempotency enforcement

### Integration Tests
- [ ] Full payment flow with sandbox
- [ ] Reconciliation accuracy

---

## ✅ DEFINITION OF DONE

- [ ] All tests passing
- [ ] Early access working
- [ ] MoMo or VNPAY integrated
- [ ] Webhooks verified
- [ ] Replay protection working
- [ ] Reconciliation functional
- [ ] Rollout controls working
- [ ] Documentation complete
