# Chapter Importer

Splits plain-text chapter dumps into individual chapters and publishes them
into a story through the real author + admin API (never the database
directly) — create → submit-review → admin-approve → publish.

Generalizes the ad-hoc scripts used to import dozens of stories by hand:

- **Heading detection** auto-recognizes `Chương N` / `Chapter N` in plain,
  `### markdown`, and `**bold**` styles, plus unnumbered sections
  (`Lời mở đầu`, `Ngoại truyện`, `Hậu truyện`, `Lời bạt`, `Lời tựa`, …), each
  counted as one chapter. A volume banner glued onto chapter 1's own heading
  line (`Quyển thứ nhất ... ~ chương 1 ...`) is rescued automatically. Chapter
  *numbers* in titles are cosmetic — the server assigns the real order by
  creation sequence, so mislabeled/reset numbers in the source never matter.
  Pass `--pattern` / the GUI's regex field to override entirely.
- **Duplicate detection** flags repeated titles or repeated declared chapter
  numbers within a batch (catches "pasted the same section twice"), and
  checks the target story's existing chapters before creating anything
  (catches "added this exact file already").
- **Session handling** logs in once (with MFA) and persists the rotating
  refresh-token cookie to disk; every call after that silently refreshes the
  short-lived access token before it expires — no more repeated TOTP prompts,
  even across days.
- **Crash-safe by design**: after chapters are created, submit → approve →
  publish is driven by re-reading each chapter's *live* status/version from
  the server, for every non-published chapter in the story — not just ones
  this run created. Re-running the tool after a network blip, an expired
  token, or a killed process simply finishes whatever was left, with no
  separate "resume" script needed.
- **Safe retries**: every mutating call reuses the same idempotency key on
  retry, so a "terminated"/"fetch failed" network error (which may have
  already succeeded server-side) is retried without ever double-creating.

## CLI

```bash
node cli.mjs --base-url=https://example.com \
  --input=chapters1.txt --input=chapters2.txt \
  --story="existing story title substring" \
  [--create-title="Brand New Story Title"] \
  [--pattern="custom regex for heading lines"] \
  [--author-id=... --author-password=... --author-totp=123456] \
  [--admin-id=... --admin-password=... --admin-totp=123456] \
  [--session-dir=./.sessions] [--dry-run] [--force]
```

Credentials can also come from env vars: `AUTHOR_IDENTIFIER`,
`AUTHOR_PASSWORD`, `AUTHOR_TOTP`, `ADMIN_IDENTIFIER`, `ADMIN_PASSWORD`,
`ADMIN_TOTP`. `--dry-run` only parses and previews — no network calls.
`--force` skips the existing-story duplicate check.

## GUI

```bash
node server.mjs [--port=5177]
```

Open `http://localhost:5177`. Log each account in once (TOTP required only
the first time or after the refresh token expires/is revoked), drag & drop
or pick the `.txt` file(s) in order, hit **Xem trước** to sanity-check the
detected chapters and warnings before spending API calls, then **Tạo → Duyệt
→ Xuất bản** to run the full pipeline with a live log.

Uploaded files land under `.uploads/<random>/<name>` (gitignored); sessions
persist under `.sessions/{author,admin}.json` (gitignored — contains a live
refresh token, do not commit or share).

## Layout

- `lib/session.mjs` — login/refresh/persist one identity's auth session.
- `lib/parser.mjs` — heading detection, chapter splitting, duplicate/size warnings.
- `lib/api.mjs` — thin wrappers over the author/admin endpoints, with idempotent retry.
- `lib/importer.mjs` — orchestration: match/create story, dedupe, create, reconcile.
- `cli.mjs` — command-line entry point.
- `server.mjs` + `public/index.html` — local GUI (zero external dependencies).
