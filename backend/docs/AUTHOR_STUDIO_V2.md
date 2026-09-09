# Author Studio v2

Author Studio keeps its existing Markdown editor and chapter version history,
and adds autosave/recovery controls around that contract. The stable
`contentDocument` block IDs remain the source used by reader anchors, TTS and
search.

## Autosave

For an existing draft, the editor waits 2.5 seconds after the last title/content
change, stores the draft in an origin-local IndexedDB database
(`truyenhub-author-recovery`), and sends `PATCH /author/stories/:storyId/chapters/:chapterId`
with the chapter `expectedVersion`. The save status is `Đang lưu tự động`,
`Đã lưu tự động`, `Có xung đột phiên bản`, or an error state. A successful
manual save clears the local recovery entry.

The API locks the chapter row and compares `expectedVersion` before writing a
new `ChapterVersion`. A stale client receives `CHAPTER_VERSION_CONFLICT` with
the current version; it cannot overwrite a concurrent edit. The existing
version list, preview and restore endpoints remain the recovery path and a
restore creates a new version.

IndexedDB recovery is origin-local and is not sent to the server automatically.
The tab must not silently overwrite server content after a crash; a future UI
step can present `ChapterLocalRecoveryService.get(chapterId)` for an explicit
restore choice.

## Existing workflow and permissions

The current repository already enforces author/contributor access through
backend guards and chapter ownership/contributor persistence. Publishing and
scheduling already use the existing audit/idempotency/outbox workflow. This
change keeps those routes and adds concurrency protection to draft edits; it
does not introduce a second version table or bypass backend authorization.
