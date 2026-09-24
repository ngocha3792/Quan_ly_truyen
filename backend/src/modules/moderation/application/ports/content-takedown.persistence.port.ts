import type { ModerationAuditContext } from './moderation.persistence.port';

/**
 * Gỡ nội dung đã lỡ xuất bản. "Xóa" ở đây là soft delete (`deleted_at`) chứ
 * không phải xóa vật lý: `chapter_purchases` và `chapter_entitlements` tham
 * chiếu chương với `onDelete: Restrict`, nên một chương đã có người mua không
 * thể xóa khỏi bảng mà không phá sổ ví. Soft delete cũng là cách toàn bộ phần
 * đọc đang lọc nội dung (`deletedAt: null`), nên nội dung biến mất ngay.
 */
export interface TakeDownContentInput {
  readonly actorId: string;

  readonly reason: string;

  /**
   * Admin xác nhận vẫn gỡ dù đã có người mua chương. Không có xác nhận thì
   * persistence trả `purchases_exist` để không âm thầm cắt quyền đọc của
   * người đã trả tiền.
   */
  readonly acknowledgePurchases: boolean;

  readonly takenDownAt: Date;

  readonly audit: ModerationAuditContext;
}

export interface TakeDownChapterInput extends TakeDownContentInput {
  readonly chapterId: string;
}

export interface TakeDownStoryInput extends TakeDownContentInput {
  readonly storyId: string;
}

export type TakeDownChapterResult =
  | {
      readonly status: 'taken_down';
      readonly chapterId: string;
      readonly storyId: string;
      readonly number: string;
      readonly title: string;
      readonly purchaseCount: number;
    }
  | { readonly status: 'not_found' }
  | { readonly status: 'purchases_exist'; readonly purchaseCount: number };

export type TakeDownStoryResult =
  | {
      readonly status: 'taken_down';
      readonly storyId: string;
      readonly title: string;
      readonly slug: string;
      readonly chapterCount: number;
      readonly purchaseCount: number;
    }
  | { readonly status: 'not_found' }
  | { readonly status: 'purchases_exist'; readonly purchaseCount: number };

export interface ContentTakedownPersistencePort {
  takeDownChapter(input: TakeDownChapterInput): Promise<TakeDownChapterResult>;

  takeDownStory(input: TakeDownStoryInput): Promise<TakeDownStoryResult>;
}

export const CONTENT_TAKEDOWN_PERSISTENCE_PORT = Symbol(
  'CONTENT_TAKEDOWN_PERSISTENCE_PORT',
);
