# SPRINT 11 — Collaborative Recommendation
**Timeline:** 8–12 ngày  
**Mục tiêu:** Item-item collaborative filtering với implicit feedback và hybrid scoring

---

## 🎯 ACCEPTANCE CRITERIA

✅ Chỉ bắt đầu sau 6-8 tuần analytics production  
✅ Dataset từ completed chapters, dwell time, follow, favorite, rating  
✅ Không dùng raw page view làm positive signal  
✅ Batch job nightly tính item-item/co-visitation  
✅ Hybrid score: heuristic + collaborative + freshness + diversity  
✅ Heuristic hiện tại luôn fallback với reason code  
✅ Offline evaluation: HitRate@K, NDCG@K, coverage, diversity  
✅ A/B rollout, không sinh trend giả  

---

## 📊 PHÂN TÍCH

### Analytics hiện có:
- Story views tracking
- Chapter read tracking
- User follow/favorite
- Rating system
- Dwell time (reading duration)

### Recommendation hiện có:
- Heuristic-based (trending, featured, category-based)
- No collaborative filtering yet

### Yêu cầu:
- **Minimum 6-8 weeks data** trước khi train
- **Implicit signals** (không có explicit "like" button)
- **Cold start handling** cho new users/stories
- **Diversity** trong recommendations

---

## 🏗️ TECHNICAL DESIGN

### 1. Database Schema Changes

```prisma
enum InteractionType {
  CHAPTER_COMPLETED  @map("chapter_completed")
  CHAPTER_DWELL      @map("chapter_dwell")
  STORY_FOLLOWED     @map("story_followed")
  STORY_FAVORITED    @map("story_favorited")
  STORY_RATED        @map("story_rated")
  
  @@map("interaction_type")
}

model UserStoryInteraction {
  id            String          @id @default(uuid()) @db.Uuid
  userId        String          @map("user_id") @db.Uuid
  storyId       String          @map("story_id") @db.Uuid
  
  // Interaction details
  interactionType InteractionType @map("interaction_type")
  
  // Strength/weight
  weight        Decimal         @db.Decimal(5, 4)  // 0.0-1.0
  
  // Context
  chapterId     String?         @map("chapter_id") @db.Uuid
  dwellSeconds  Int?            @map("dwell_seconds")
  rating        Int?            // 1-5 stars
  
  createdAt     DateTime        @default(now()) @map("created_at") @db.Timestamptz(3)
  
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  story   Story   @relation(fields: [storyId], references: [id], onDelete: Cascade)
  chapter Chapter? @relation(fields: [chapterId], references: [id], onDelete: SetNull)
  
  @@unique([userId, storyId, interactionType, chapterId])
  @@index([userId, createdAt])
  @@index([storyId, interactionType])
  @@index([createdAt])
  @@map("user_story_interactions")
}

model StoryRecommendationScore {
  id              String    @id @default(uuid()) @db.Uuid
  
  // Item pair
  sourceStoryId   String    @map("source_story_id") @db.Uuid
  targetStoryId   String    @map("target_story_id") @db.Uuid
  
  // Scores
  collaborativeScore Decimal @map("collaborative_score") @db.Decimal(8, 6)  // 0.0-1.0
  coOccurrenceCount  Int     @map("co_occurrence_count")
  
  // Metadata
  calculatedAt    DateTime  @map("calculated_at") @db.Timestamptz(3)
  modelVersion    String    @map("model_version") @db.VarChar(20)
  
  @@unique([sourceStoryId, targetStoryId])
  @@index([sourceStoryId, collaborativeScore])
  @@index([calculatedAt])
  @@map("story_recommendation_scores")
}

model RecommendationModel {
  id              String    @id @default(uuid()) @db.Uuid
  
  // Model metadata
  version         String    @unique @db.VarChar(20)
  algorithm       String    @db.VarChar(50)  // item_item, co_visitation
  
  // Training dataset
  startDate       DateTime  @map("start_date") @db.Timestamptz(3)
  endDate         DateTime  @map("end_date") @db.Timestamptz(3)
  interactionCount Int      @map("interaction_count")
  uniqueUsers     Int       @map("unique_users")
  uniqueStories   Int       @map("unique_stories")
  
  // Hyperparameters
  parameters      Json
  
  // Evaluation metrics
  hitRateAt10     Decimal?  @map("hit_rate_at_10") @db.Decimal(5, 4)
  ndcgAt10        Decimal?  @map("ndcg_at_10") @db.Decimal(5, 4)
  coverage        Decimal?  @db.Decimal(5, 4)
  diversity       Decimal?  @db.Decimal(5, 4)
  
  // Status
  isActive        Boolean   @default(false) @map("is_active")
  trainedAt       DateTime  @map("trained_at") @db.Timestamptz(3)
  activatedAt     DateTime? @map("activated_at") @db.Timestamptz(3)
  
  createdAt       DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)
  
  @@index([isActive, trainedAt])
  @@map("recommendation_models")
}

model RecommendationExperiment {
  id              String    @id @default(uuid()) @db.Uuid
  
  // Experiment config
  name            String    @unique @db.VarChar(100)
  description     String?   @db.Text
  
  // Variant allocation
  controlPercent  Int       @map("control_percent")  // % using heuristic only
  treatmentPercent Int      @map("treatment_percent")  // % using hybrid
  
  // Targeting
  targetUserIds   String[]  @default([]) @map("target_user_ids")  // Empty = all users
  
  // Status
  isActive        Boolean   @default(false) @map("is_active")
  startedAt       DateTime? @map("started_at") @db.Timestamptz(3)
  endedAt         DateTime? @map("ended_at") @db.Timestamptz(3)
  
  createdAt       DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)
  
  @@map("recommendation_experiments")
}

model RecommendationImpression {
  id              String    @id @default(uuid()) @db.Uuid
  userId          String?   @map("user_id") @db.Uuid
  
  // Recommendation context
  context         String    @db.VarChar(50)  // homepage, story_detail, etc.
  storyId         String?   @map("story_id") @db.Uuid  // For story detail context
  
  // Recommended items
  recommendedStoryIds String[] @map("recommended_story_ids")
  algorithm       String    @db.VarChar(50)  // heuristic, collaborative, hybrid
  
  // Experiment
  experimentId    String?   @map("experiment_id") @db.Uuid
  variant         String?   @db.VarChar(20)  // control, treatment
  
  // User interaction
  clickedStoryId  String?   @map("clicked_story_id") @db.Uuid
  clickPosition   Int?      @map("click_position")
  
  createdAt       DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)
  
  user User? @relation(fields: [userId], references: [id], onDelete: SetNull)
  
  @@index([userId, createdAt])
  @@index([experimentId, variant])
  @@index([context, createdAt])
  @@map("recommendation_impressions")
}

// Add relations
model User {
  // ... existing fields ...
  storyInteractions UserStoryInteraction[]
  recommendationImpressions RecommendationImpression[]
}

model Story {
  // ... existing fields ...
  interactions UserStoryInteraction[]
}

model Chapter {
  // ... existing fields ...
  interactions UserStoryInteraction[]
}
```

---

### 2. Interaction Tracking (2 ngày)

**Task 2.1: Track Interactions from Analytics**

**File:** `backend/src/modules/recommendation/application/listeners/analytics-interaction.listener.ts`

```typescript
@Injectable()
export class AnalyticsInteractionListener {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: InteractionWeightPolicy,
  ) {}
  
  @OnEvent('analytics.chapter.completed')
  async handleChapterCompleted(event: ChapterCompletedEvent): Promise<void> {
    if (!event.userId) return;
    
    await this.recordInteraction({
      userId: event.userId,
      storyId: event.storyId,
      chapterId: event.chapterId,
      interactionType: 'CHAPTER_COMPLETED',
      weight: this.policy.weights.chapterCompleted,
    });
  }
  
  @OnEvent('analytics.chapter.dwell')
  async handleChapterDwell(event: ChapterDwellEvent): Promise<void> {
    if (!event.userId || event.dwellSeconds < 30) return;  // Minimum 30s
    
    // Weight based on dwell time
    const weight = this.policy.calculateDwellWeight(event.dwellSeconds);
    
    await this.recordInteraction({
      userId: event.userId,
      storyId: event.storyId,
      chapterId: event.chapterId,
      interactionType: 'CHAPTER_DWELL',
      weight,
      dwellSeconds: event.dwellSeconds,
    });
  }
  
  @OnEvent('story.followed')
  async handleStoryFollowed(event: StoryFollowedEvent): Promise<void> {
    await this.recordInteraction({
      userId: event.userId,
      storyId: event.storyId,
      interactionType: 'STORY_FOLLOWED',
      weight: this.policy.weights.storyFollowed,
    });
  }
  
  @OnEvent('story.favorited')
  async handleStoryFavorited(event: StoryFavoritedEvent): Promise<void> {
    await this.recordInteraction({
      userId: event.userId,
      storyId: event.storyId,
      interactionType: 'STORY_FAVORITED',
      weight: this.policy.weights.storyFavorited,
    });
  }
  
  @OnEvent('story.rated')
  async handleStoryRated(event: StoryRatedEvent): Promise<void> {
    // Only count ratings 4+ as positive signal
    if (event.rating < 4) return;
    
    await this.recordInteraction({
      userId: event.userId,
      storyId: event.storyId,
      interactionType: 'STORY_RATED',
      weight: this.policy.weights.storyRated,
      rating: event.rating,
    });
  }
  
  private async recordInteraction(data: RecordInteractionInput): Promise<void> {
    await this.prisma.userStoryInteraction.upsert({
      where: {
        userId_storyId_interactionType_chapterId: {
          userId: data.userId,
          storyId: data.storyId,
          interactionType: data.interactionType,
          chapterId: data.chapterId || null,
        },
      },
      create: data,
      update: {
        weight: data.weight,
        dwellSeconds: data.dwellSeconds,
        rating: data.rating,
      },
    });
  }
}
```

**Task 2.2: Interaction Weight Policy**

**File:** `backend/src/modules/recommendation/domain/policies/interaction-weight.policy.ts`

```typescript
export class InteractionWeightPolicy {
  static readonly weights = {
    chapterCompleted: 1.0,   // Strongest signal
    storyFollowed: 0.8,
    storyFavorited: 0.9,
    storyRated: 0.7,
    chapterDwell: 0.0,       // Calculated dynamically
  };
  
  static calculateDwellWeight(dwellSeconds: number): number {
    // Normalize dwell time to 0-1 scale
    // 5 minutes = 300 seconds = weight 0.8
    // Cap at 0.8 to keep completion as strongest
    const normalized = Math.min(dwellSeconds / 300, 1.0);
    return normalized * 0.8;
  }
}
```

---

### 3. Item-Item Collaborative Filtering (4 ngày)

**Task 3.1: Calculate Item Similarity**

**File:** `backend/src/modules/recommendation/infrastructure/jobs/calculate-item-similarity.processor.ts`

```typescript
@Processor('recommendation')
@Injectable()
export class CalculateItemSimilarityProcessor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: Logger,
  ) {}
  
  @Process('calculate-item-similarity')
  async handleCalculation(job: Job<CalculateSimilarityJobData>) {
    const { startDate, endDate, modelVersion } = job.data;
    
    this.logger.log('Starting item-item similarity calculation', {
      startDate,
      endDate,
      modelVersion,
    });
    
    // 1. Build user-item interaction matrix
    const interactions = await this.prisma.userStoryInteraction.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        userId: true,
        storyId: true,
        weight: true,
      },
    });
    
    if (interactions.length < 1000) {
      throw new Error('Insufficient interactions for training (min 1000)');
    }
    
    // 2. Aggregate interactions per user-story
    const userStoryWeights = new Map<string, number>();
    
    for (const interaction of interactions) {
      const key = `${interaction.userId}:${interaction.storyId}`;
      const current = userStoryWeights.get(key) || 0;
      userStoryWeights.set(
        key,
        Math.min(current + parseFloat(interaction.weight.toString()), 1.0)
      );
    }
    
    // 3. Build co-occurrence matrix
    const coOccurrence = new Map<string, number>();
    const userStories = new Map<string, Set<string>>();
    
    for (const [key, weight] of userStoryWeights.entries()) {
      const [userId, storyId] = key.split(':');
      
      if (!userStories.has(userId)) {
        userStories.set(userId, new Set());
      }
      userStories.get(userId)!.add(storyId);
    }
    
    // 4. Calculate co-occurrences
    for (const [userId, stories] of userStories.entries()) {
      const storyList = Array.from(stories);
      
      for (let i = 0; i < storyList.length; i++) {
        for (let j = i + 1; j < storyList.length; j++) {
          const story1 = storyList[i];
          const story2 = storyList[j];
          
          // Bidirectional
          const key1 = `${story1}:${story2}`;
          const key2 = `${story2}:${story1}`;
          
          coOccurrence.set(key1, (coOccurrence.get(key1) || 0) + 1);
          coOccurrence.set(key2, (coOccurrence.get(key2) || 0) + 1);
        }
      }
    }
    
    // 5. Calculate Jaccard similarity scores
    const scores: Array<{
      sourceStoryId: string;
      targetStoryId: string;
      score: number;
      count: number;
    }> = [];
    
    const storyOccurrences = new Map<string, number>();
    for (const stories of userStories.values()) {
      for (const story of stories) {
        storyOccurrences.set(story, (storyOccurrences.get(story) || 0) + 1);
      }
    }
    
    for (const [key, coCount] of coOccurrence.entries()) {
      const [story1, story2] = key.split(':');
      
      const count1 = storyOccurrences.get(story1) || 0;
      const count2 = storyOccurrences.get(story2) || 0;
      
      // Jaccard similarity: |A ∩ B| / |A ∪ B|
      const union = count1 + count2 - coCount;
      const similarity = union > 0 ? coCount / union : 0;
      
      // Only keep scores above threshold
      if (similarity >= 0.05 && coCount >= 3) {
        scores.push({
          sourceStoryId: story1,
          targetStoryId: story2,
          score: similarity,
          count: coCount,
        });
      }
    }
    
    this.logger.log(`Calculated ${scores.length} similarity scores`);
    
    // 6. Store scores in database
    await this.prisma.$transaction(async (tx) => {
      // Delete old scores
      await tx.storyRecommendationScore.deleteMany({
        where: { modelVersion },
      });
      
      // Insert new scores in batches
      const batchSize = 1000;
      for (let i = 0; i < scores.length; i += batchSize) {
        const batch = scores.slice(i, i + batchSize);
        
        await tx.storyRecommendationScore.createMany({
          data: batch.map(s => ({
            sourceStoryId: s.sourceStoryId,
            targetStoryId: s.targetStoryId,
            collaborativeScore: s.score,
            coOccurrenceCount: s.count,
            calculatedAt: new Date(),
            modelVersion,
          })),
        });
      }
    });
    
    // 7. Calculate evaluation metrics
    const metrics = await this.evaluateModel(modelVersion);
    
    // 8. Save model
    await this.prisma.recommendationModel.create({
      data: {
        version: modelVersion,
        algorithm: 'item_item',
        startDate,
        endDate,
        interactionCount: interactions.length,
        uniqueUsers: userStories.size,
        uniqueStories: storyOccurrences.size,
        parameters: {
          minCoOccurrence: 3,
          minSimilarity: 0.05,
        },
        hitRateAt10: metrics.hitRate,
        ndcgAt10: metrics.ndcg,
        coverage: metrics.coverage,
        diversity: metrics.diversity,
        trainedAt: new Date(),
      },
    });
    
    this.logger.log('Item-item similarity calculation completed', {
      modelVersion,
      scores: scores.length,
      metrics,
    });
  }
  
  private async evaluateModel(modelVersion: string): Promise<EvaluationMetrics> {
    // Offline evaluation using hold-out set
    // Implementation omitted for brevity
    return {
      hitRate: 0.15,
      ndcg: 0.12,
      coverage: 0.65,
      diversity: 0.42,
    };
  }
}
```

---

### 4. Hybrid Recommendation System (3 ngày)

**Task 4.1: Hybrid Recommender**

**File:** `backend/src/modules/recommendation/application/services/hybrid-recommender.service.ts`

```typescript
@Injectable()
export class HybridRecommenderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly heuristicRecommender: HeuristicRecommenderService,
    private readonly policy: HybridScoringPolicy,
  ) {}
  
  async recommend(input: RecommendationInput): Promise<RecommendationResult> {
    const scores = new Map<string, StoryScore>();
    
    // 1. Get heuristic recommendations (always fallback)
    const heuristicRecs = await this.heuristicRecommender.recommend(input);
    
    for (const rec of heuristicRecs.stories) {
      scores.set(rec.id, {
        storyId: rec.id,
        heuristicScore: rec.score,
        collaborativeScore: 0,
        freshnessScore: 0,
        diversityScore: 0,
        finalScore: 0,
        reasons: rec.reasons,
      });
    }
    
    // 2. Get collaborative scores (if user has history)
    if (input.userId) {
      const collabRecs = await this.getCollaborativeRecommendations(
        input.userId,
        input.limit * 3  // Get more for diversity
      );
      
      for (const rec of collabRecs) {
        const existing = scores.get(rec.storyId) || {
          storyId: rec.storyId,
          heuristicScore: 0,
          collaborativeScore: 0,
          freshnessScore: 0,
          diversityScore: 0,
          finalScore: 0,
          reasons: [],
        };
        
        existing.collaborativeScore = rec.score;
        scores.set(rec.storyId, existing);
      }
    }
    
    // 3. Calculate freshness scores
    const stories = await this.prisma.story.findMany({
      where: {
        id: { in: Array.from(scores.keys()) },
      },
      select: {
        id: true,
        publishedAt: true,
        updatedAt: true,
      },
    });
    
    for (const story of stories) {
      const score = scores.get(story.id)!;
      score.freshnessScore = this.calculateFreshnessScore(
        story.publishedAt,
        story.updatedAt,
      );
    }
    
    // 4. Calculate diversity (penalize similar categories)
    const categoryCounts = new Map<string, number>();
    
    // 5. Combine scores
    for (const [storyId, score] of scores.entries()) {
      score.finalScore = this.policy.combineScores(score);
    }
    
    // 6. Sort and take top K
    const sortedStories = Array.from(scores.values())
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, input.limit);
    
    // 7. Add reasons
    for (const score of sortedStories) {
      if (score.collaborativeScore > 0.1) {
        score.reasons.push('Dựa trên sở thích của bạn');
      }
      if (score.freshnessScore > 0.5) {
        score.reasons.push('Mới cập nhật');
      }
    }
    
    return {
      stories: sortedStories,
      algorithm: input.userId ? 'hybrid' : 'heuristic',
      reasons: sortedStories.flatMap(s => s.reasons),
    };
  }
  
  private async getCollaborativeRecommendations(
    userId: string,
    limit: number,
  ): Promise<Array<{ storyId: string; score: number }>> {
    // Get user's interacted stories
    const userStories = await this.prisma.userStoryInteraction.findMany({
      where: { userId },
      select: { storyId: true, weight: true },
    });
    
    if (userStories.length === 0) {
      return [];
    }
    
    // Get similar stories
    const recommendations = new Map<string, number>();
    
    for (const interaction of userStories) {
      const similar = await this.prisma.storyRecommendationScore.findMany({
        where: {
          sourceStoryId: interaction.storyId,
        },
        orderBy: { collaborativeScore: 'desc' },
        take: 20,
      });
      
      for (const sim of similar) {
        const currentScore = recommendations.get(sim.targetStoryId) || 0;
        const weight = parseFloat(interaction.weight.toString());
        const simScore = parseFloat(sim.collaborativeScore.toString());
        
        recommendations.set(
          sim.targetStoryId,
          currentScore + (weight * simScore)
        );
      }
    }
    
    // Remove already interacted stories
    const interactedIds = new Set(userStories.map(s => s.storyId));
    for (const id of interactedIds) {
      recommendations.delete(id);
    }
    
    // Sort and return top K
    return Array.from(recommendations.entries())
      .map(([storyId, score]) => ({ storyId, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
  
  private calculateFreshnessScore(
    publishedAt: Date | null,
    updatedAt: Date,
  ): number {
    if (!publishedAt) return 0;
    
    const now = new Date();
    const daysSinceUpdate = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
    
    // Decay over 30 days
    return Math.exp(-daysSinceUpdate / 30);
  }
}
```

**Task 4.2: Hybrid Scoring Policy**

**File:** `backend/src/modules/recommendation/domain/policies/hybrid-scoring.policy.ts`

```typescript
export class HybridScoringPolicy {
  static readonly weights = {
    heuristic: 0.4,
    collaborative: 0.4,
    freshness: 0.1,
    diversity: 0.1,
  };
  
  static combineScores(score: StoryScore): number {
    return (
      score.heuristicScore * this.weights.heuristic +
      score.collaborativeScore * this.weights.collaborative +
      score.freshnessScore * this.weights.freshness +
      score.diversityScore * this.weights.diversity
    );
  }
}
```

---

### 5. A/B Testing & Evaluation (2 ngày)

**Task 5.1: A/B Test Assignment**

**File:** `backend/src/modules/recommendation/application/services/recommendation-experiment.service.ts`

```typescript
@Injectable()
export class RecommendationExperimentService {
  constructor(private readonly prisma: PrismaService) {}
  
  async assignVariant(userId: string): Promise<{ variant: string; experimentId: string | null }> {
    // Get active experiment
    const experiment = await this.prisma.recommendationExperiment.findFirst({
      where: { isActive: true },
    });
    
    if (!experiment) {
      return { variant: 'control', experimentId: null };
    }
    
    // Check if user is targeted
    if (
      experiment.targetUserIds.length > 0 &&
      !experiment.targetUserIds.includes(userId)
    ) {
      return { variant: 'control', experimentId: null };
    }
    
    // Deterministic assignment based on userId hash
    const hash = this.hashUserId(userId);
    const bucket = hash % 100;
    
    if (bucket < experiment.controlPercent) {
      return { variant: 'control', experimentId: experiment.id };
    } else if (bucket < experiment.controlPercent + experiment.treatmentPercent) {
      return { variant: 'treatment', experimentId: experiment.id };
    }
    
    return { variant: 'control', experimentId: null };
  }
  
  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash) + userId.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}
```

**Task 5.2: Track Impressions**

**File:** `backend/src/modules/recommendation/application/commands/track-recommendation-impression/track-recommendation-impression.command-handler.ts`

```typescript
@Injectable()
export class TrackRecommendationImpressionCommandHandler {
  constructor(private readonly prisma: PrismaService) {}
  
  async execute(command: TrackRecommendationImpressionCommand): Promise<void> {
    await this.prisma.recommendationImpression.create({
      data: {
        userId: command.userId,
        context: command.context,
        storyId: command.contextStoryId,
        recommendedStoryIds: command.recommendedStoryIds,
        algorithm: command.algorithm,
        experimentId: command.experimentId,
        variant: command.variant,
      },
    });
  }
}
```

---

## 📝 IMPLEMENTATION ORDER

### Day 1-2: Interaction Tracking
- [ ] Database migration
- [ ] Analytics listeners
- [ ] Weight policy
- [ ] Tests

### Day 3-6: Item-Item Similarity
- [ ] Co-occurrence calculation
- [ ] Jaccard similarity
- [ ] Batch job
- [ ] Tests

### Day 7-9: Hybrid System
- [ ] Collaborative recommender
- [ ] Score combination
- [ ] Freshness/diversity
- [ ] Tests

### Day 10-11: A/B Testing
- [ ] Experiment assignment
- [ ] Impression tracking
- [ ] Metrics calculation
- [ ] Tests

### Day 12: Evaluation & Polish
- [ ] Offline metrics
- [ ] Dashboard
- [ ] Documentation

---

## 🧪 TESTING STRATEGY

### Functional Tests
- [ ] Interaction weights calculated correctly
- [ ] Item similarity scores valid
- [ ] Hybrid scores combine properly
- [ ] A/B assignment deterministic

### Quality Tests
- [ ] HitRate@10 > 0.10
- [ ] NDCG@10 > 0.08
- [ ] Coverage > 0.50
- [ ] Diversity > 0.30

---

## ✅ DEFINITION OF DONE

- [ ] 6-8 weeks data validated
- [ ] Item-item working
- [ ] Hybrid scoring functional
- [ ] A/B test infrastructure
- [ ] Offline metrics tracked
- [ ] Heuristic always fallback
- [ ] Documentation complete
