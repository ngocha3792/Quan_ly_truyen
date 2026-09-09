import type { ReportReasonName } from '../../dto';
export class CreateCommentReportCommand {
  constructor(
    readonly input: {
      userId: string;
      commentId: string;
      reason: ReportReasonName;
      description?: string;
      ipAddress?: string;
      anchorBlockId?: string;
      anchorQuote?: string;
      chapterVersion?: number;
    },
  ) {}
}
