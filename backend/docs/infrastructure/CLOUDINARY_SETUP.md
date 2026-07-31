# Cloudinary media lifecycle

The backend uses signed direct uploads: an authenticated client creates an upload intent, uploads the file to Cloudinary with the returned signed parameters, then confirms the intent. Confirmation reads the authoritative asset through Cloudinary Admin API before PostgreSQL is moved to `READY`.

`confirmExpiresAt` is the application deadline for confirmation. It is not a guarantee that Cloudinary will reject the previously signed request after that time. The cleanup command deletes expired unconfirmed assets using the expected public ID saved with the intent.

## Configuration

Set `CLOUDINARY_ENABLED=false` to disable media storage without preventing API or worker bootstrap. When enabled, configure cloud name, API key, API secret, root folder, signature algorithm, intent/webhook TTLs, and all five preset variables shown in `.env.example`. Never expose or log `CLOUDINARY_API_SECRET`.

Create signed presets for avatar, author banner, story cover, chapter image and attachment. Enable Dynamic Folder Mode because requests use `asset_folder`; set `overwrite=false`. Align preset limits with code: JPEG/PNG/WebP images (5 MB avatar, 10 MB banner/cover, 15 MB chapter) and raw PDF/TXT/DOC/DOCX/ZIP attachments (10 MB). Do not let clients override identity, folder, resource type, allowed formats, or size controls.

## Webhook

Configure the notification URL as `POST <APP_PUBLIC_URL>/api/v1/webhooks/cloudinary`. The route bypasses JWT only; `x-cld-timestamp` and `x-cld-signature` over the raw body remain mandatory. Accepted events are persisted in `inbound_webhook_events` with a provider/event-key unique constraint before HTTP 200.

Rotate the API secret in Cloudinary and deployment secrets together, restart API/worker, then run `npm run ci:verify-cloudinary`. Existing outstanding signatures should be treated as invalid during a rotation window.

## Operations

- Delete expired/unconfirmed and retryable failed assets: `npm run maintenance:media-cleanup`.
- Process persisted Cloudinary webhook inbox events with conditional claims: `npm run maintenance:cloudinary-webhooks`.
- Retry `DELETE_FAILED` by running cleanup after its expiry or invoking the authorized DELETE API again.
- Inspect `media_assets` in `PENDING`, `PROCESSING`, `FAILED`, or `DELETE_FAILED` past `upload_expires_at`, and compare their expected public IDs with Cloudinary assets to audit orphans.
- Validate credentials and signed presets: `npm run ci:verify-cloudinary`. The script intentionally skips when disabled and never prints credentials.
- A real sandbox test may be run only with isolated credentials supplied through environment variables; CI tests use fakes and must not contact Cloudinary.
