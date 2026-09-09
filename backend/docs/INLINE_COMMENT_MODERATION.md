# Inline comment moderation — Sprint 8

Inline roots, ordinary chapter comments, and replies share the existing comment write guard. The API resolves a reply's root anchor from PostgreSQL; supplying a different root/block in a request cannot reset its quota.

## Configuration

- `COMMENT_ABUSE_RATE_LIMIT_ENABLED=true`: enable Redis-backed quotas. Redis failures reject writes with `ABUSE_PROTECTION_UNAVAILABLE`.
- `COMMENT_WRITE_MINUTE_LIMIT=10`, `COMMENT_WRITE_HOUR_LIMIT=50`: existing global per-user and hashed-IP quotas.
- `COMMENT_CHAPTER_HOUR_LIMIT=10`: new per-user, per-chapter creation quota.
- `COMMENT_BLOCK_HOUR_LIMIT=3`: new per-user, per-chapter, per-block quota shared by anchored roots and their replies.
- `COMMENT_BLACKLIST_TERMS=`: comma-, semicolon-, or newline-separated words/phrases chosen by the operator. Empty means no banned terms have been configured. Matching normalizes Unicode, case, whitespace and zero-width formatting characters, and respects word boundaries. Creation and editing both enforce the same blacklist independently of the rate-limit switch.

Each Redis bucket has an atomic increment and a one-hour expiry from its first request. Rejected attempts count against already-consumed buckets. Rate-limit errors include a stable code (`COMMENT_ABUSE_RATE_LIMITED`), scope, limit, and retry-after seconds. Existing duplicate-content and link-count checks remain in force. Authentication/permission guards continue to reject banned or unauthorized accounts.

## Anchored replies and paid chapters

Replies inherit the root anchor through at most two reply levels. The write transaction rechecks parent visibility and the same published/public chapter and paid-access policy used for anchored roots. A reader without the chapter entitlement cannot use the generic reply endpoint to bypass that gate. The response does not contain an anchor quote or chapter body.

## Report evidence

`Report.evidence.context` is captured from stored comments and anchors inside report creation, alongside the original reported comment body. It contains:

- `source: SERVER`, story/chapter IDs, and the chapter version at submission;
- root comment ID, block IDs and offsets;
- a maximum 500-character quote, the anchor's original version, last verified version, and location status.

No full chapter body or AI prompt is selected. Reporting a reply captures its inherited root anchor. Reports and replies continue to check hidden/deleted parent rules. The report creation response exposes only report ID, status, reason and timestamp; the snapshot is available only through the existing permission-protected admin reports endpoints.

Legacy request fields `anchorBlockId`, `anchorQuote`, and `chapterVersion` are accepted for compatibility and ignored. Reports created before this change may contain untrusted client hints, so their hints are not returned as `anchorContext` or shown as verified evidence. New snapshots are never recalculated from the current chapter when a moderator opens a report. Reanchoring, editing, deletion, and report resolution do not rewrite the stored evidence.

The admin inbox marks anchored reports and shows the original version. Report detail displays the quote, original version, submission-time version, last verified version, and orphaned/reanchored status. Angular text interpolation prevents a quote from becoming executable HTML.

## Verification

- Unit tests cover blacklist normalization/boundaries, edit parity, shared root/reply quota scopes, Redis failure behavior, and rejecting legacy client hints as verified evidence.
- `npm run test:comments:integration` uses the dedicated PostgreSQL test database to check immutable server snapshots after chapter/reanchor changes, spoofed hints, and denied paid-thread replies.
- The admin detail component tests check version/context display and HTML escaping, including a report whose original comment no longer exists.

Database tests require the configured PostgreSQL test environment; unit or build success alone does not verify PostgreSQL invariants or production Redis behavior.
