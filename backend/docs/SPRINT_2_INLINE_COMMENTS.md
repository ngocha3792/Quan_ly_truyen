# Sprint 2 — Inline comments

Inline comments reuse the existing comment, reaction, report, moderation, abuse-guard, and idempotency flows. They are gated by `READER_INLINE_COMMENTS_ENABLED=false` by default.

## Contract

- `POST /api/v1/stories/:storyId/chapters/:chapterId/anchored-comments`
- Request: `{ body, anchor: { startBlockId, startOffset, endBlockId, endOffset, quoteText } }`
- The server reads the current `contentDocument`, extracts the range itself, and rejects a client quote that does not match.
- Paid chapters fail closed unless the caller is the author, a contributor, an active admin, or owns an active chapter entitlement.
- Public comment responses expose only block IDs, offsets, status, and chapter version. Stored quote/context are never returned, preventing paid excerpts from leaking through comment APIs.

## Re-anchoring

The queue worker scans anchors whose `lastVerifiedVersion` is older than the current chapter version. It first verifies stable block IDs and offsets, then searches by exact quote plus surrounding context. A failed match is marked `ORPHANED`; conditional updates make repeated or concurrent batches idempotent.

Configuration:

```env
READER_CONTENT_DOCUMENT_ENABLED=true
READER_INLINE_COMMENTS_ENABLED=true
QUEUE_ENABLED=true
REDIS_ENABLED=true
COMMENT_REANCHOR_BATCH_SIZE=50
COMMENT_REANCHOR_INTERVAL_MS=30000
```

The frontend only enables selection toolbar, block bubbles, and the anchored thread panel when the runtime inline-comment flag is true.
