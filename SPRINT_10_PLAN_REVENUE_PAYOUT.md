# SPRINT 10 — Revenue Share và Payout
**Timeline:** 12–18 ngày  
**Mục tiêu:** Financial subledger với revenue allocation, author earnings và payout system

---

## 🎯 ACCEPTANCE CRITERIA

✅ Financial subledger riêng (không tính từ analytics)  
✅ RevenueShareAgreement với versioning  
✅ RevenueAllocation snapshot tại purchase  
✅ AuthorEarningLedger tracking  
✅ PayoutAccount, PayoutRequest, PayoutBatch  
✅ Status flow: PENDING → AVAILABLE → RESERVED → PAID/FAILED  
✅ Refund tạo compensating allocation  
✅ Settlement delay trước khi rút  
✅ Tổng allocation = revenue phân phối  
✅ KYC, minimum payout, phí và thuế policy  

---

## 📊 PHÂN TÍCH

### Hiện tại:
- `ChapterPurchase` tracking purchases
- `WalletTransaction` cho credit movements
- Analytics dashboard (không phải financial ledger)

### Nguyên tắc Financial Subledger:
- **Immutable ledger** - không sửa, chỉ compensate
- **Double-entry** - mọi transaction phải balance
- **Audit trail** - log mọi thay đổi
- **Reconciliation** - phải khớp với payment gateway

### Thiếu:
- ❌ Revenue share agreements
- ❌ Allocation tracking
- ❌ Author earnings ledger
- ❌ Payout infrastructure
- ❌ KYC system
- ❌ Tax handling

---

## 🏗️ TECHNICAL DESIGN

### 1. Database Schema Changes

```prisma
enum RevenueShareType {
  AUTHOR_SHARE    @map("author_share")
  PLATFORM_FEE    @map("platform_fee")
  CONTRIBUTOR     @map("contributor")
  
  @@map("revenue_share_type")
}

enum AllocationStatus {
  PENDING     @map("pending")
  SETTLED     @map("settled")
  REFUNDED    @map("refunded")
  
  @@map("allocation_status")
}

enum EarningStatus {
  PENDING     @map("pending")      // Chưa đủ settlement delay
  AVAILABLE   @map("available")    // Có thể rút
  RESERVED    @map("reserved")     // Đang trong payout request
  PAID        @map("paid")         // Đã trả
  
  @@map("earning_status")
}

enum PayoutStatus {
  PENDING     @map("pending")
  PROCESSING  @map("processing")
  COMPLETED   @map("completed")
  FAILED      @map("failed")
  CANCELLED   @map("cancelled")
  
  @@map("payout_status")
}

enum PayoutMethod {
  BANK_TRANSFER   @map("bank_transfer")
  MOMO            @map("momo")
  ZALOPAY         @map("zalopay")
  
  @@map("payout_method")
}

model RevenueShareAgreement {
  id              String    @id @default(uuid()) @db.Uuid
  storyId         String    @map("story_id") @db.Uuid
  version         Int       @default(1)
  
  // Share breakdown
  authorUserId    String    @map("author_user_id") @db.Uuid
  authorShare     Decimal   @map("author_share") @db.Decimal(5, 4)  // 0.7000 = 70%
  platformFee     Decimal   @map("platform_fee") @db.Decimal(5, 4)  // 0.3000 = 30%
  
  // Contributors (optional)
  contributorShares Json?   @map("contributor_shares")  // [{userId, share}]
  
  // Validity
  effectiveFrom   DateTime  @map("effective_from") @db.Timestamptz(3)
  effectiveTo     DateTime? @map("effective_to") @db.Timestamptz(3)
  
  // Audit
  createdBy       String    @map("created_by") @db.Uuid
  approvedBy      String?   @map("approved_by") @db.Uuid
  approvedAt      DateTime? @map("approved_at") @db.Timestamptz(3)
  
  createdAt       DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)
  
  story   Story @relation(fields: [storyId], references: [id], onDelete: Cascade)
  author  User  @relation("AgreementAuthor", fields: [authorUserId], references: [id])
  creator User  @relation("AgreementCreator", fields: [createdBy], references: [id])
  
  @@unique([storyId, version])
  @@index([storyId, effectiveFrom, effectiveTo])
  @@map("revenue_share_agreements")
}

model RevenueAllocation {
  id              String            @id @default(uuid()) @db.Uuid
  
  // Source transaction
  purchaseId      String            @map("purchase_id") @db.Uuid
  agreementId     String            @map("agreement_id") @db.Uuid
  
  // Allocation details
  recipientUserId String            @map("recipient_user_id") @db.Uuid
  allocationType  RevenueShareType  @map("allocation_type")
  
  // Amounts (snapshot at purchase time)
  grossAmount     Decimal           @map("gross_amount") @db.Decimal(12, 2)      // Total purchase
  sharePercent    Decimal           @map("share_percent") @db.Decimal(5, 4)      // 0.7000
  netAmount       Decimal           @map("net_amount") @db.Decimal(12, 2)        // Amount allocated
  
  // Status
  status          AllocationStatus  @default(PENDING)
  settledAt       DateTime?         @map("settled_at") @db.Timestamptz(3)
  
  // Refund handling
  isRefund        Boolean           @default(false) @map("is_refund")
  refundsAllocationId String?       @unique @map("refunds_allocation_id") @db.Uuid
  refundedBy      String?           @map("refunded_by") @db.Uuid  // AllocationId that refunded this
  
  createdAt       DateTime          @default(now()) @map("created_at") @db.Timestamptz(3)
  
  purchase  ChapterPurchase         @relation(fields: [purchaseId], references: [id])
  agreement RevenueShareAgreement   @relation(fields: [agreementId], references: [id])
  recipient User                    @relation("RevenueAllocations", fields: [recipientUserId], references: [id])
  refundsAllocation RevenueAllocation? @relation("RefundRelation", fields: [refundsAllocationId], references: [id])
  refundedByAllocation RevenueAllocation? @relation("RefundRelation")
  
  @@index([purchaseId])
  @@index([recipientUserId, status, settledAt])
  @@index([agreementId])
  @@map("revenue_allocations")
}

model AuthorEarningLedger {
  id              String          @id @default(uuid()) @db.Uuid
  userId          String          @map("user_id") @db.Uuid
  allocationId    String          @map("allocation_id") @db.Uuid
  
  // Earning details
  amount          Decimal         @db.Decimal(12, 2)
  status          EarningStatus   @default(PENDING)
  
  // Settlement
  settlementDate  DateTime        @map("settlement_date") @db.Timestamptz(3)  // When becomes AVAILABLE
  availableAt     DateTime?       @map("available_at") @db.Timestamptz(3)
  
  // Payout
  payoutRequestId String?         @map("payout_request_id") @db.Uuid
  reservedAt      DateTime?       @map("reserved_at") @db.Timestamptz(3)
  paidAt          DateTime?       @map("paid_at") @db.Timestamptz(3)
  
  createdAt       DateTime        @default(now()) @map("created_at") @db.Timestamptz(3)
  
  user       User                 @relation(fields: [userId], references: [id])
  allocation RevenueAllocation    @relation(fields: [allocationId], references: [id])
  payoutRequest PayoutRequest?    @relation(fields: [payoutRequestId], references: [id])
  
  @@index([userId, status, availableAt])
  @@index([allocationId])
  @@index([payoutRequestId])
  @@map("author_earning_ledger")
}

model PayoutAccount {
  id              String        @id @default(uuid()) @db.Uuid
  userId          String        @map("user_id") @db.Uuid
  
  // Payout method
  method          PayoutMethod
  
  // Bank transfer details
  bankName        String?       @map("bank_name") @db.VarChar(255)
  bankBranch      String?       @map("bank_branch") @db.VarChar(255)
  accountNumber   String?       @map("account_number") @db.VarChar(50)
  accountName     String?       @map("account_name") @db.VarChar(255)
  
  // E-wallet details
  walletPhone     String?       @map("wallet_phone") @db.VarChar(20)
  walletName      String?       @map("wallet_name") @db.VarChar(255)
  
  // KYC
  isVerified      Boolean       @default(false) @map("is_verified")
  verifiedAt      DateTime?     @map("verified_at") @db.Timestamptz(3)
  verifiedBy      String?       @map("verified_by") @db.Uuid
  kycDocuments    Json?         @map("kyc_documents")
  
  // Status
  isActive        Boolean       @default(true) @map("is_active")
  isPrimary       Boolean       @default(false) @map("is_primary")
  
  createdAt       DateTime      @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt       DateTime      @updatedAt @map("updated_at") @db.Timestamptz(3)
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  payoutRequests PayoutRequest[]
  
  @@index([userId, isActive])
  @@map("payout_accounts")
}

model PayoutRequest {
  id              String        @id @default(uuid()) @db.Uuid
  userId          String        @map("user_id") @db.Uuid
  accountId       String        @map("account_id") @db.Uuid
  
  // Amount
  grossAmount     Decimal       @map("gross_amount") @db.Decimal(12, 2)
  feeAmount       Decimal       @map("fee_amount") @db.Decimal(12, 2)
  taxAmount       Decimal       @map("tax_amount") @db.Decimal(12, 2)
  netAmount       Decimal       @map("net_amount") @db.Decimal(12, 2)
  
  // Status
  status          PayoutStatus  @default(PENDING)
  
  // Processing
  batchId         String?       @map("batch_id") @db.Uuid
  processedAt     DateTime?     @map("processed_at") @db.Timestamptz(3)
  completedAt     DateTime?     @map("completed_at") @db.Timestamptz(3)
  failedAt        DateTime?     @map("failed_at") @db.Timestamptz(3)
  failureReason   String?       @map("failure_reason") @db.Text
  
  // Provider
  providerTxnId   String?       @map("provider_txn_id") @db.VarChar(255)
  providerResponse Json?        @map("provider_response")
  
  createdAt       DateTime      @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt       DateTime      @updatedAt @map("updated_at") @db.Timestamptz(3)
  
  user    User          @relation(fields: [userId], references: [id])
  account PayoutAccount @relation(fields: [accountId], references: [id])
  batch   PayoutBatch?  @relation(fields: [batchId], references: [id])
  earnings AuthorEarningLedger[]
  
  @@index([userId, status, createdAt])
  @@index([batchId])
  @@index([status, createdAt])
  @@map("payout_requests")
}

model PayoutBatch {
  id              String        @id @default(uuid()) @db.Uuid
  
  // Batch metadata
  batchNumber     String        @unique @map("batch_number") @db.VarChar(50)
  totalRequests   Int           @map("total_requests")
  totalAmount     Decimal       @map("total_amount") @db.Decimal(12, 2)
  
  // Status
  status          String        @db.VarChar(20)  // PENDING, PROCESSING, COMPLETED
  
  // Processing
  processedBy     String?       @map("processed_by") @db.Uuid
  processedAt     DateTime?     @map("processed_at") @db.Timestamptz(3)
  completedAt     DateTime?     @map("completed_at") @db.Timestamptz(3)
  
  createdAt       DateTime      @default(now()) @map("created_at") @db.Timestamptz(3)
  
  requests PayoutRequest[]
  
  @@index([status, createdAt])
  @@map("payout_batches")
}

// Add relations
model User {
  // ... existing fields ...
  revenueAgreementsAsAuthor  RevenueShareAgreement[] @relation("AgreementAuthor")
  revenueAgreementsAsCreator RevenueShareAgreement[] @relation("AgreementCreator")
  revenueAllocations         RevenueAllocation[]     @relation("RevenueAllocations")
  earnings                   AuthorEarningLedger[]
  payoutAccounts             PayoutAccount[]
  payoutRequests             PayoutRequest[]
}

model Story {
  // ... existing fields ...
  revenueAgreements RevenueShareAgreement[]
}

model ChapterPurchase {
  // ... existing fields ...
  revenueAllocations RevenueAllocation[]
}

model RevenueShareAgreement {
  // ... existing fields ...
  allocations RevenueAllocation[]
}

model RevenueAllocation {
  // ... existing fields ...
  earnings AuthorEarningLedger[]
}

model PayoutRequest {
  // ... existing fields ...
}

model PayoutBatch {
  // ... existing fields ...
}
```

---

### 2. Revenue Share Agreement (3 ngày)

**Task 2.1: Create Agreement Command**

**File:** `backend/src/modules/revenue/application/commands/create-revenue-agreement/create-revenue-agreement.command-handler.ts`

```typescript
@Injectable()
export class CreateRevenueAgreementCommandHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: RevenueSharePolicy,
  ) {}
  
  async execute(command: CreateRevenueAgreementCommand): Promise<RevenueAgreementDto> {
    // 1. Validate shares sum to 100%
    const totalShare = command.authorShare + command.platformFee;
    
    if (command.contributorShares) {
      const contributorTotal = command.contributorShares.reduce(
        (sum, c) => sum + c.share,
        0
      );
      totalShare += contributorTotal;
    }
    
    if (Math.abs(totalShare - 1.0) > 0.0001) {
      throw new InvalidInputException('Total shares must equal 100%');
    }
    
    // 2. Check minimum platform fee
    if (command.platformFee < this.policy.minimumPlatformFee) {
      throw new InvalidInputException(
        `Platform fee must be at least ${this.policy.minimumPlatformFee * 100}%`
      );
    }
    
    // 3. Get current agreement version
    const currentAgreement = await this.prisma.revenueShareAgreement.findFirst({
      where: {
        storyId: command.storyId,
        effectiveTo: null,
      },
      orderBy: { version: 'desc' },
    });
    
    const newVersion = currentAgreement ? currentAgreement.version + 1 : 1;
    
    // 4. Create new agreement
    const agreement = await this.prisma.$transaction(async (tx) => {
      // Close previous agreement
      if (currentAgreement) {
        await tx.revenueShareAgreement.update({
          where: { id: currentAgreement.id },
          data: { effectiveTo: command.effectiveFrom },
        });
      }
      
      // Create new agreement
      return tx.revenueShareAgreement.create({
        data: {
          storyId: command.storyId,
          version: newVersion,
          authorUserId: command.authorUserId,
          authorShare: command.authorShare,
          platformFee: command.platformFee,
          contributorShares: command.contributorShares 
            ? JSON.stringify(command.contributorShares)
            : null,
          effectiveFrom: command.effectiveFrom,
          createdBy: command.createdBy,
        },
      });
    });
    
    return mapToAgreementDto(agreement);
  }
}
```

---

### 3. Revenue Allocation on Purchase (4 ngày)

**Task 3.1: Allocate Revenue Command**

**File:** `backend/src/modules/revenue/application/commands/allocate-revenue/allocate-revenue.command-handler.ts`

```typescript
@Injectable()
export class AllocateRevenueCommandHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: RevenueSharePolicy,
  ) {}
  
  async execute(command: AllocateRevenueCommand): Promise<void> {
    // 1. Get purchase
    const purchase = await this.prisma.chapterPurchase.findUnique({
      where: { id: command.purchaseId },
      include: { chapter: { include: { story: true } } },
    });
    
    if (!purchase) {
      throw new ResourceNotFoundException('Purchase', command.purchaseId);
    }
    
    // 2. Get effective agreement
    const agreement = await this.prisma.revenueShareAgreement.findFirst({
      where: {
        storyId: purchase.chapter.storyId,
        effectiveFrom: { lte: purchase.purchasedAt },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: purchase.purchasedAt } },
        ],
      },
    });
    
    if (!agreement) {
      throw new Error('No revenue share agreement found for purchase');
    }
    
    // 3. Calculate allocations
    const grossAmount = parseFloat(purchase.priceCredits.toString());
    
    const allocations: CreateAllocationInput[] = [
      // Author share
      {
        purchaseId: command.purchaseId,
        agreementId: agreement.id,
        recipientUserId: agreement.authorUserId,
        allocationType: 'AUTHOR_SHARE',
        grossAmount,
        sharePercent: parseFloat(agreement.authorShare.toString()),
        netAmount: grossAmount * parseFloat(agreement.authorShare.toString()),
      },
      
      // Platform fee (system account)
      {
        purchaseId: command.purchaseId,
        agreementId: agreement.id,
        recipientUserId: this.policy.systemAccountUserId,
        allocationType: 'PLATFORM_FEE',
        grossAmount,
        sharePercent: parseFloat(agreement.platformFee.toString()),
        netAmount: grossAmount * parseFloat(agreement.platformFee.toString()),
      },
    ];
    
    // Contributors
    if (agreement.contributorShares) {
      const contributors = JSON.parse(agreement.contributorShares as string);
      
      for (const contributor of contributors) {
        allocations.push({
          purchaseId: command.purchaseId,
          agreementId: agreement.id,
          recipientUserId: contributor.userId,
          allocationType: 'CONTRIBUTOR',
          grossAmount,
          sharePercent: contributor.share,
          netAmount: grossAmount * contributor.share,
        });
      }
    }
    
    // 4. Verify total allocation equals gross
    const totalAllocated = allocations.reduce((sum, a) => sum + a.netAmount, 0);
    
    if (Math.abs(totalAllocated - grossAmount) > 0.01) {
      throw new Error(`Allocation mismatch: ${totalAllocated} !== ${grossAmount}`);
    }
    
    // 5. Create allocations
    await this.prisma.$transaction(async (tx) => {
      for (const alloc of allocations) {
        await tx.revenueAllocation.create({
          data: {
            ...alloc,
            status: 'PENDING',
          },
        });
      }
    });
  }
}
```

**Task 3.2: Settle Allocations (Background Job)**

**File:** `backend/src/modules/revenue/infrastructure/jobs/settle-allocations.processor.ts`

```typescript
@Processor('revenue')
@Injectable()
export class SettleAllocationsProcessor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: RevenueSharePolicy,
  ) {}
  
  @Process('settle-allocations')
  async handleSettle(job: Job) {
    // Find allocations past settlement delay
    const settlementDate = new Date();
    settlementDate.setDate(
      settlementDate.getDate() - this.policy.settlementDelayDays
    );
    
    const allocations = await this.prisma.revenueAllocation.findMany({
      where: {
        status: 'PENDING',
        createdAt: { lte: settlementDate },
      },
      take: 100,
    });
    
    for (const allocation of allocations) {
      await this.prisma.$transaction(async (tx) => {
        // 1. Mark allocation as settled
        await tx.revenueAllocation.update({
          where: { id: allocation.id },
          data: {
            status: 'SETTLED',
            settledAt: new Date(),
          },
        });
        
        // 2. Create earning ledger entry
        const availableAt = new Date();
        availableAt.setDate(availableAt.getDate() + this.policy.settlementDelayDays);
        
        await tx.authorEarningLedger.create({
          data: {
            userId: allocation.recipientUserId,
            allocationId: allocation.id,
            amount: allocation.netAmount,
            status: 'PENDING',
            settlementDate: new Date(),
            availableAt,
          },
        });
      });
    }
  }
  
  @Process('make-earnings-available')
  async handleMakeAvailable(job: Job) {
    // Move earnings from PENDING to AVAILABLE
    const now = new Date();
    
    await this.prisma.authorEarningLedger.updateMany({
      where: {
        status: 'PENDING',
        availableAt: { lte: now },
      },
      data: {
        status: 'AVAILABLE',
      },
    });
  }
}
```

---

### 4. Refund Handling (2 ngày)

**File:** `backend/src/modules/revenue/application/commands/refund-allocation/refund-allocation.command-handler.ts`

```typescript
@Injectable()
export class RefundAllocationCommandHandler {
  constructor(private readonly prisma: PrismaService) {}
  
  async execute(command: RefundAllocationCommand): Promise<void> {
    // 1. Get original allocations
    const originalAllocations = await this.prisma.revenueAllocation.findMany({
      where: { purchaseId: command.purchaseId },
    });
    
    if (originalAllocations.length === 0) {
      throw new Error('No allocations found for purchase');
    }
    
    // 2. Create compensating (negative) allocations
    await this.prisma.$transaction(async (tx) => {
      for (const original of originalAllocations) {
        // Create refund allocation
        const refundAllocation = await tx.revenueAllocation.create({
          data: {
            purchaseId: command.purchaseId,
            agreementId: original.agreementId,
            recipientUserId: original.recipientUserId,
            allocationType: original.allocationType,
            grossAmount: original.grossAmount,
            sharePercent: original.sharePercent,
            netAmount: -original.netAmount,  // Negative!
            status: 'SETTLED',
            isRefund: true,
            refundsAllocationId: original.id,
            settledAt: new Date(),
          },
        });
        
        // Mark original as refunded
        await tx.revenueAllocation.update({
          where: { id: original.id },
          data: { refundedBy: refundAllocation.id },
        });
        
        // Create negative earning entry
        await tx.authorEarningLedger.create({
          data: {
            userId: original.recipientUserId,
            allocationId: refundAllocation.id,
            amount: -original.netAmount,
            status: 'AVAILABLE',  // Immediately deduct
            settlementDate: new Date(),
            availableAt: new Date(),
          },
        });
      }
    });
  }
}
```

---

### 5. Payout System (5 ngày)

**Task 5.1: Create Payout Request Command**

**File:** `backend/src/modules/revenue/application/commands/create-payout-request/create-payout-request.command-handler.ts`

```typescript
@Injectable()
export class CreatePayoutRequestCommandHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: PayoutPolicy,
  ) {}
  
  async execute(command: CreatePayoutRequestCommand): Promise<PayoutRequestDto> {
    // 1. Check minimum payout amount
    if (command.amount < this.policy.minimumPayoutAmount) {
      throw new InvalidInputException(
        `Minimum payout amount is ${this.policy.minimumPayoutAmount}`
      );
    }
    
    // 2. Get available earnings
    const availableEarnings = await this.prisma.authorEarningLedger.findMany({
      where: {
        userId: command.userId,
        status: 'AVAILABLE',
      },
      orderBy: { availableAt: 'asc' },
    });
    
    const totalAvailable = availableEarnings.reduce(
      (sum, e) => sum + parseFloat(e.amount.toString()),
      0
    );
    
    if (command.amount > totalAvailable) {
      throw new InvalidInputException(
        `Insufficient available earnings. Available: ${totalAvailable}`
      );
    }
    
    // 3. Get payout account
    const account = await this.prisma.payoutAccount.findUnique({
      where: { id: command.accountId },
    });
    
    if (!account || !account.isVerified) {
      throw new InvalidInputException('Payout account must be verified');
    }
    
    // 4. Calculate fees and tax
    const feeAmount = command.amount * this.policy.payoutFeePercent;
    const taxAmount = command.amount * this.policy.taxPercent;
    const netAmount = command.amount - feeAmount - taxAmount;
    
    // 5. Reserve earnings
    const earningsToReserve = this.selectEarningsToReserve(
      availableEarnings,
      command.amount
    );
    
    // 6. Create payout request
    const payoutRequest = await this.prisma.$transaction(async (tx) => {
      const request = await tx.payoutRequest.create({
        data: {
          userId: command.userId,
          accountId: command.accountId,
          grossAmount: command.amount,
          feeAmount,
          taxAmount,
          netAmount,
          status: 'PENDING',
        },
      });
      
      // Reserve earnings
      for (const earning of earningsToReserve) {
        await tx.authorEarningLedger.update({
          where: { id: earning.id },
          data: {
            status: 'RESERVED',
            payoutRequestId: request.id,
            reservedAt: new Date(),
          },
        });
      }
      
      return request;
    });
    
    return mapToPayoutRequestDto(payoutRequest);
  }
  
  private selectEarningsToReserve(
    earnings: any[],
    targetAmount: number,
  ): any[] {
    const selected: any[] = [];
    let total = 0;
    
    for (const earning of earnings) {
      if (total >= targetAmount) break;
      
      selected.push(earning);
      total += parseFloat(earning.amount.toString());
    }
    
    return selected;
  }
}
```

**Task 5.2: Process Payout Batch**

**File:** `backend/src/modules/revenue/application/commands/process-payout-batch/process-payout-batch.command-handler.ts`

```typescript
@Injectable()
export class ProcessPayoutBatchCommandHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payoutService: PayoutExecutionService,
  ) {}
  
  async execute(command: ProcessPayoutBatchCommand): Promise<void> {
    // 1. Get pending requests
    const requests = await this.prisma.payoutRequest.findMany({
      where: {
        status: 'PENDING',
        createdAt: { lte: command.cutoffDate },
      },
      include: { account: true, user: true },
      take: command.batchSize || 100,
    });
    
    if (requests.length === 0) {
      return;
    }
    
    // 2. Create batch
    const batch = await this.prisma.payoutBatch.create({
      data: {
        batchNumber: this.generateBatchNumber(),
        totalRequests: requests.length,
        totalAmount: requests.reduce(
          (sum, r) => sum + parseFloat(r.netAmount.toString()),
          0
        ),
        status: 'PENDING',
      },
    });
    
    // 3. Assign requests to batch
    await this.prisma.payoutRequest.updateMany({
      where: {
        id: { in: requests.map(r => r.id) },
      },
      data: {
        batchId: batch.id,
        status: 'PROCESSING',
      },
    });
    
    // 4. Process each request
    for (const request of requests) {
      try {
        const result = await this.payoutService.executePayout(request);
        
        await this.prisma.payoutRequest.update({
          where: { id: request.id },
          data: {
            status: 'COMPLETED',
            providerTxnId: result.transactionId,
            providerResponse: result.response,
            completedAt: new Date(),
          },
        });
        
        // Mark earnings as PAID
        await this.prisma.authorEarningLedger.updateMany({
          where: { payoutRequestId: request.id },
          data: {
            status: 'PAID',
            paidAt: new Date(),
          },
        });
        
      } catch (error) {
        await this.prisma.payoutRequest.update({
          where: { id: request.id },
          data: {
            status: 'FAILED',
            failureReason: error.message,
            failedAt: new Date(),
          },
        });
        
        // Release reserved earnings back to AVAILABLE
        await this.prisma.authorEarningLedger.updateMany({
          where: { payoutRequestId: request.id },
          data: {
            status: 'AVAILABLE',
            payoutRequestId: null,
            reservedAt: null,
          },
        });
      }
    }
    
    // 5. Mark batch complete
    await this.prisma.payoutBatch.update({
      where: { id: batch.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
  }
  
  private generateBatchNumber(): string {
    return `PAYOUT_${format(new Date(), 'yyyyMMdd')}_${Date.now()}`;
  }
}
```

---

### 6. KYC & Verification (2 ngày)

**File:** `backend/src/modules/revenue/application/commands/verify-payout-account/verify-payout-account.command-handler.ts`

```typescript
@Injectable()
export class VerifyPayoutAccountCommandHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kycPolicy: KycPolicy,
  ) {}
  
  async execute(command: VerifyPayoutAccountCommand): Promise<void> {
    // 1. Get account
    const account = await this.prisma.payoutAccount.findUnique({
      where: { id: command.accountId },
    });
    
    if (!account) {
      throw new ResourceNotFoundException('PayoutAccount', command.accountId);
    }
    
    // 2. Verify KYC requirements
    const kycValid = await this.kycPolicy.verifyKyc({
      accountId: command.accountId,
      documents: account.kycDocuments,
      method: account.method,
    });
    
    if (!kycValid.valid) {
      throw new InvalidInputException(`KYC verification failed: ${kycValid.reason}`);
    }
    
    // 3. Mark as verified
    await this.prisma.payoutAccount.update({
      where: { id: command.accountId },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
        verifiedBy: command.verifiedBy,
      },
    });
  }
}
```

---

## 📝 IMPLEMENTATION ORDER

### Day 1-3: Revenue Share Agreement
- [ ] Database migration
- [ ] Create agreement command
- [ ] Version management
- [ ] Tests

### Day 4-7: Revenue Allocation
- [ ] Allocate on purchase
- [ ] Settlement job
- [ ] Earning ledger
- [ ] Tests

### Day 8-9: Refund Handling
- [ ] Compensating allocations
- [ ] Negative earnings
- [ ] Tests

### Day 10-12: Payout Accounts
- [ ] Create account
- [ ] KYC verification
- [ ] Account management
- [ ] Tests

### Day 13-16: Payout Requests
- [ ] Create request command
- [ ] Reserve earnings
- [ ] Process batch
- [ ] Payout execution
- [ ] Tests

### Day 17-18: Integration & Polish
- [ ] Reconciliation reports
- [ ] Admin UI
- [ ] Documentation

---

## 🧪 TESTING STRATEGY

### Functional Tests
- [ ] Revenue allocation totals 100%
- [ ] Settlement delay enforced
- [ ] Refund creates compensating entries
- [ ] Payout minimum enforced

### Financial Tests
- [ ] Total allocations = gross revenue
- [ ] Earnings balance after refund
- [ ] Payout amount calculation correct

---

## ✅ DEFINITION OF DONE

- [ ] All tests passing
- [ ] Immutable ledger
- [ ] Compensating allocations for refunds
- [ ] Settlement delay working
- [ ] KYC verification
- [ ] Payout batches functional
- [ ] Documentation complete
