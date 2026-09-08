import type { TextRangeAnchorInput } from '../../ports';

export class CreateAnchoredCommentCommand {
  constructor(
    readonly userId: string | undefined,
    readonly storyId: string,
    readonly chapterId: string,
    readonly body: string,
    readonly anchor: TextRangeAnchorInput,
    readonly ipAddress?: string,
  ) {}
}
