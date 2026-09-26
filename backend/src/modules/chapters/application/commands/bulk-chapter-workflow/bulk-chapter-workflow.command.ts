/** Duyệt hết chương IN_REVIEW (admin), hoặc gửi duyệt hết chương DRAFT (tác giả). */
export class BulkChapterWorkflowCommand {
  constructor(
    readonly userId: string | undefined,

    readonly action: 'approve' | 'submit',

    /** Bỏ trống là toàn hệ thống; chỉ lô duyệt của admin được bỏ trống. */
    readonly storyId: string | undefined,

    readonly ipAddress: string | undefined,

    readonly userAgent: string | undefined,

    readonly requestId: string | undefined,
  ) {}
}
