export class RejectStorySubmissionCommand {
  constructor(
    readonly reviewerId: string | undefined,
    readonly submissionId: string,
    readonly reviewerNote: string,
    readonly ipAddress: string | undefined,
    readonly userAgent: string | undefined,
    readonly requestId: string | undefined,
  ) { }
}
