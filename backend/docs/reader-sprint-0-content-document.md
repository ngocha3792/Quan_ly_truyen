# Reader Sprint 0: content document and cursor contract

## Compatibility contract

- `Chapter.content` and `ChapterVersion.content` remain the legacy Markdown
  source used by existing renderers and plaintext search.
- `content_document` is a JSONB projection with `schemaVersion: 1` and stable
  block UUIDs. `document_schema_version` is stored separately for efficient
  migrations and rollout checks.
- Existing public reader responses remain unchanged while
  `READER_CONTENT_DOCUMENT_ENABLED=false`. Author/version responses include the
  document so editors can round-trip stable IDs.
- `ReadingProgress.position` remains available. Portable cursors are additive
  and stored in `cursor`/`cursor_schema_version` only when supplied.

## Document schema v1

```json
{
  "schemaVersion": 1,
  "blocks": [
    {
      "id": "ce9a2eaf-4e15-4cab-8c3f-ff8455219b24",
      "type": "paragraph",
      "text": "Markdown source for this block",
      "marks": []
    }
  ]
}
```

Markdown is split on blank lines. Schema v1 recognizes paragraph, heading,
blockquote, list, fenced code and horizontal-rule blocks. The stored block text
is lossless Markdown for that block; existing rendering still reads `content`.

On edit, exact blocks are matched first and retain their IDs across insertions.
Remaining same-type blocks are matched by text similarity before a one-for-one
positional fallback, so a newly inserted paragraph cannot take the ID of a
nearby edited paragraph. A restore copies the source version's complete
document; it never regenerates source block IDs.

## Portable cursor schema v1

Text:

```json
{
  "schemaVersion": 1,
  "kind": "text",
  "blockId": "ce9a2eaf-4e15-4cab-8c3f-ff8455219b24",
  "characterOffset": 120,
  "viewportRatio": 0.35
}
```

Comic:

```json
{
  "schemaVersion": 1,
  "kind": "comic",
  "mediaAssetId": "7a529d29-bdd4-4afb-a55d-29a25573113d",
  "sliceId": "53ed982a-f2ce-4c7f-acef-26fcf472cffe",
  "relativeY": 0.6
}
```

`viewportRatio` and `relativeY` are normalized to `[0, 1]`. Absolute pixel
coordinates are not part of the contract and are rejected by validation and a
database constraint.

## Migration and rollout

Migration `20260908010000_add_reader_content_document_and_cursor_contract` is
expand-only and safe to run again: columns/constraints are conditionally added,
and only rows with a null document are backfilled. Legacy chapter and version
blocks use deterministic chapter+ordinal UUIDs, so reruns do not change IDs and
corresponding historical versions align before future edits.

The new columns intentionally remain nullable during the expand phase so the
previous application binary can still create chapters during rollback. The new
binary always dual-writes both fields and deterministically reconstructs a
missing document if it reads a row created in that rollback window.

The two foundation flags default to off:

- `READER_CONTENT_DOCUMENT_ENABLED=false`
- `READER_PORTABLE_CURSOR_ENABLED=false`

The five dependent reader features also have independent, default-off flags:

- `READER_REALTIME_PROGRESS_SYNC_ENABLED=false`
- `READER_INLINE_COMMENTS_ENABLED=false`
- `READER_COMIC_DELIVERY_ENABLED=false`
- `READER_OFFLINE_READING_ENABLED=false`
- `READER_TEXT_TO_SPEECH_ENABLED=false`

Enable each flag independently after its own implementation, migration checks,
contract tests and client rollout are complete.
