/**
 * Hoàn mọi giao dịch mua còn hiệu lực của một chương, hoặc của cả một truyện.
 *
 * Dùng khi tác giả xoá nội dung đã bán: người đã trả tiền phải được trả lại
 * trước khi thứ họ mua biến mất.
 */
export class RefundChapterPurchasesCommand {
  constructor(
    readonly actorId: string | undefined,

    /** Một trong hai; `storyId` gom mọi chương của truyện. */
    readonly scope: { readonly chapterId?: string; readonly storyId?: string },

    readonly reason: string,

    readonly ipAddress: string | undefined,

    readonly userAgent: string | undefined,

    readonly requestId: string | undefined,
  ) {}
}
