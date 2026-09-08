import type { CreateTextRangeCommentAnchorApi } from './reader-engagement-api.model';

type AnchoredCommentRequest = Readonly<{
  readonly body: string;
  readonly anchor: CreateTextRangeCommentAnchorApi;
}>;

export function toAnchoredCommentRequest(
  body: string,
  anchor: CreateTextRangeCommentAnchorApi,
): AnchoredCommentRequest {
  return {
    body: body.trim(),
    anchor: {
      startBlockId: anchor.startBlockId,
      startOffset: anchor.startOffset,
      endBlockId: anchor.endBlockId,
      endOffset: anchor.endOffset,
      quoteText: anchor.quoteText,
    },
  };
}
